/**
 * Database seed script.
 * Creates only the default admin so the user can test the full flow
 * (register institution, KYC approval, batch upload) from scratch.
 *
 * Credentials (development only — change before any deployment):
 *   Admin: admin@veridaq.xyz / Admin2026!@#
 *
 * Run with: pnpm db:seed
 */

import { PrismaClient } from "@prisma/client"
import bcryptjs from "bcryptjs"

const prisma = new PrismaClient()
const COST = 12

async function main() {
  console.info("Seeding database...")

  // ── Admin only ────────────────────────────────────────────────────────
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
  console.info("Seed complete.")
}

main()
  .catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
