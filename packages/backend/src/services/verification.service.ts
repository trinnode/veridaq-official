/**
 * VerificationService — handles employer verification requests.
 *
 * The proof generation is intentionally asynchronous — the client polls
 * /request/:id for status updates. The circuit compilation step takes 2–8 s
 * per proof on modern hardware, which is acceptable for the request volume
 * VERIDAQ targets in its initial phase.
 *
 * BlockchainService is injected via the constructor so that tests can swap in
 * a mock without dynamic require() hacks.
 */

import { PrismaClient } from "@prisma/client"
import pino from "pino"
import { decrypt } from "../utils/crypto.js"
import { hashToField, hexToField } from "../utils/field.js"
import { programmeMatchesRecord } from "../utils/course.js"
import { BlockchainService } from "./blockchain.service.js"
import { spendFreeVerification, spendPaidCredit, hasVerificationUnitAvailable } from "./credit.service.js"
import { EarningsService } from "./earnings.service.js"
import { ProofService } from "./proof.service.js"
import { config } from "../config/index.js"

const log = pino({ name: "verification-service" })

type CreateRequestInput = {
  employerId: string
  institutionOnChainId: string
  matricNumber: string
  claimType: number
  threshold: number
  courseName?: string
}

export class VerificationService {
  private proofSvc: ProofService
  private blockchainSvc: BlockchainService
  private earningsSvc: EarningsService

  constructor(
    private prisma: PrismaClient,
    blockchainSvc?: BlockchainService
  ) {
    this.proofSvc = new ProofService()
    this.earningsSvc = new EarningsService(prisma)
    // Allow injection for testing; fall back to real service in production.
    this.blockchainSvc = blockchainSvc ?? new BlockchainService()
  }

  private async findCredentialByMatric(institutionId: string, matricNumber: string) {
    const targetMatricHash = hashToField(matricNumber).toString()

    const credentials = await this.prisma.credential.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        commitment: true,
        nullifier: true,
        encryptedData: true,
        encryptedIv: true,
        encryptedTag: true,
        status: true,
        revokedReason: true,
        revokedAt: true,
      },
    })

    for (const credential of credentials) {
      try {
        const plaintext = decrypt(
          credential.encryptedData,
          credential.encryptedIv,
          credential.encryptedTag
        )
        const attrs = JSON.parse(plaintext) as { matricHash?: string }
        if (attrs.matricHash === targetMatricHash) {
          return credential
        }
      } catch {
        // Skip malformed credential payloads and continue searching.
      }
    }

    return null
  }

  async createRequest(input: CreateRequestInput) {
    // Look up the institution by its on-chain ID
    const institution = await this.prisma.institution.findUnique({
      where: { onChainId: input.institutionOnChainId },
    })
    if (!institution) {
      return { error: "NOT_FOUND" as const }
    }
    // We allow verification of old students even if the institution is deactivated,
    // but it MUST have been KYC approved in the first place.
    if (!institution.kycApproved) {
      return { error: "INSTITUTION_INACTIVE" as const }
    }

    // A double submit (two tabs, a slow connection, an impatient click) must not
    // create two requests or spend two credits. The client disables the button
    // while in flight, but the server has to enforce it too.
    //
    // A completed check is deduplicated as well: re-running the identical query
    // a second later returns the same answer and would cost another credit.
    // FAILED is deliberately excluded so a genuine retry still works.
    const recent = await this.prisma.verificationRequest.findFirst({
      where: {
        employerId: input.employerId,
        institutionId: institution.id,
        matricNumber: input.matricNumber,
        claimType: input.claimType,
        threshold: input.threshold,
        courseName: input.courseName ?? null,
        status: { in: ["PROCESSING", "AWAITING_INSTITUTION", "COMPLETED"] },
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    })
    if (recent) {
      return { requestId: recent.id, status: recent.status, deduplicated: true }
    }

    // Look up the employer and check free verifications
    const employer = await this.prisma.employer.findUnique({
      where: { id: input.employerId },
    })
    if (!employer) return { error: "NOT_FOUND" as const }
    if (!employer.walletAddress) return { error: "NO_FREE_VERIFICATIONS" as const }

    const credential = await this.findCredentialByMatric(institution.id, input.matricNumber)

    if (!credential) return { error: "NOT_FOUND" as const }

    // Check revocation status — if revoked, create a COMPLETED request with CREDENTIAL_REVOKED
    let isRevoked = credential.status === "REVOKED"
    if (!isRevoked) {
      try {
        isRevoked = await this.blockchainSvc.isRevoked(BigInt(credential.nullifier))
      } catch (err) {
        log.error({ err }, "Failed to check on-chain revocation status")
      }
    }

    if (isRevoked) {
      const request = await this.prisma.verificationRequest.create({
        data: {
          employerId: input.employerId,
          institutionId: institution.id,
          credentialId: credential.id,
          matricNumber: input.matricNumber,
          courseName: input.courseName ?? null,
          claimType: input.claimType,
          threshold: input.threshold,
          status: "COMPLETED",
          result: "CREDENTIAL_REVOKED",
          completedAt: new Date(),
          institutionNote: credential.revokedReason
            ? `Credential revoked: ${credential.revokedReason}`
            : "Credential has been revoked",
        },
      })
      return { requestId: request.id, status: request.status, result: "CREDENTIAL_REVOKED" }
    }

    // Determine if this claim requires manual institution review
    const claimDef = await this.prisma.claimDefinition.findFirst({
      where: {
        institutionId: institution.id,
        claimCode: input.claimType,
      },
    })

    const isManual = claimDef ? claimDef.reviewType === "MANUAL" : true

    // Claim 6 asks the institution to confirm a named programme. Reject the two
    // cases that can never succeed before any credit is spent: no programme
    // name supplied, or a credential that carries no course hash (the circuit
    // proves `courseHash != 0`, so such a credential can never satisfy it).
    if (input.claimType === 6) {
      if (!input.courseName || input.courseName.trim().length === 0) {
        return { error: "COURSE_NAME_REQUIRED" as const }
      }
      try {
        const plaintext = decrypt(
          credential.encryptedData,
          credential.encryptedIv,
          credential.encryptedTag
        )
        const attrs = JSON.parse(plaintext) as { courseHash?: string }
        if (!attrs.courseHash || attrs.courseHash === "0") {
          return { error: "PROGRAMME_NOT_RECORDED" as const }
        }
        // The named programme must be the one on the credential. Otherwise the
        // institution would be attesting to a string the record contradicts.
        if (!programmeMatchesRecord(input.courseName, attrs.courseHash)) {
          return { error: "PROGRAMME_MISMATCH" as const }
        }
      } catch {
        return { error: "PROGRAMME_NOT_RECORDED" as const }
      }
    }

    // Manual requests are charged when the institution reviews them, not here.
    // That is fair — the employer should not pay for a review that may never
    // happen — but it lets a zero-balance employer queue unlimited work for a
    // registrar. Refuse early. The database mirror answers the common case; the
    // chain is only asked before a rejection, because the mirror lags it.
    if (isManual && !(await hasVerificationUnitAvailable(this.prisma, employer.id))) {
      let chainHasUnit = false
      try {
        const remaining = await this.blockchainSvc.getRemainingFreeVerifications(
          employer.walletAddress as `0x${string}`
        )
        chainHasUnit = remaining > 0
      } catch (err) {
        log.error({ err }, "Could not confirm free-verification balance with the chain")
      }
      if (!chainHasUnit) return { error: "NO_FREE_VERIFICATIONS" as const }
    }

    // Create the request record
    const request = await this.prisma.verificationRequest.create({      data: {
        employerId: input.employerId,
        institutionId: institution.id,
        credentialId: credential.id,
        matricNumber: input.matricNumber,
        courseName: input.courseName ?? null,
        claimType: input.claimType,
        threshold: input.threshold,
        status: isManual ? "AWAITING_INSTITUTION" : "PROCESSING",
      },
    })

    if (!isManual) {
      let isFreeVerification = true
      try {
        const remaining = await this.blockchainSvc.getRemainingFreeVerifications(
          employer.walletAddress as `0x${string}`
        )
        if (remaining <= 0) {
          // Guarded updates: concurrent requests cannot both consume the same
          // free check or the same paid credit.
          const usedFree = await spendFreeVerification(this.prisma, employer.id)
          if (!usedFree) {
            const usedCredit = await spendPaidCredit(this.prisma, employer.id)
            if (!usedCredit) {
              return { error: "NO_FREE_VERIFICATIONS" as const }
            }
            isFreeVerification = false
          }
        } else {
          await this.blockchainSvc.consumeFreeVerification(employer.walletAddress as `0x${string}`)
        }
      } catch (err) {
        log.error({ err }, "Failed to consume free verification")
        return { error: "NO_FREE_VERIFICATIONS" as const }
      }

      if (
        !institution.institutionKeyEncrypted ||
        !institution.institutionKeyIv ||
        !institution.institutionKeyTag
      ) {
        return { error: "INSTITUTION_KEY_MISSING" as const }
      }

      const institutionKeyHex = decrypt(
        institution.institutionKeyEncrypted,
        institution.institutionKeyIv,
        institution.institutionKeyTag
      )
      const institutionKey = hexToField(institutionKeyHex).toString()

      // Proof generation runs asynchronously — the client polls /request/:id for status.
      this.runProofGeneration(request.id, credential, institutionKey, input, institution.id, isFreeVerification).catch((err) => {
        log.error({ err, requestId: request.id }, "Proof generation failed")
      })
    }

    return { requestId: request.id, status: request.status }
  }

  async runProofGeneration(
    requestId: string,
    credential: {
      id: string
      commitment: string
      nullifier: string
      encryptedData: string
      encryptedIv: string
      encryptedTag: string
    },
    institutionKey: string,
    input: CreateRequestInput,
    institutionId: string,
    isFreeVerification: boolean,
    skipEarningsCredit = false
  ) {
    try {
      const { proof, publicSignals } = await this.proofSvc.generateProof(
        credential.encryptedData,
        credential.encryptedIv,
        credential.encryptedTag,
        institutionKey,
        {
          commitment: credential.commitment,
          nullifier: credential.nullifier,
          claimType: input.claimType,
          threshold: input.threshold,
        }
      )

      const a = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])] as [bigint, bigint]
      const b = [
        [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
        [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
      ] as [[bigint, bigint], [bigint, bigint]]
      const c = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])] as [bigint, bigint]

      if (publicSignals.length !== 4) {
        throw new Error(`Expected 4 public signals, got ${publicSignals.length}`)
      }

      const [signal0, signal1, signal2, signal3] = publicSignals
      if (!signal0 || !signal1 || !signal2 || !signal3) {
        throw new Error("Missing public signals for verifier")
      }

      const pubArgs: [bigint, bigint, bigint, bigint] = [
        BigInt(signal0),
        BigInt(signal1),
        BigInt(signal2),
        BigInt(signal3),
      ]

      const isVerifiedOnChain = await this.blockchainSvc.verifyProof(a, b, c, pubArgs)
      if (!isVerifiedOnChain) throw new Error("On-chain verification returned false")

      await this.prisma.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: "COMPLETED",
          result: "VERIFIED",
          proofJson: JSON.stringify({ proof, publicSignals }),
          completedAt: new Date(),
        },
      })

      // Credit earnings only if not already credited by the caller
      if (!skipEarningsCredit) {
        const usdAmount = config.VERIFICATION_PRICE_USD
        await this.earningsSvc.creditVerification(
          institutionId,
          requestId,
          usdAmount,
          "0",
          isFreeVerification
        )
      }
    } catch (err) {
      log.error({ err, requestId }, "Proof generation or on-chain verification failed")
      await this.prisma.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: "FAILED",
          result: "CLAIM_NOT_SATISFIED",
          completedAt: new Date(),
        },
      })
    }
  }

  async getRequest(requestId: string, employerId: string) {
    return this.prisma.verificationRequest.findFirst({
      where: { id: requestId, employerId },
      select: {
        id: true,
        status: true,
        result: true,
        claimType: true,
        threshold: true,
        createdAt: true,
        completedAt: true,
        institutionNote: true,
        institution: {
          select: {
            name: true,
            active: true,
            deactivatedAt: true,
            deactivationReason: true,
          },
        },
      },
    })
  }

  async getHistory(employerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const total = await this.prisma.verificationRequest.count({ where: { employerId } })
    const items = await this.prisma.verificationRequest.findMany({
      where: { employerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        status: true,
        result: true,
        claimType: true,
        createdAt: true,
        completedAt: true,
        institutionNote: true,
        institution: {
          select: {
            name: true,
            onChainId: true,
            active: true,
            deactivatedAt: true,
            deactivationReason: true,
          },
        },
      },
    })
    return { total, page, limit, items }
  }

  async getPublicRequest(requestId: string) {
    return this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        result: true,
        matricNumber: true,
        claimType: true,
        threshold: true,
        txHash: true,
        createdAt: true,
        completedAt: true,
        institution: {
          select: {
            name: true,
            onChainId: true,
          },
        },
      },
    })
  }

  async getActiveInstitutions() {
    const insts = await this.prisma.institution.findMany({
      where: { active: true, kycApproved: true },
      select: {
        id: true,
        onChainId: true,
        name: true,
        tier: true,
        claims: {
          where: { active: true },
          select: { id: true, label: true, claimCode: true, threshold: true },
        },
      },
    })
    return insts
  }
}
