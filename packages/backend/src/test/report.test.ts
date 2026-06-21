import { PrismaClient } from "@prisma/client"
import { beforeAll, describe, expect, it } from "vitest"
import { ReportService } from "../services/report.service.js"

let prisma: PrismaClient
let reportSvc: ReportService
let employerId: string

beforeAll(async () => {
  prisma = new PrismaClient()
  reportSvc = new ReportService(prisma)

  const inst = await prisma.institution.findUnique({
    where: { email: "futminna@veridaq.xyz" },
    select: { id: true },
  })
  if (!inst) throw new Error("Seed institution not found")

  const emp = await prisma.employer.findUnique({
    where: { email: "firstbank@veridaq.xyz" },
    select: { id: true },
  })
  if (!emp) throw new Error("Seed employer not found")
  employerId = emp.id
})

describe("ReportService.buildVerificationReport", () => {
  it("returns NOT_FOUND for a non-existent request", async () => {
    const result = await reportSvc.buildVerificationReport("nonexistent-id", employerId)
    expect(result.error).toBe("NOT_FOUND")
  })

  it("returns NOT_READY for a PROCESSING request", async () => {
    const req = await prisma.verificationRequest.findFirst({
      where: { status: "PROCESSING" },
    })
    if (!req) return // skip if no PROCESSING request exists
    const result = await reportSvc.buildVerificationReport(req.id, employerId)
    expect(result.error).toBe("NOT_READY")
  })

  it("returns a PDF buffer for a COMPLETED VERIFIED request", async () => {
    const req = await prisma.verificationRequest.findFirst({
      where: { status: "COMPLETED", result: "VERIFIED" },
    })
    if (!req) return // skip if no completed request exists
    const result = await reportSvc.buildVerificationReport(req.id, employerId)
    expect(result.error).toBeUndefined()
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect((result.buffer as Buffer).length).toBeGreaterThan(1000)
    // Verify it starts with PDF magic bytes
    expect((result.buffer as Buffer)[0]).toBe(0x25) // '%'
    expect((result.buffer as Buffer)[1]).toBe(0x50) // 'P'
    expect((result.buffer as Buffer)[2]).toBe(0x44) // 'D'
    expect((result.buffer as Buffer)[3]).toBe(0x46) // 'F'
  })
})
