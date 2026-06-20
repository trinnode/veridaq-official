/**
 * Database seed script.
 * Creates the default admin, one institution (FUTMINNA), one employer (FirstBank),
 * and pre-seeded claim definitions (both manual and auto).
 *
 * Credentials (development only — change before any deployment):
 *   Admin:       admin@veridaq.xyz    / Admin2026!@#
 *   Institution: futminna@veridaq.xyz / Inst@2026!
 *   Employer:    firstbank@veridaq.xyz / Emp@2026!
 *
 * Run with: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client"
import bcryptjs from "bcryptjs"
import crypto from "crypto"
import { privateKeyToAccount } from "viem/accounts"

const prisma = new PrismaClient()
const COST = 12

function bytes32FromUUID(uuid: string): string {
  const hex = uuid.replace(/-/g, "")
  return `0x${hex.padEnd(64, "0")}` as `0x${string}`
}

async function main() {
  console.info("Seeding database...")

  // ── Admin ──────────────────────────────────────────────────────────────
  const adminHash = await bcryptjs.hash("Admin2026!@#", COST)
  await prisma.admin.upsert({
    where: { email: "admin@veridaq.xyz" },
    update: { passwordHash: adminHash },
    create: {
      email: "admin@veridaq.xyz",
      passwordHash: adminHash,
      name: "VERIDAQ ADMIN",
    },
  })
  console.info("Seeded: admin@veridaq.xyz / Admin2026!@#")

  // ── Institution: FUTMINNA ─────────────────────────────────────────────
  const instPk = "0x" + crypto.randomBytes(32).toString("hex")
  const instAccount = privateKeyToAccount(instPk as `0x${string}`)
  const instId = "institution-futminna-001"
  const instOnChainId = bytes32FromUUID(instId)

  const instHash = await bcryptjs.hash("Inst@2026!", COST)
  const inst = await prisma.institution.upsert({
    where: { email: "futminna@veridaq.xyz" },
    update: { passwordHash: instHash },
    create: {
      id: instId,
      onChainId: instOnChainId,
      name: "Federal University of Technology, Minna",
      email: "futminna@veridaq.xyz",
      passwordHash: instHash,
      publicKey: instAccount.address,
      adminWallet: instAccount.address,
      adminKeyEncrypted: "seed-generated",
      adminKeyIv: "seed-generated",
      adminKeyTag: "seed-generated",
      institutionKeyEncrypted: "seed-generated",
      institutionKeyIv: "seed-generated",
      institutionKeyTag: "seed-generated",
      tier: "PAID",
      kycApproved: true,
      active: true,
      blockchainStatus: "REGISTERED",
      paymasterBalance: "50000000000000000", // 0.05 ETH
      alsoEmployer: true,
    },
  })
  console.info("Seeded: futminna@veridaq.xyz / Inst@2026! (PAID, KYC approved)")

  // ── Employer profile for FUTMINNA (institution-as-employer) ────────────
  const empPk = "0x" + crypto.randomBytes(32).toString("hex")
  const empAccount = privateKeyToAccount(empPk as `0x${string}`)
  const empId = "employer-futminna-001"

  await prisma.employer.upsert({
    where: { email: "futminna-employer@veridaq.xyz" },
    update: {},
    create: {
      id: empId,
      name: "FUTMINNA Admissions",
      cacNumber: "RC-FUT-2024-001",
      email: "futminna-employer@veridaq.xyz",
      passwordHash: instHash, // same password as institution
      walletAddress: empAccount.address,
      kycApproved: true,
      active: true,
      freeVerificationsRemaining: 3,
      verificationCredits: 10,
      institutionId: instId,
    },
  })
  console.info("Seeded: employer profile for FUTMINNA (institution-as-employer)")

  // ── Employer: FirstBank ───────────────────────────────────────────────
  const fbPk = "0x" + crypto.randomBytes(32).toString("hex")
  const fbAccount = privateKeyToAccount(fbPk as `0x${string}`)

  const fbHash = await bcryptjs.hash("Emp@2026!", COST)
  await prisma.employer.upsert({
    where: { email: "firstbank@veridaq.xyz" },
    update: { passwordHash: fbHash },
    create: {
      name: "First Bank of Nigeria PLC",
      cacNumber: "RC-FBN-1894-001",
      email: "firstbank@veridaq.xyz",
      passwordHash: fbHash,
      walletAddress: fbAccount.address,
      kycApproved: true,
      active: true,
      freeVerificationsRemaining: 3,
      verificationCredits: 50,
    },
  })
  console.info("Seeded: firstbank@veridaq.xyz / Emp@2026! (KYC approved, 50 credits)")

  // ── Claim Definitions (pre-seeded for FUTMINNA) ───────────────────────
  const claimDefs = [
    { label: "Student graduated (auto)", claimCode: 1, threshold: 0, reviewType: "AUTO" as const, description: "Verify that the student graduated from this institution" },
    { label: "CGPA ≥ 2.0 (auto)", claimCode: 5, threshold: 200, reviewType: "AUTO" as const, description: "Verify CGPA is at least 2.0 (Second Class Lower minimum)" },
    { label: "CGPA ≥ 3.0 (auto)", claimCode: 5, threshold: 300, reviewType: "AUTO" as const, description: "Verify CGPA is at least 3.0 (Second Class Upper minimum)" },
    { label: "CGPA ≥ 3.5 (auto)", claimCode: 5, threshold: 350, reviewType: "AUTO" as const, description: "Verify CGPA is at least 3.5 (First Class minimum)" },
    { label: "Graduation year (auto)", claimCode: 3, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student's graduation year" },
    { label: "Course of study (auto)", claimCode: 4, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student's course of study" },
    { label: "Manual KYC review", claimCode: 2, threshold: 0, reviewType: "MANUAL" as const, description: "Requires institution to manually verify the student's identity and status" },
    { label: "CGPA ≥ 4.0 (manual review)", claimCode: 5, threshold: 400, reviewType: "MANUAL" as const, description: "Verify CGPA is at least 4.0 — requires manual institution confirmation" },
  ]

  for (const cd of claimDefs) {
    await prisma.claimDefinition.upsert({
      where: {
        institutionId_claimCode_threshold: {
          institutionId: instId,
          claimCode: cd.claimCode,
          threshold: cd.threshold,
        },
      },
      update: { label: cd.label, reviewType: cd.reviewType, description: cd.description },
      create: {
        institutionId: instId,
        label: cd.label,
        claimCode: cd.claimCode,
        threshold: cd.threshold,
        reviewType: cd.reviewType,
        description: cd.description,
        active: true,
      },
    })
  }
  console.info("Seeded: 8 claim definitions (6 auto + 2 manual)")
  console.info("Seed complete.")
}

main()
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
