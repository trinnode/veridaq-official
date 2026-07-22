/**
 * InstitutionService — batch management, credential lookup, claim definitions,
 * revocation, and billing for institution actors.
 *
 * BlockchainService is injected via the constructor so that tests can swap in
 * a mock without dynamic require() hacks.
 */

import { PrismaClient } from "@prisma/client"
import pino from "pino"
import { formatEther } from "viem"
import { decrypt } from "../utils/crypto.js"
import { hexToField } from "../utils/field.js"
import { BlockchainService } from "./blockchain.service.js"
import { EarningsService } from "./earnings.service.js"
import { config } from "../config/index.js"

const log = pino({ name: "institution-service" })

export class InstitutionService {
  private blockchainSvc: BlockchainService

  constructor(
    private prisma: PrismaClient,
    blockchainSvc?: BlockchainService
  ) {
    this.blockchainSvc = blockchainSvc ?? new BlockchainService()
  }

  async getBilling(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { 
        id: true, 
        onChainId: true, 
        paymasterBalance: true, 
        tier: true,
        kycApproved: true,
        alsoEmployer: true,
        employerProfile: { select: { id: true, verificationCredits: true, freeVerificationsRemaining: true } },
        _count: { select: { batches: true } }
      },
    })
    if (!inst) return null

    return {
      tier: inst.tier,
      kycApproved: inst.kycApproved,
      alsoEmployer: inst.alsoEmployer,
      employerCredits: inst.employerProfile?.verificationCredits ?? 0,
      employerFreeRemaining: inst.employerProfile?.freeVerificationsRemaining ?? 0,
      totalBatches: inst._count.batches,
    }
  }
  async deleteBatch(batchId: string, institutionId: string) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, institutionId },
    })
    if (!batch) return null
    if (batch.status !== "FAILED") return { error: "Only failed batches can be dismissed" as const }

    await this.prisma.$transaction([
      this.prisma.credential.deleteMany({ where: { batchId } }),
      this.prisma.batch.delete({ where: { id: batchId } }),
    ])

    return { deleted: true }
  }

  async listBatches(institutionId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const total = await this.prisma.batch.count({ where: { institutionId } })
    const items = await this.prisma.batch.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        status: true,
        txHash: true,
        studentCount: true,
        graduationYear: true,
        createdAt: true,
        confirmedAt: true,
        errorReport: true,
      },
    })
    return { total, page, limit, items }
  }

  async getBatch(batchId: string, institutionId: string) {
    return this.prisma.batch.findFirst({
      where: { id: batchId, institutionId },
      include: {
        credentials: {
          select: {
            id: true,
            commitment: true,
            nullifier: true,
            status: true,
            graduationYear: true,
            createdAt: true,
          },
        },
      },
    })
  }

  async createClaim(
    institutionId: string,
    data: {
      label: string
      claimCode: number
      threshold: number
      reviewType: string
      active?: boolean | undefined
      description?: string | null | undefined
    }
  ) {
    return this.prisma.claimDefinition.create({
      data: {
        institutionId,
        label: data.label,
        claimCode: data.claimCode,
        threshold: data.threshold,
        reviewType: data.reviewType as "AUTO" | "MANUAL",
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    })
  }

  async listClaims(institutionId: string) {
    return this.prisma.claimDefinition.findMany({
      where: { institutionId, active: true },
      orderBy: { claimCode: "asc" },
    })
  }

  async updateClaim(
    claimId: string,
    institutionId: string,
    data: Partial<{
      label: string
      claimCode: number
      threshold: number
      reviewType: string
      active: boolean
      description: string
    }>
  ) {
    const updateData: {
      label?: string
      claimCode?: number
      threshold?: number
      reviewType?: "AUTO" | "MANUAL"
      active?: boolean
      description?: string
    } = {}

    if (data.label) updateData.label = data.label
    if (typeof data.claimCode === "number") updateData.claimCode = data.claimCode
    if (typeof data.threshold === "number") updateData.threshold = data.threshold
    if (data.reviewType) updateData.reviewType = data.reviewType as "AUTO" | "MANUAL"
    if (typeof data.active === "boolean") updateData.active = data.active
    if (data.description) updateData.description = data.description

    const updated = await this.prisma.claimDefinition.updateMany({
      where: { id: claimId, institutionId },
      data: updateData,
    })

    if (updated.count === 0) {
      return null
    }

    return this.prisma.claimDefinition.findUnique({
      where: { id: claimId },
    })
  }

  async revokeCredential(institutionId: string, nullifier: string, reasonCode: number) {
    const credential = await this.prisma.credential.findUnique({
      where: { nullifier },
    })

    if (!credential) return { ok: false, error: "Credential not found" }
    if (credential.institutionId !== institutionId) {
      return { ok: false, error: "This credential does not belong to your institution" }
    }
    if (credential.status === "REVOKED") {
      return { ok: false, error: "Credential is already revoked" }
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { adminKeyEncrypted: true, adminKeyIv: true, adminKeyTag: true },
    })

    let institutionWallet: { walletClient: import("viem").WalletClient; account: import("viem").Account } | undefined
    if (institution?.adminKeyEncrypted && institution?.adminKeyIv && institution?.adminKeyTag) {
      try {
        const adminKeyHex = decrypt(institution.adminKeyEncrypted, institution.adminKeyIv, institution.adminKeyTag)
        institutionWallet = BlockchainService.createInstitutionWallet(adminKeyHex)
      } catch {
        log.warn({ institutionId }, "Failed to decrypt institution admin key, using platform admin wallet")
      }
    }

    try {
      await this.blockchainSvc.revokeCredential(BigInt(nullifier), reasonCode, institutionWallet)
    } catch (err) {
      if (institutionWallet) {
        log.warn({ err, nullifier }, "Institution wallet revoke failed, trying platform admin wallet")
        try {
          await this.blockchainSvc.revokeCredential(BigInt(nullifier), reasonCode)
        } catch (err2) {
          log.error({ err: err2, nullifier }, "Platform admin wallet revoke also failed")
          return { ok: false, error: "On-chain revocation failed" }
        }
      } else {
        log.error({ err, nullifier }, "Failed to revoke credential on-chain")
        return { ok: false, error: "On-chain revocation failed" }
      }
    }

    await this.prisma.credential.update({
      where: { id: credential.id },
      data: { status: "REVOKED" },
    })

    return { ok: true }
  }

  async listVerifications(institutionId: string, status: string | undefined, page: number) {
    const limit = 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { institutionId }
    if (status) where["status"] = status

    const [total, items] = await this.prisma.$transaction([
      this.prisma.verificationRequest.count({ where }),
      this.prisma.verificationRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          result: true,
          claimType: true,
          threshold: true,
          matricNumber: true,
          courseName: true,
          createdAt: true,
          completedAt: true,
          employer: { select: { name: true, email: true } },
        },
      }),
    ])

    const enriched = await Promise.all(
      items.map(async (item) => {
        const claimDef = await this.prisma.claimDefinition.findFirst({
          where: { institutionId, claimCode: item.claimType },
          select: { label: true, description: true, reviewType: true },
        })
        return { ...item, claimLabel: claimDef?.label ?? null, claimDescription: claimDef?.description ?? null, reviewType: claimDef?.reviewType ?? "AUTO" }
      })
    )

    return { total, page, limit, items: enriched }
  }

  async getVerificationDetail(requestId: string, institutionId: string) {
    const request = await this.prisma.verificationRequest.findFirst({
      where: { id: requestId, institutionId },
      select: {
        id: true,
        status: true,
        result: true,
        claimType: true,
        threshold: true,
        matricNumber: true,
        courseName: true,
        createdAt: true,
        completedAt: true,
        employer: { select: { name: true, email: true } },
      },
    })

    if (!request) return null

    const claimDef = await this.prisma.claimDefinition.findFirst({
      where: { institutionId, claimCode: request.claimType },
      select: { label: true, description: true, reviewType: true },
    })

    return {
      ...request,
      claimLabel: claimDef?.label ?? null,
      claimDescription: claimDef?.description ?? null,
      reviewType: claimDef?.reviewType ?? "AUTO",
    }
  }

  async approveVerification(requestId: string, institutionId: string) {
    const request = await this.prisma.verificationRequest.findFirst({
      where: {
        id: requestId,
        institutionId,
        status: "AWAITING_INSTITUTION",
      },
      select: {
        id: true,
        employerId: true,
        matricNumber: true,
        claimType: true,
        threshold: true,
        institution: {
          select: {
            id: true,
            onChainId: true,
            publicKey: true,
            institutionKeyEncrypted: true,
            institutionKeyIv: true,
            institutionKeyTag: true,
          },
        },
        credential: {
          select: {
            id: true,
            commitment: true,
            nullifier: true,
            encryptedData: true,
            encryptedIv: true,
            encryptedTag: true,
          },
        },
      },
    })

    if (!request) {
      return { ok: false, error: "Verification request not found" }
    }

    if (!request.credential) {
      return { ok: false, error: "Verification request has no linked credential" }
    }

    await this.prisma.verificationRequest.update({
      where: { id: request.id },
      data: { status: "PROCESSING" },
    })

    if (
      !request.institution.institutionKeyEncrypted ||
      !request.institution.institutionKeyIv ||
      !request.institution.institutionKeyTag
    ) {
      return { ok: false, error: "Institution key missing" }
    }

    let isFreeVerification = true
    if (request.employerId) {
      const employer = await this.prisma.employer.findUnique({
        where: { id: request.employerId },
        select: { id: true, walletAddress: true, freeVerificationsRemaining: true, verificationCredits: true },
      })

      if (!employer?.walletAddress) {
        return { ok: false, error: "Employer wallet missing" }
      }

      try {
        const remaining = await this.blockchainSvc.getRemainingFreeVerifications(
          employer.walletAddress as `0x${string}`
        )
        if (remaining <= 0) {
          const dbRemaining = employer.freeVerificationsRemaining
          if (dbRemaining <= 0) {
            if ((employer.verificationCredits ?? 0) > 0) {
              await this.prisma.employer.update({
                where: { id: employer.id },
                data: { verificationCredits: { decrement: 1 } },
              })
              isFreeVerification = false
            } else {
              return { ok: false, error: "No free verifications" }
            }
          } else {
            await this.prisma.employer.update({
              where: { id: employer.id },
              data: { freeVerificationsRemaining: { decrement: 1 } },
            })
          }
        } else {
          await this.blockchainSvc.consumeFreeVerification(employer.walletAddress as `0x${string}`)
        }
      } catch (err) {
        log.error({ err, requestId }, "Failed to consume free verification")
        return { ok: false, error: "No free verifications" }
      }
    }

    // Credit institution earnings immediately — the manual review work is done
    const earningsSvc = new EarningsService(this.prisma)
    await earningsSvc
      .creditVerification(request.institution.id, request.id, config.VERIFICATION_PRICE_USD, "0", isFreeVerification)
      .catch((err: unknown) => {
        log.error({ err, requestId }, "Failed to credit earnings on manual approve")
      })

    const institutionKeyHex = decrypt(
      request.institution.institutionKeyEncrypted,
      request.institution.institutionKeyIv,
      request.institution.institutionKeyTag
    )
    const institutionKey = hexToField(institutionKeyHex).toString()

    const { VerificationService: VS } = await import("./verification.service.js")
    const verifySvc = new VS(this.prisma, this.blockchainSvc)

    void verifySvc
      .runProofGeneration(
        request.id,
        request.credential,
        institutionKey,
        {
          employerId: request.employerId,
          institutionOnChainId: request.institution.onChainId,
          matricNumber: request.matricNumber,
          claimType: request.claimType,
          threshold: request.threshold,
        },
        request.institution.id,
        isFreeVerification,
        true // skipEarningsCredit — already credited above
      )
      .catch((error: unknown) => {
        log.error({ error, requestId }, "Manual verification approval proof generation failed")
      })

    return { ok: true }
  }

  async declineVerification(requestId: string, institutionId: string, comment?: string) {
    const request = await this.prisma.verificationRequest.findFirst({
      where: {
        id: requestId,
        institutionId,
        status: "AWAITING_INSTITUTION",
      },
      select: {
        id: true,
        employerId: true,
        institution: { select: { id: true } },
      },
    })

    if (!request) {
      return { ok: false, error: "Verification request not found" }
    }

    // Deduct credits from employer
    let isFreeVerification = true
    if (request.employerId) {
      const employer = await this.prisma.employer.findUnique({
        where: { id: request.employerId },
        select: { id: true, walletAddress: true, freeVerificationsRemaining: true, verificationCredits: true },
      })

      if (employer?.walletAddress) {
        try {
          const remaining = await this.blockchainSvc.getRemainingFreeVerifications(
            employer.walletAddress as `0x${string}`
          )
          if (remaining <= 0) {
            const dbRemaining = employer.freeVerificationsRemaining
            if (dbRemaining <= 0) {
              if ((employer.verificationCredits ?? 0) > 0) {
                await this.prisma.employer.update({
                  where: { id: employer.id },
                  data: { verificationCredits: { decrement: 1 } },
                })
                isFreeVerification = false
              }
            } else {
              await this.prisma.employer.update({
                where: { id: employer.id },
                data: { freeVerificationsRemaining: { decrement: 1 } },
              })
            }
          } else {
            await this.blockchainSvc.consumeFreeVerification(employer.walletAddress as `0x${string}`)
          }
        } catch (err) {
          log.error({ err, requestId }, "Failed to consume free verification on decline")
        }
      }
    }

    // Credit institution earnings even on decline
    const earningsSvc = new EarningsService(this.prisma)
    await earningsSvc
      .creditVerification(institutionId, request.id, config.VERIFICATION_PRICE_USD, "0", isFreeVerification)
      .catch((err: unknown) => {
        log.error({ err, requestId }, "Failed to credit earnings on manual decline")
      })

    await this.prisma.verificationRequest.update({
      where: { id: request.id },
      data: {
        status: "COMPLETED",
        result: "RECORD_NOT_FOUND",
        completedAt: new Date(),
        adminNote: comment ?? null,
      },
    })

    return { ok: true }
  }

  async getDashboardStats(institutionId: string) {
    // Total credentials lifetime
    const totalCredentials = await this.prisma.credential.count({
      where: { batch: { institutionId } },
    })

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const requestsThisMonth = await this.prisma.verificationRequest
      .count({
        where: {
          institutionId,
          createdAt: { gte: startOfMonth },
        },
      })
      .catch(() => 0)

    const pendingManual = await this.prisma.verificationRequest
      .count({
        where: {
          status: "AWAITING_INSTITUTION",
          institutionId,
        },
      })
      .catch(() => 0)

    const profile = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        paymasterBalance: true,
        tier: true,
        kycApproved: true,
        name: true,
        createdAt: true,
      },
    })

    const lastBatch = await this.prisma.batch.findFirst({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true },
    })

    return {
      totalCredentials,
      requestsThisMonth,
      pendingManual,
      paymasterBalanceWei: profile?.paymasterBalance || "0",
      paymasterBalanceEth: profile?.paymasterBalance
        ? formatEther(BigInt(profile.paymasterBalance))
        : "0",
      promoActive: profile?.tier === "FREE",
      tier: profile?.tier,
      kycApproved: profile?.kycApproved,
      name: profile?.name,
      createdAt: profile?.createdAt,
      lastBatch,
    }
  }

  async getDashboardCharts(institutionId: string, months = 6) {
    const since = new Date()
    since.setMonth(since.getMonth() - months)
    since.setDate(1)
    since.setHours(0, 0, 0, 0)

    const verifications = await this.prisma.verificationRequest.findMany({
      where: {
        institutionId,
        createdAt: { gte: since },
      },
      select: { createdAt: true, result: true, status: true },
      orderBy: { createdAt: "asc" },
    })

    const batches = await this.prisma.batch.findMany({
      where: {
        institutionId,
        createdAt: { gte: since },
      },
      select: { createdAt: true, status: true, studentCount: true },
      orderBy: { createdAt: "asc" },
    })

    const earnings = await this.prisma.earningTransaction.findMany({
      where: {
        institutionId,
        type: "EARNED",
        createdAt: { gte: since },
      },
      select: { createdAt: true, amountUsd: true, institutionShareUsd: true },
      orderBy: { createdAt: "asc" },
    })

    const monthMap = new Map<string, {
      month: string
      verifications: number
      verified: number
      failed: number
      pending: number
      batches: number
      credentials: number
      earnedUsd: number
      institutionShare: number
    }>()

    const cursor = new Date(since)
    while (cursor <= new Date()) {
      const key = cursor.toISOString().slice(0, 7)
      monthMap.set(key, {
        month: key,
        verifications: 0,
        verified: 0,
        failed: 0,
        pending: 0,
        batches: 0,
        credentials: 0,
        earnedUsd: 0,
        institutionShare: 0,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    for (const v of verifications) {
      const key = v.createdAt.toISOString().slice(0, 7)
      const entry = monthMap.get(key)
      if (entry) {
        entry.verifications++
        if (v.result === "VERIFIED") entry.verified++
        else if (v.result === "CLAIM_NOT_SATISFIED" || v.result === "RECORD_NOT_FOUND" || v.result === "CREDENTIAL_REVOKED") entry.failed++
        else if (v.status === "PENDING" || v.status === "PROCESSING" || v.status === "AWAITING_INSTITUTION") entry.pending++
        else entry.failed++
      }
    }

    for (const b of batches) {
      const key = b.createdAt.toISOString().slice(0, 7)
      const entry = monthMap.get(key)
      if (entry) {
        entry.batches++
        entry.credentials += b.studentCount ?? 0
      }
    }

    for (const e of earnings) {
      const key = e.createdAt.toISOString().slice(0, 7)
      const entry = monthMap.get(key)
      if (entry) {
        entry.earnedUsd += e.amountUsd.toNumber()
        entry.institutionShare += e.institutionShareUsd?.toNumber() ?? 0
      }
    }

    const series = Array.from(monthMap.values())
    return {
      months: series.length,
      series,
      totals: {
        verifications: series.reduce((s, m) => s + m.verifications, 0),
        verified: series.reduce((s, m) => s + m.verified, 0),
        batches: series.reduce((s, m) => s + m.batches, 0),
        credentials: series.reduce((s, m) => s + m.credentials, 0),
        earnedUsd: parseFloat(series.reduce((s, m) => s + m.earnedUsd, 0).toFixed(2)),
        institutionShare: parseFloat(series.reduce((s, m) => s + m.institutionShare, 0).toFixed(2)),
      },
    }
  }

  async getProfile(institutionId: string) {
    return this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        kycApproved: true,
        active: true,
        adminWallet: true,
        createdAt: true,
        _count: { select: { batches: true } },
      },
    })
  }

  async syncPaymasterBalance(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, onChainId: true },
    })

    if (!inst) return null

    const balance = await this.blockchainSvc.getPaymasterInstitutionBalance(
      inst.onChainId as `0x${string}`
    )

    await this.prisma.institution.update({
      where: { id: inst.id },
      data: { paymasterBalance: balance.toString() },
    })

    return { paymasterBalanceWei: balance.toString() }
  }
}
