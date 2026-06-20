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

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import bcryptjs from "bcryptjs"
import crypto from "crypto"
import { createCipheriv } from "crypto"
import { privateKeyToAccount } from "viem/accounts"

const prisma = new PrismaClient()
const COST = 12

const ALGORITHM = "aes-256-gcm"
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || "0".repeat(64), "hex")

function encryptValue(plaintext: string): { encryptedData: string; encryptedIv: string; encryptedTag: string } {
  const iv = crypto.randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return {
    encryptedData: encrypted.toString("hex"),
    encryptedIv: iv.toString("hex"),
    encryptedTag: cipher.getAuthTag().toString("hex"),
  }
}

function bytes32FromName(name: string): string {
  const hex = crypto.createHash("sha256").update(name).digest("hex")
  return `0x${hex}` as `0x${string}`
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
  const instOnChainId = bytes32FromName("Federal University of Technology, Minna")

  const adminPk = "0x" + crypto.randomBytes(32).toString("hex")
  const adminKeyEnc = encryptValue(adminPk.slice(2))
  const institutionKeyRaw = crypto.randomBytes(32).toString("hex")
  const institutionKeyEnc = encryptValue(institutionKeyRaw)

  const instHash = await bcryptjs.hash("Inst@2026!", COST)
  const inst = await prisma.institution.upsert({
    where: { email: "futminna@veridaq.xyz" },
    update: {
      passwordHash: instHash,
      onChainId: instOnChainId,
      adminWallet: instAccount.address,
      adminKeyEncrypted: adminKeyEnc.encryptedData,
      adminKeyIv: adminKeyEnc.encryptedIv,
      adminKeyTag: adminKeyEnc.encryptedTag,
      institutionKeyEncrypted: institutionKeyEnc.encryptedData,
      institutionKeyIv: institutionKeyEnc.encryptedIv,
      institutionKeyTag: institutionKeyEnc.encryptedTag,
    },
    create: {
      id: instId,
      onChainId: instOnChainId,
      name: "Federal University of Technology, Minna",
      email: "futminna@veridaq.xyz",
      passwordHash: instHash,
      publicKey: instAccount.address,
      adminWallet: instAccount.address,
      adminKeyEncrypted: adminKeyEnc.encryptedData,
      adminKeyIv: adminKeyEnc.encryptedIv,
      adminKeyTag: adminKeyEnc.encryptedTag,
      institutionKeyEncrypted: institutionKeyEnc.encryptedData,
      institutionKeyIv: institutionKeyEnc.encryptedIv,
      institutionKeyTag: institutionKeyEnc.encryptedTag,
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
  // These map 1:1 to the 6 circuit claim types in credential.circom:
  //   1 = Programme completion (year 1960-2030)
  //   2 = Minimum Lower Second Class (classification >= 2)
  //   3 = Minimum Upper Second Class (classification >= 3)
  //   4 = First Class (classification == 4)
  //   5 = CGPA above threshold (employer specifies threshold)
  //   6 = Programme-specific completion (course + year valid)
  const claimDefs = [
    { label: "Programme Completion", claimCode: 1, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student graduated in a valid year (1960–2030)" },
    { label: "Minimum Lower Second Class", claimCode: 2, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved at least Second Class Lower (classification ≥ 2)" },
    { label: "Minimum Upper Second Class", claimCode: 3, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved at least Second Class Upper (classification ≥ 3)" },
    { label: "First Class Honours", claimCode: 4, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved First Class (classification == 4)" },
    { label: "CGPA Above Threshold", claimCode: 5, threshold: 350, reviewType: "AUTO" as const, description: "Verify CGPA meets a minimum threshold (employer sets the value)" },
    { label: "Programme-Specific Completion", claimCode: 6, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student completed a specific programme of study" },
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
  console.info(`Seeded: ${claimDefs.length} claim definitions`)
  console.info("Seed complete.")
}

main()
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
