import { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { spendFreeVerification, spendPaidCredit } from "../services/credit.service.js"

let prisma: PrismaClient
const EMP_EMAIL = "credit-race-test@veridaq.xyz"
let employerId: string

beforeAll(async () => {
  prisma = new PrismaClient()
  const existing = await prisma.employer.findUnique({ where: { email: EMP_EMAIL } })
  if (existing) {
    await prisma.employer.delete({ where: { id: existing.id } })
  }
  const emp = await prisma.employer.create({
    data: {
      name: "Credit Race Test",
      cacNumber: "RC-CREDIT-RACE-001",
      email: EMP_EMAIL,
      passwordHash: "test-hash",
      walletAddress: "0x00000000000000000000000000000000000000aa",
      kycApproved: true,
      active: true,
      freeVerificationsRemaining: 1,
      verificationCredits: 1,
    },
  })
  employerId = emp.id
})

afterAll(async () => {
  await prisma.employer.delete({ where: { id: employerId } }).catch(() => {})
  await prisma.$disconnect()
})

describe("verification credit spending", () => {
  it("lets only one of two concurrent requests spend the last paid credit", async () => {
    const results = await Promise.all([
      spendPaidCredit(prisma, employerId),
      spendPaidCredit(prisma, employerId),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)

    const emp = await prisma.employer.findUnique({ where: { id: employerId } })
    expect(emp?.verificationCredits).toBe(0)
  })

  it("lets only one of two concurrent requests spend the last free check", async () => {
    const results = await Promise.all([
      spendFreeVerification(prisma, employerId),
      spendFreeVerification(prisma, employerId),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)

    const emp = await prisma.employer.findUnique({ where: { id: employerId } })
    expect(emp?.freeVerificationsRemaining).toBe(0)
  })

  it("refuses to spend when the balance is already zero", async () => {
    expect(await spendPaidCredit(prisma, employerId)).toBe(false)
    expect(await spendFreeVerification(prisma, employerId)).toBe(false)
  })
})
