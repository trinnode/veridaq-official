/**
 * Create a mock VERIFIED verification request for testing PDF download.
 * Run: npx tsx packages/backend/src/scripts/mock-verified.ts
 */
import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const prisma = new PrismaClient()

async function main() {
  const employer = await prisma.employer.findFirst({ where: { email: "firstbank@veridaq.xyz" } })
  const institution = await prisma.institution.findFirst({ where: { email: "futminna@veridaq.xyz" } })
  const credential = await prisma.credential.findFirst({ where: { institutionId: institution?.id } })

  if (!employer || !institution || !credential) {
    console.error("Missing seed data")
    process.exit(1)
  }

  const existing = await prisma.verificationRequest.findFirst({
    where: { status: "COMPLETED", result: "VERIFIED" },
  })
  if (existing) {
    console.log(`Already have a verified request: ${existing.id.slice(0, 20)}...`)
    console.log(`Report download URL: /api/verify/report/${existing.id}`)
    await prisma.$disconnect()
    return
  }

  const req = await prisma.verificationRequest.create({
    data: {
      employerId: employer.id,
      institutionId: institution.id,
      credentialId: credential.id,
      matricNumber: "FUT/MIN/2020/001",
      claimType: 1,
      threshold: 0,
      status: "COMPLETED",
      result: "VERIFIED",
      proofJson: JSON.stringify({
        proof: { pi_a: ["1", "2"], pi_b: [["1", "2"], ["3", "4"]], pi_c: ["5", "6"] },
        publicSignals: ["0x01", "0x02", "0x03", "0x04"],
      }),
      txHash: "0x" + "a".repeat(64),
      completedAt: new Date(),
      createdAt: new Date(Date.now() - 60000),
    },
  })

  console.log(`Created verified request: ${req.id}`)
  console.log(`Report download URL: /api/verify/report/${req.id}`)
  console.log(`Frontend download URL: http://localhost:3000/employer/history`)

  await prisma.$disconnect()
}

main().catch((err) => { console.error(err); process.exit(1) })
