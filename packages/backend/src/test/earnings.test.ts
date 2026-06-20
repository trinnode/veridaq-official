import { PrismaClient } from "@prisma/client"
import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { EarningsService } from "../services/earnings.service.js"

let prisma: PrismaClient
let earningsSvc: EarningsService

// Use unique institution IDs for each group to avoid state leakage
const INST_EMAIL_CREDIT = "earnings-test-credit@veridaq.xyz"
const INST_EMAIL_WITHDRAW = "earnings-test-withdraw@veridaq.xyz"

beforeAll(async () => {
  prisma = new PrismaClient()
  earningsSvc = new EarningsService(prisma)

  // Create fresh institutions for isolated tests
  for (const email of [INST_EMAIL_CREDIT, INST_EMAIL_WITHDRAW]) {
    const existing = await prisma.institution.findUnique({ where: { email } })
    if (!existing) {
      await prisma.institution.create({
        data: {
          email,
          name: `Earnings Test (${email})`,
          passwordHash: "test-hash",
          onChainId: "0x" + Buffer.from(email).toString("hex").padStart(64, "0"),
          adminWallet: "0x0000000000000000000000000000000000000001",
          publicKey: "0x04aabbcc",
          institutionKeyEncrypted: "encrypted",
          institutionKeyIv: "iv",
          institutionKeyTag: "tag",
          active: true,
          kycApproved: true,
          alsoEmployer: false,
        },
      })
    }
  }
})

afterAll(async () => {
  // Clean up test institutions and their earnings/transactions
  for (const email of [INST_EMAIL_CREDIT, INST_EMAIL_WITHDRAW]) {
    const inst = await prisma.institution.findUnique({ where: { email } })
    if (inst) {
      await prisma.earningTransaction.deleteMany({ where: { institutionId: inst.id } })
      await prisma.institutionEarnings.deleteMany({ where: { institutionId: inst.id } })
      await prisma.verificationRequest.deleteMany({ where: { institutionId: inst.id } })
      await prisma.claimDefinition.deleteMany({ where: { institutionId: inst.id } })
      await prisma.employer.deleteMany({ where: { institutionId: inst.id } })
      await prisma.institution.delete({ where: { id: inst.id } })
    }
  }
  await prisma.$disconnect()
})

async function getInstId(email: string) {
  const inst = await prisma.institution.findUnique({ where: { email } })
  if (!inst) throw new Error(`Test institution ${email} not found`)
  return inst.id
}

async function createDummyVerification(institutionId: string) {
  const emp = await prisma.employer.findFirst({
    where: { institutionId: null },
    select: { id: true },
  })
  if (!emp) throw new Error("No non-linked employer found in seed")

  return prisma.verificationRequest.create({
    data: {
      employerId: emp.id,
      institutionId,
      matricNumber: "TEST/2024/001",
      claimType: 1,
      status: "PENDING",
    },
  })
}

describe("EarningsService.creditVerification", () => {
  it("credits institution with 20% and gas pool with 10% of $1.50 verification", async () => {
    const instId = await getInstId(INST_EMAIL_CREDIT)
    const v = await createDummyVerification(instId)

    await earningsSvc.creditVerification(instId, v.id, 1.5, "1500000000000000", false)

    const summary = await earningsSvc.getInstitutionSummary(instId)
    expect(summary.totalEarnedUsd).toBeCloseTo(0.3, 4)
    expect(summary.availableUsd).toBeCloseTo(0.3, 4)

    const pool = await earningsSvc.getGasPoolSummary()
    expect(pool.totalDepositedUsd).toBeGreaterThanOrEqual(0.15)
  })

  it("does nothing for free verifications", async () => {
    const instId = await getInstId(INST_EMAIL_CREDIT)
    const before = await earningsSvc.getInstitutionSummary(instId)
    await earningsSvc.creditVerification(instId, "free-test", 1.5, "1500000000000000", true)
    const after = await earningsSvc.getInstitutionSummary(instId)
    expect(after.totalEarnedUsd).toBeCloseTo(before.totalEarnedUsd, 4)
  })
})

describe("EarningsService.getInstitutionSummary", () => {
  it("returns a summary with payoutWallet as null by default", async () => {
    const instId = await getInstId(INST_EMAIL_WITHDRAW)
    const summary = await earningsSvc.getInstitutionSummary(instId)
    expect(summary.totalEarnedUsd).toBe(0)
    expect(summary.availableUsd).toBe(0)
    expect(summary.payoutWallet).toBeNull()
  })
})

describe("EarningsService.setPayoutWallet", () => {
  it("updates and returns the payout wallet address", async () => {
    const instId = await getInstId(INST_EMAIL_WITHDRAW)
    await earningsSvc.setPayoutWallet(instId, "0x1234567890abcdef1234567890abcdef12345678")
    const summary = await earningsSvc.getInstitutionSummary(instId)
    expect(summary.payoutWallet).toBe("0x1234567890abcdef1234567890abcdef12345678")
  })
})

describe("EarningsService.listTransactions", () => {
  it("returns an empty list for an institution with no earnings", async () => {
    const instId = await getInstId(INST_EMAIL_WITHDRAW)
    const result = await earningsSvc.listTransactions(instId)
    expect(result.total).toBe(0)
  })
})

describe("EarningsService.getGasPoolSummary", () => {
  it("returns a pool summary with availableUsd >= 0", async () => {
    const summary = await earningsSvc.getGasPoolSummary()
    expect(summary.availableUsd).toBeGreaterThanOrEqual(0)
  })
})

describe("EarningsService.requestWithdrawal — FIAT error paths", () => {
  it("rejects withdrawal below $10 minimum", async () => {
    const instId = await getInstId(INST_EMAIL_WITHDRAW)
    await expect(
      earningsSvc.requestWithdrawal(instId, 5, "FIAT")
    ).rejects.toThrow("Minimum withdrawal is $10")
  })

  it("rejects withdrawal exceeding available balance", async () => {
    const instId = await getInstId(INST_EMAIL_WITHDRAW)
    await expect(
      earningsSvc.requestWithdrawal(instId, 999999, "FIAT")
    ).rejects.toThrow(/Insufficient balance/)
  })

  it("processes a FIAT withdrawal successfully when balance is sufficient", async () => {
    const instId = await getInstId(INST_EMAIL_WITHDRAW)
    // Credit enough balance first
    await earningsSvc.creditVerification(instId, "test-fiat-credit", 100, "100000000000000000", false)
    const before = await earningsSvc.getInstitutionSummary(instId)

    const result = await earningsSvc.requestWithdrawal(instId, 10, "FIAT")
    expect(result.status).toBe("PENDING")

    const after = await earningsSvc.getInstitutionSummary(instId)
    expect(after.availableUsd).toBeCloseTo(before.availableUsd - 10, 4)
  })
})

describe("EarningsService.requestWithdrawal — CRYPTO error paths", () => {
  it("rejects crypto withdrawal without payout wallet", async () => {
    const instId = await getInstId(INST_EMAIL_WITHDRAW)
    // Make sure wallet is cleared
    const summary = await earningsSvc.getInstitutionSummary(instId)
    if (summary.payoutWallet) {
      const earnings = await prisma.institutionEarnings.findUnique({ where: { institutionId: instId } })
      if (earnings) {
        await prisma.institutionEarnings.update({ where: { id: earnings.id }, data: { payoutWallet: null } })
      }
    }
    await expect(
      earningsSvc.requestWithdrawal(instId, 10, "CRYPTO")
    ).rejects.toThrow("No payout wallet set")
  })
})

describe("EarningsService.getPlatformEarnings", () => {
  it("returns aggregated platform earnings", async () => {
    const result = await earningsSvc.getPlatformEarnings()
    expect(result.totalEarnedUsd).toBeGreaterThanOrEqual(0)
    expect(result.pool).toBeDefined()
    expect(result.institutionEarnings).toBeDefined()
  })
})

describe("EarningsService.listAllInstitutionEarnings", () => {
  it("returns a paginated list of institution earnings", async () => {
    const result = await earningsSvc.listAllInstitutionEarnings()
    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(result.items)).toBe(true)
  })
})

describe("EarningsService.processFiatWithdrawal", () => {
  it("rejects approval of nonexistent transaction", async () => {
    await expect(
      earningsSvc.processFiatWithdrawal("nonexistent-id", true)
    ).rejects.toThrow("Transaction not found")
  })
})
