/**
 * VerificationService unit tests.
 *
 * Uses the seeded institution (futminna) and employer (firstbank) from
 * prisma/seed.ts. The BlockchainService is replaced by the mock so no
 * real RPC calls are made.
 *
 * ProofService is also mocked because the circuit WASM/zkey files are not
 * available in the CI environment.
 */

import { PrismaClient } from "@prisma/client"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { VerificationService } from "../services/verification.service.js"
import { encrypt } from "../utils/crypto.js"
import { hashToField } from "../utils/field.js"
import { BlockchainService } from "./mocks/blockchain.service.js"

// Mock ProofService so we never touch the circuit files in tests
vi.mock("../services/proof.service.js", () => ({
  ProofService: class {
    async generateProof() {
      return {
        proof: {
          pi_a: ["1", "2"],
          pi_b: [["3", "4"], ["5", "6"]],
          pi_c: ["7", "8"],
        },
        publicSignals: ["1", "2", "3", "4"],
      }
    }
    async verifyProofLocally() {
      return true
    }
  },
}))

let prisma: PrismaClient
let verifySvc: VerificationService
let institutionId: string
let employerId: string
let institutionOnChainId: string

beforeAll(async () => {
  prisma = new PrismaClient()

  const inst = await prisma.institution.findUnique({
    where: { email: "futminna@veridaq.xyz" },
    select: { id: true, onChainId: true },
  })
  if (!inst) throw new Error("Seed institution not found — run pnpm db:seed first")
  institutionId = inst.id
  institutionOnChainId = inst.onChainId

  const emp = await prisma.employer.findUnique({
    where: { email: "firstbank@veridaq.xyz" },
    select: { id: true },
  })
  if (!emp) throw new Error("Seed employer not found — run pnpm db:seed first")
  employerId = emp.id

  const mockBlockchain = new BlockchainService() as unknown as import("../services/blockchain.service.js").BlockchainService
  verifySvc = new VerificationService(prisma, mockBlockchain)
})

describe("VerificationService.getActiveInstitutions", () => {
  it("returns the seeded institution with its claim definitions", async () => {
    const insts = await verifySvc.getActiveInstitutions()
    expect(Array.isArray(insts)).toBe(true)
    const futminna = insts.find((i) => i.id === institutionId)
    expect(futminna).toBeDefined()
    expect(futminna?.claims.length).toBeGreaterThan(0)
  })
})

describe("VerificationService.createRequest — error paths", () => {
  it("returns NOT_FOUND for an unknown institution on-chain ID", async () => {
    const result = await verifySvc.createRequest({
      employerId,
      institutionOnChainId: "0x" + "0".repeat(64),
      matricNumber: "FUT/2020/CS/001",
      claimType: 1,
      threshold: 0,
    })
    expect(result.error).toBe("NOT_FOUND")
  })

  it("returns NOT_FOUND when the matric number has no matching credential", async () => {
    const result = await verifySvc.createRequest({
      employerId,
      institutionOnChainId,
      matricNumber: "NONEXISTENT/9999/XX/999",
      claimType: 1,
      threshold: 0,
    })
    expect(result.error).toBe("NOT_FOUND")
  })
})

describe("VerificationService.createRequest — with a real credential", () => {
  let credentialNullifier: string

  beforeAll(async () => {
    // Insert a synthetic credential so we can test the happy path without
    // running the full batch processor.
    const matricNumber = "TEST/2024/CS/001"
    const matricHash = hashToField(matricNumber).toString()

    const plaintext = JSON.stringify({
      nameHash: hashToField("Test Student").toString(),
      matricHash,
      cgpa: 420,
      classification: 3,
      courseHash: hashToField("Computer Science").toString(),
      graduationYear: 2024,
      blindingFactor: "123456789",
    })

    const { encryptedData, encryptedIv, encryptedTag } = encrypt(plaintext)

    // Use a deterministic commitment/nullifier for the test
    const commitment = "0x" + "ab".repeat(32)
    const nullifier = "0x" + "cd".repeat(32)
    credentialNullifier = nullifier

    // Find or create a batch to attach the credential to
    let batch = await prisma.batch.findFirst({ where: { institutionId } })
    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          institutionId,
          status: "CONFIRMED",
          studentCount: 1,
          graduationYear: 2024,
        },
      })
    }

    await prisma.credential.upsert({
      where: { nullifier },
      update: {},
      create: {
        batchId: batch.id,
        institutionId,
        commitment,
        nullifier,
        encryptedData,
        encryptedIv,
        encryptedTag,
        graduationYear: 2024,
        status: "ACTIVE",
      },
    })
  })

  it("creates a PROCESSING request for an AUTO claim", async () => {
    const result = await verifySvc.createRequest({
      employerId,
      institutionOnChainId,
      matricNumber: "TEST/2024/CS/001",
      claimType: 1, // Programme completion — AUTO by default in seed
      threshold: 0,
    })

    // Should succeed (no error key)
    expect("error" in result).toBe(false)
    if ("requestId" in result) {
      expect(result.requestId).toBeTruthy()
      expect(["PROCESSING", "AWAITING_INSTITUTION"]).toContain(result.status)

      // Clean up
      await prisma.verificationRequest.delete({ where: { id: result.requestId } })
    }
  })

  it("returns REVOKED when the credential is revoked in the database", async () => {
    // Mark the credential as revoked
    await prisma.credential.update({
      where: { nullifier: credentialNullifier },
      data: { status: "REVOKED" },
    })

    const result = await verifySvc.createRequest({
      employerId,
      institutionOnChainId,
      matricNumber: "TEST/2024/CS/001",
      claimType: 1,
      threshold: 0,
    })

    expect(result.error).toBe("REVOKED")

    // Restore
    await prisma.credential.update({
      where: { nullifier: credentialNullifier },
      data: { status: "ACTIVE" },
    })
  })
})

describe("VerificationService.getHistory", () => {
  it("returns a paginated list for the employer", async () => {
    const result = await verifySvc.getHistory(employerId, 1, 10)
    expect(typeof result.total).toBe("number")
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(10)
  })
})
