/**
 * Mock BlockchainService for unit tests.
 *
 * Every method returns a safe default so tests never attempt real RPC calls.
 * Individual tests can override methods with vi.spyOn() or by subclassing.
 */
import type { Address, Hash } from "viem"

export class BlockchainService {
  // ── Institution ────────────────────────────────────────────────────────────
  async registerInstitution(
    _institutionId: `0x${string}`,
    _name: string,
    _adminWallet: Address,
    _publicKey: string
  ): Promise<Hash> {
    return "0xmocktxhash" as Hash
  }

  async isInstitutionRegistered(_institutionId: `0x${string}`): Promise<boolean> {
    return false
  }

  async getInstitutionTier(_institutionId: `0x${string}`): Promise<number> {
    return 0 // FREE
  }

  async setInstitutionTier(_institutionId: `0x${string}`, _tier: "FREE" | "PAID"): Promise<Hash> {
    return "0xmocktxhash" as Hash
  }

  // ── Batch ──────────────────────────────────────────────────────────────────
  async registerBatch(
    _institutionId: `0x${string}`,
    _commitments: `0x${string}`[],
    _nullifiers: `0x${string}`[],
    _graduationYear: number,
    _degreeTypeCode: number,
    _txRef: `0x${string}`
  ): Promise<{ txHash: Hash }> {
    return { txHash: "0xmocktxhash" as Hash }
  }

  async registerBatchWithPaymaster(
    _institutionId: `0x${string}`,
    _commitments: `0x${string}`[],
    _nullifiers: `0x${string}`[],
    _graduationYear: number,
    _degreeTypeCode: number,
    _txRef: `0x${string}`
  ): Promise<{ txHash: Hash; userOpHash: Hash }> {
    return { txHash: "0xmocktxhash" as Hash, userOpHash: "0xmockuophash" as Hash }
  }

  // ── Credential ─────────────────────────────────────────────────────────────
  async commitmentExists(_commitment: bigint): Promise<boolean> {
    return false
  }

  async nullifierExists(_nullifier: bigint): Promise<boolean> {
    return false
  }

  async revokeCredential(_nullifier: bigint, _reasonCode: number): Promise<Hash> {
    return "0xmocktxhash" as Hash
  }

  async isRevoked(_nullifier: bigint): Promise<boolean> {
    return false
  }

  // ── Verification ───────────────────────────────────────────────────────────
  async verifyProof(
    _a: [bigint, bigint],
    _b: [[bigint, bigint], [bigint, bigint]],
    _c: [bigint, bigint],
    _publicInputs: [bigint, bigint, bigint, bigint]
  ): Promise<boolean> {
    return true
  }

  // ── Employer ───────────────────────────────────────────────────────────────
  async initialiseEmployer(_employerAddress: Address): Promise<Hash> {
    return "0xmocktxhash" as Hash
  }

  async consumeFreeVerification(_employerAddress: Address): Promise<Hash> {
    return "0xmocktxhash" as Hash
  }

  async isEmployerInitialised(_employerAddress: Address): Promise<boolean> {
    return false
  }

  async getRemainingFreeVerifications(_employerAddress: Address): Promise<number> {
    return 3
  }

  // ── Paymaster ──────────────────────────────────────────────────────────────
  async getBalance(_address: Address): Promise<bigint> {
    return 1_000_000_000_000_000_000n // 1 ETH
  }

  async getPaymasterInstitutionBalance(_institutionId: `0x${string}`): Promise<bigint> {
    return 500_000_000_000_000_000n // 0.5 ETH
  }

  async getPaymasterSponsoredPool(): Promise<bigint> {
    return 2_000_000_000_000_000_000n // 2 ETH
  }

  async getPaymasterEntryPointDeposit(): Promise<bigint> {
    return 1_000_000_000_000_000_000n // 1 ETH
  }

  async fundInstitutionPaymaster(
    _institutionId: `0x${string}`,
    _amountWei: bigint
  ): Promise<Hash> {
    return "0xmocktxhash" as Hash
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  static uuidToBytes32(uuid: string): `0x${string}` {
    const hex = uuid.replace(/-/g, "").padStart(64, "0")
    return `0x${hex}`
  }
}
