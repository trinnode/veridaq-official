/**
 * InstitutionService unit tests.
 *
 * Uses the seeded institution from prisma/seed.ts.
 * BlockchainService is replaced by the mock.
 */

import { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { InstitutionService } from "../services/institution.service.js"
import { encrypt } from "../utils/crypto.js"
import { hashToField } from "../utils/field.js"
import { BlockchainService } from "./mocks/blockchain.service.js"

let prisma: PrismaClient
let instSvc: InstitutionService
let institutionId: string
let testClaimId: string | null = null
let testCredentialNullifier: string | null = null

beforeAll(async () => {
  prisma = new PrismaClient()

  const inst = await prisma.institution.findUnique({
    where: { email: "futminna@veridaq.xyz" },
    select: { id: true },
  })
  if (!inst) throw new Error("Seed institution not found — run pnpm db:seed first")
  institutionId = inst.id

  const mockBlockchain = new BlockchainService() as unknown as import("../services/blockchain.service.js").BlockchainService
  instSvc = new InstitutionService(prisma, mockBlockchain)
})

afterAll(async () => {
  // Clean up any test data created during the suite
  if (testClaimId) {
    await prisma.claimDefinition.deleteMany({ where: { id: testClaimId } }).catch(() => {})
  }
  if (testCredentialNullifier) {
    await prisma.credential.deleteMany({ where: { nullifier: testCredentialNullifier } }).catch(() => {})
  }
  await prisma.$disconnect()
})

// ── Batch listing ─────────────────────────────────────────────────────────────

describe("InstitutionService.listBatches", () => {
  it("returns a paginated result", async () => {
    const result = await instSvc.listBatches(institutionId, 1, 10)
    expect(typeof result.total).toBe("number")
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(10)
  })
})

// ── Claim definitions ─────────────────────────────────────────────────────────

describe("InstitutionService.listClaims", () => {
  it("returns the seeded claim definitions", async () => {
    const claims = await instSvc.listClaims(institutionId)
    expect(Array.isArray(claims)).toBe(true)
    expect(claims.length).toBeGreaterThanOrEqual(6) // 6 seeded claims
    const codes = claims.map((c) => c.claimCode)
    expect(codes).toContain(1)
    expect(codes).toContain(4)
  })
})

describe("InstitutionService.createClaim", () => {
  it("creates a new claim definition", async () => {
    const claim = await instSvc.createClaim(institutionId, {
      label: "Test Claim",
      claimCode: 99,
      threshold: 99,
      reviewType: "AUTO",
    })
    expect(claim.id).toBeTruthy()
    expect(claim.label).toBe("Test Claim")
    expect(claim.threshold).toBe(99)
    testClaimId = claim.id
  })
})

describe("InstitutionService.updateClaim", () => {
  it("updates the label of an existing claim", async () => {
    if (!testClaimId) return
    const updated = await instSvc.updateClaim(testClaimId, institutionId, {
      label: "Updated Test Claim",
    })
    expect(updated?.label).toBe("Updated Test Claim")
  })

  it("returns null when the claim does not belong to the institution", async () => {
    const result = await instSvc.updateClaim("nonexistent-id", institutionId, {
      label: "Should not update",
    })
    expect(result).toBeNull()
  })
})

// ── Credential revocation ─────────────────────────────────────────────────────

describe("InstitutionService.revokeCredential", () => {
  beforeAll(async () => {
    // Create a synthetic credential to revoke
    const nullifier = "0x" + "ee".repeat(32)
    testCredentialNullifier = nullifier

    let batch = await prisma.batch.findFirst({ where: { institutionId } })
    if (!batch) {
      batch = await prisma.batch.create({
        data: { institutionId, status: "CONFIRMED", studentCount: 1, graduationYear: 2024 },
      })
    }

    const plaintext = JSON.stringify({
      nameHash: hashToField("Revoke Test Student").toString(),
      matricHash: hashToField("REVOKE/2024/CS/001").toString(),
      cgpa: 380,
      classification: 3,
      courseHash: hashToField("Engineering").toString(),
      graduationYear: 2024,
      blindingFactor: "111",
    })
    const { encryptedData, encryptedIv, encryptedTag } = encrypt(plaintext)

    await prisma.credential.upsert({
      where: { nullifier },
      update: {},
      create: {
        batchId: batch.id,
        institutionId,
        commitment: "0x" + "ff".repeat(32),
        nullifier,
        encryptedData,
        encryptedIv,
        encryptedTag,
        graduationYear: 2024,
        status: "ACTIVE",
      },
    })
  })

  it("revokes a credential that belongs to the institution", async () => {
    if (!testCredentialNullifier) return
    const result = await instSvc.revokeCredential(institutionId, testCredentialNullifier, 1)
    expect(result.ok).toBe(true)

    const cred = await prisma.credential.findUnique({
      where: { nullifier: testCredentialNullifier },
    })
    expect(cred?.status).toBe("REVOKED")
  })

  it("returns an error when revoking an already-revoked credential", async () => {
    if (!testCredentialNullifier) return
    const result = await instSvc.revokeCredential(institutionId, testCredentialNullifier, 1)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/already revoked/i)
  })

  it("returns an error when the nullifier does not exist", async () => {
    const result = await instSvc.revokeCredential(
      institutionId,
      "0x" + "00".repeat(32),
      1
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })
})

// ── Manual review charging ───────────────────────────────────────────────────

describe("InstitutionService.declineVerification — charging", () => {
  /**
   * Manual (claim 6) requests are charged when the institution reviews them, so
   * the review path is where the money is decided. These two tests pin both
   * directions: a decline with nothing to charge must not pay the institution,
   * and a decline with a credit must charge and pay exactly once.
   */
  let employerId: string
  const requestIds: string[] = []

  beforeAll(async () => {
    const employer = await prisma.employer.create({
      data: {
        email: `decline-charge-${Date.now()}@veridaq.test`,
        name: "Decline Charge Test Employer",
        cacNumber: `RC-${Date.now()}`,
        passwordHash: "not-a-real-hash",
        walletAddress: "0x00000000000000000000000000000000000000aa",
        freeVerificationsRemaining: 0,
        verificationCredits: 0,
        kycApproved: true,
      },
      select: { id: true },
    })
    employerId = employer.id
  })

  afterAll(async () => {
    if (requestIds.length > 0) {
      await prisma.earningTransaction
        .deleteMany({ where: { verificationId: { in: requestIds } } })
        .catch(() => {})
      await prisma.verificationRequest
        .deleteMany({ where: { id: { in: requestIds } } })
        .catch(() => {})
    }
    if (employerId) {
      await prisma.employer.delete({ where: { id: employerId } }).catch(() => {})
    }
  })

  /** A decline with an employer who has nothing left must not create earnings. */
  it("does not credit the institution when the employer cannot be charged", async () => {
    const before = await prisma.institutionEarnings.findUnique({
      where: { institutionId },
      select: { totalEarnedUsd: true },
    })

    const request = await prisma.verificationRequest.create({
      data: {
        employerId,
        institutionId,
        matricNumber: "DECLINE/2026/001",
        claimType: 6,
        threshold: 0,
        courseName: "Computer Science",
        status: "AWAITING_INSTITUTION",
      },
      select: { id: true },
    })
    requestIds.push(request.id)

    // Chain says zero free checks, and the database agrees: there is nothing to
    // spend. The previous code credited earnings regardless.
    const drainChain = {
      getRemainingFreeVerifications: async () => 0,
      consumeFreeVerification: async () => "0x0" as `0x${string}`,
    } as unknown as import("../services/blockchain.service.js").BlockchainService
    const svc = new InstitutionService(prisma, drainChain)

    const result = await svc.declineVerification(request.id, institutionId, "No record of this programme")
    expect(result.ok).toBe(true)

    const earned = await prisma.earningTransaction.count({
      where: { verificationId: request.id },
    })
    expect(earned).toBe(0)

    const after = await prisma.institutionEarnings.findUnique({
      where: { institutionId },
      select: { totalEarnedUsd: true },
    })
    expect(after?.totalEarnedUsd.toString()).toBe(before?.totalEarnedUsd.toString())
  })

  /** A decline with a paid credit must charge once and credit earnings once. */
  it("charges exactly one credit and credits earnings once", async () => {
    await prisma.employer.update({
      where: { id: employerId },
      data: { verificationCredits: 1, freeVerificationsRemaining: 0 },
    })

    const request = await prisma.verificationRequest.create({
      data: {
        employerId,
        institutionId,
        matricNumber: "DECLINE/2026/002",
        claimType: 6,
        threshold: 0,
        courseName: "Computer Science",
        status: "AWAITING_INSTITUTION",
      },
      select: { id: true },
    })
    requestIds.push(request.id)

    const drainChain = {
      getRemainingFreeVerifications: async () => 0,
      consumeFreeVerification: async () => "0x0" as `0x${string}`,
    } as unknown as import("../services/blockchain.service.js").BlockchainService
    const svc = new InstitutionService(prisma, drainChain)

    const result = await svc.declineVerification(request.id, institutionId, "No record of this programme")
    expect(result.ok).toBe(true)

    const employer = await prisma.employer.findUnique({
      where: { id: employerId },
      select: { verificationCredits: true },
    })
    expect(employer?.verificationCredits).toBe(0)

    const earned = await prisma.earningTransaction.findMany({
      where: { verificationId: request.id },
      select: { type: true },
    })
    expect(earned.length).toBe(1)
    expect(earned[0]?.type).toBe("EARNED")
  })
})

// ── Dashboard stats ───────────────────────────────────────────────────────────

describe("InstitutionService.getDashboardStats", () => {
  it("returns numeric stats for the institution", async () => {
    const stats = await instSvc.getDashboardStats(institutionId)
    expect(typeof stats.totalCredentials).toBe("number")
    expect(typeof stats.requestsThisMonth).toBe("number")
    expect(typeof stats.pendingManual).toBe("number")
    expect(stats.tier).toBeDefined()
  })
})

// ── Profile ───────────────────────────────────────────────────────────────────

describe("InstitutionService.getProfile", () => {
  it("returns the institution profile", async () => {
    const profile = await instSvc.getProfile(institutionId)
    expect(profile?.email).toBe("futminna@veridaq.xyz")
    expect(profile?.name).toBeTruthy()
  })
})
