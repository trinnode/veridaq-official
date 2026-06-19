/**
 * BlockchainService — thin wrapper around viem for all on-chain reads and writes.
 *
 * We use viem's walletClient for signed transactions and publicClient for reads.
 * Every method is async and returns plain objects so callers don't need to know
 * anything about viem's internals.
 *
 * Important: the private key for the VERIDAQ Admin wallet is read from config
 * at construction time. It is never logged, never sent to the client, and never
 * written to the database. If config is missing, the constructor throws so the
 * server fails loudly at startup rather than silently sending unsigned txs.
 */

import {
    concatHex,
    createPublicClient,
    createWalletClient,
    encodeAbiParameters,
    encodeFunctionData,
    formatEther,
    http,
    parseGwei,
    toHex,
    type Address,
    type Hash,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { config } from "../config/index.js"
import pino from "pino"

const log = pino({ name: "blockchain-service" })

// ─── ABI fragments ────────────────────────────────────────────────────────────
// We only include what we actually call. Full ABIs live in the contracts package.

const institutionRegistryAbi = [
  {
    name: "registerInstitution",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institutionId", type: "bytes32" },
      { name: "name", type: "string" },
      { name: "adminWallet", type: "address" },
      { name: "publicKey", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "getInstitution",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "institutionId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "bytes32" },
          { name: "name", type: "string" },
          { name: "adminWallet", type: "address" },
          { name: "publicKey", type: "bytes" },
          { name: "active", type: "bool" },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "InstitutionRegistered",
    type: "event",
    inputs: [
      { name: "institutionId", type: "bytes32", indexed: true },
      { name: "name", type: "string", indexed: false },
    ],
  },
] as const

const credentialRegistryAbi = [
  {
    name: "registerBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institutionId", type: "bytes32" },
      { name: "commitments", type: "bytes32[]" },
      { name: "nullifiers", type: "bytes32[]" },
      { name: "graduationYear", type: "uint16" },
      { name: "degreeTypeCode", type: "uint8" },
      { name: "txRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "exists",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getNullifierForCommitment",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "BatchRegistered",
    type: "event",
    inputs: [
      { name: "institutionId", type: "bytes32", indexed: true },
      { name: "count", type: "uint256", indexed: false },
      { name: "graduationYear", type: "uint16", indexed: false },
      { name: "txRef", type: "bytes32", indexed: false },
    ],
  },
] as const

const revocationRegistryAbi = [
  {
    name: "revokeCredential",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nullifier", type: "bytes32" },
      { name: "reasonCode", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "isRevoked",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const

const subscriptionManagerAbi = [
  {
    name: "setInstitutionTier",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institutionId", type: "bytes32" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "institutionTiers",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "institutionId", type: "bytes32" }],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "initialiseEmployer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "employer", type: "address" }],
    outputs: [],
  },
  {
    name: "consumeFreeVerification",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "employer", type: "address" }],
    outputs: [],
  },
  {
    name: "freeVerificationsRemaining",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "employer", type: "address" }],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "isEmployerInitialised",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "employer", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const

const verifierAbi = [
  {
    name: "verifyProof",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "a", type: "uint256[2]" },
      { name: "b", type: "uint256[2][2]" },
      { name: "c", type: "uint256[2]" },
      { name: "input", type: "uint256[4]" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const

const entryPointAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getUserOpHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const

const paymasterVaultAbi = [
  {
    name: "fundSponsoredPool",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "fundInstitution",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "institutionId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "institutionBalances",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "institutionId", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "sponsoredPool",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "withdrawInstitutionBalance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "institutionId", type: "bytes32" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "institutionRegistry", type: "address" },
    ],
    outputs: [],
  },
] as const

const simpleAccountAbi = [
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
    outputs: [],
  },
] as const

const simpleAccountFactoryAbi = [
  {
    name: "getAddress",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ type: "address" }],
  },
  {
    name: "createAccount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ type: "address" }],
  },
] as const

type UserOperation = {
  sender: Address
  nonce: bigint
  initCode: `0x${string}`
  callData: `0x${string}`
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: `0x${string}`
  signature: `0x${string}`
}

const ZERO_BYTES32 = "0x" + "0".repeat(64)

// ─── Client setup ─────────────────────────────────────────────────────────────

function buildClients() {
  const rawKey = config.PLATFORM_ADMIN_PRIVATE_KEY
  if (!rawKey) throw new Error("PLATFORM_ADMIN_PRIVATE_KEY is not set")

  // viem expects the private key to start with 0x
  const key = rawKey.startsWith("0x") ? (rawKey as `0x${string}`) : (`0x${rawKey}` as `0x${string}`)
  const account = privateKeyToAccount(key)

  // Increase timeout from default 60s to 120s for slow Base Sepolia blocks
  const transport = http(config.ALCHEMY_BASE_SEPOLIA_URL, { timeout: 120_000 })

  const publicClient = createPublicClient({ chain: baseSepolia, transport })
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport })

  return { publicClient, walletClient, account }
}

function buildAaAccount() {
  const rawKey = config.AA_SIMPLE_ACCOUNT_OWNER_PRIVATE_KEY ?? config.PLATFORM_ADMIN_PRIVATE_KEY
  if (!rawKey) throw new Error("AA_SIMPLE_ACCOUNT_OWNER_PRIVATE_KEY is not set")
  const key = rawKey.startsWith("0x") ? (rawKey as `0x${string}`) : (`0x${rawKey}` as `0x${string}`)
  return privateKeyToAccount(key)
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BlockchainService {
  private publicClient
  private walletClient
  private account
  private aaAccount

  private static bigintToBytes32(value: bigint): `0x${string}` {
    return `0x${value.toString(16).padStart(64, "0")}` as `0x${string}`
  }

  constructor() {
    const clients = buildClients()
    this.publicClient = clients.publicClient
    this.walletClient = clients.walletClient
    this.account = clients.account
    this.aaAccount = buildAaAccount()
  }

  private isAaEnabled(): boolean {
    return Boolean(
      config.BUNDLER_RPC_URL &&
      config.PAYMASTER_VAULT_ADDRESS &&
      config.AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS
    )
  }

  private getBundlerUrl(): string {
    if (!config.BUNDLER_RPC_URL) throw new Error("BUNDLER_RPC_URL is not set")
    return config.BUNDLER_RPC_URL
  }

  private getSimpleAccountFactoryAddress(): Address {
    if (!config.AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS) {
      throw new Error("AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS is not set")
    }
    return config.AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS as Address
  }

  private getPaymasterAddress(): Address {
    if (!config.PAYMASTER_VAULT_ADDRESS) throw new Error("PAYMASTER_VAULT_ADDRESS is not set")
    return config.PAYMASTER_VAULT_ADDRESS as Address
  }

  private getSimpleAccountSalt(): bigint {
    return BigInt(config.AA_SIMPLE_ACCOUNT_SALT ?? 0)
  }

  private async callBundler<T>(method: string, params: unknown[]): Promise<T> {
    const res = await fetch(this.getBundlerUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })
    if (!res.ok) {
      throw new Error(`Bundler HTTP error ${res.status}`)
    }
    const payload = (await res.json()) as {
      result?: T
      error?: { message?: string; data?: string; code?: number }
    }
    if (payload.error) {
      const err = new Error(payload.error.message ?? "Bundler call failed") as Error & {
        bundlerResponse: string
        bundlerCode: number | undefined
        bundlerData: string | undefined
      }
      err.bundlerResponse = JSON.stringify(payload.error)
      err.bundlerCode = payload.error.code
      err.bundlerData = payload.error.data
      throw err
    }
    if (!Object.prototype.hasOwnProperty.call(payload, "result")) {
      throw new Error("Bundler returned no result")
    }
    return payload.result as T
  }

  private parseBundlerNumber(value: unknown): bigint {
    if (typeof value === "string") return BigInt(value)
    if (typeof value === "number") return BigInt(value)
    if (typeof value === "bigint") return value
    throw new Error("Bundler returned invalid gas value")
  }

  private formatUserOperation(userOp: UserOperation) {
    return {
      sender: userOp.sender,
      nonce: toHex(userOp.nonce),
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: toHex(userOp.callGasLimit),
      verificationGasLimit: toHex(userOp.verificationGasLimit),
      preVerificationGas: toHex(userOp.preVerificationGas),
      maxFeePerGas: toHex(userOp.maxFeePerGas),
      maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    }
  }

  private async waitForUserOperationReceipt(userOpHash: Hash): Promise<Hash> {
    const attempts = 30
    for (let i = 0; i < attempts; i += 1) {
      const receipt = await this.callBundler<{ receipt?: { transactionHash?: Hash } } | null>(
        "eth_getUserOperationReceipt",
        [userOpHash]
      )
      const txHash = receipt?.receipt?.transactionHash
      if (txHash) return txHash
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    throw new Error("User operation was not included in time")
  }

  private getSubscriptionManagerAddress(): Address {
    if (!config.SUBSCRIPTION_MANAGER_ADDRESS) {
      throw new Error("SUBSCRIPTION_MANAGER_ADDRESS is not set")
    }
    return config.SUBSCRIPTION_MANAGER_ADDRESS as Address
  }

  /**
   * Register an institution on-chain. Called once when admin approves KYC.
   * institutionId must be a bytes32 hex string derived from the database UUID.
   */
  async registerInstitution(
    institutionId: `0x${string}`,
    name: string,
    adminWallet: Address,
    publicKey: string
  ): Promise<Hash> {
    const normalizedPublicKey = (
      publicKey.startsWith("0x") ? publicKey : `0x${publicKey}`
    ) as `0x${string}`

    const hash = await this.walletClient.writeContract({
      address: config.INSTITUTION_REGISTRY_ADDRESS as Address,
      abi: institutionRegistryAbi,
      functionName: "registerInstitution",
      args: [institutionId, name, adminWallet, normalizedPublicKey],
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  /**
   * Check whether an institution is registered on-chain.
   */
  async isInstitutionRegistered(institutionId: `0x${string}`): Promise<boolean> {
    const institution = await this.publicClient.readContract({
      address: config.INSTITUTION_REGISTRY_ADDRESS as Address,
      abi: institutionRegistryAbi,
      functionName: "getInstitution",
      args: [institutionId],
    })
    const registeredAt = (institution as { registeredAt: bigint }).registeredAt
    return registeredAt > 0n
  }

  /**
   * Register a batch of credential commitments.
   * commitments and nullifiers must be BigInt arrays of equal length.
   * Returns the on-chain batchId emitted in the BatchRegistered event.
   */
  async registerBatch(
    institutionId: `0x${string}`,
    commitments: `0x${string}`[],
    nullifiers: `0x${string}`[],
    graduationYear: number,
    degreeTypeCode: number,
    txRef: `0x${string}`,
    institutionWallet?: { walletClient: import("viem").WalletClient; account: import("viem").Account }
  ): Promise<{ txHash: Hash }> {
    if (commitments.length !== nullifiers.length) {
      throw new Error("Commitments and nullifiers length mismatch")
    }

    const signer = (institutionWallet?.walletClient ?? this.walletClient) as import("viem").WalletClient

    const hash = await signer.writeContract({
      chain: baseSepolia,
      address: config.CREDENTIAL_REGISTRY_ADDRESS as Address,
      abi: credentialRegistryAbi,
      functionName: "registerBatch",
      args: [institutionId, commitments, nullifiers, graduationYear, degreeTypeCode, txRef],
    } as any)

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    if (receipt.status !== "success") {
      throw new Error("Batch registration transaction reverted")
    }

    return { txHash: hash }
  }

  async registerBatchWithPaymaster(
    institutionId: `0x${string}`,
    commitments: `0x${string}`[],
    nullifiers: `0x${string}`[],
    graduationYear: number,
    degreeTypeCode: number,
    txRef: `0x${string}`
  ): Promise<{ txHash: Hash; userOpHash: Hash }> {
    if (!this.isAaEnabled()) {
      throw new Error("Account abstraction is not configured")
    }
    if (commitments.length !== nullifiers.length) {
      throw new Error("Commitments and nullifiers length mismatch")
    }

    const entryPoint = config.ENTRY_POINT_ADDRESS as Address
    const factoryAddress = this.getSimpleAccountFactoryAddress()
    const ownerAddress = this.aaAccount.address as Address
    const salt = this.getSimpleAccountSalt()

    if (!config.CREDENTIAL_REGISTRY_ADDRESS) {
      throw new Error("CREDENTIAL_REGISTRY_ADDRESS is not set")
    }

    const sender = (await this.publicClient.readContract({
      address: factoryAddress,
      abi: simpleAccountFactoryAbi,
      functionName: "getAddress",
      args: [ownerAddress, salt],
    })) as Address

    const senderCode = await this.publicClient.getBytecode({ address: sender })
    const needsInit = !senderCode || senderCode === "0x"
    const initCode = needsInit
      ? concatHex([
          factoryAddress,
          encodeFunctionData({
            abi: simpleAccountFactoryAbi,
            functionName: "createAccount",
            args: [ownerAddress, salt],
          }),
        ])
      : ("0x" as `0x${string}`)

    const registerBatchCalldata = encodeFunctionData({
      abi: credentialRegistryAbi,
      functionName: "registerBatch",
      args: [institutionId, commitments, nullifiers, graduationYear, degreeTypeCode, txRef],
    })

    const callData = encodeFunctionData({
      abi: simpleAccountAbi,
      functionName: "execute",
      args: [config.CREDENTIAL_REGISTRY_ADDRESS as Address, 0n, registerBatchCalldata],
    })

    const paymasterData = encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [institutionId, BigInt(commitments.length)]
    )
    const paymasterAndData = concatHex([this.getPaymasterAddress(), paymasterData])

    const nonce = (await this.publicClient.readContract({
      address: entryPoint,
      abi: entryPointAbi,
      functionName: "getNonce",
      args: [sender, 0n],
    })) as bigint

    const gasPrice = await this.publicClient.getGasPrice()
    const maxPriority = await this.publicClient
      .estimateMaxPriorityFeePerGas()
      .catch(() => parseGwei("1"))

    const userOpBase: UserOperation = {
      sender,
      nonce,
      initCode,
      callData,
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: maxPriority,
      paymasterAndData,
      signature: `0x${"0".repeat(130)}` as `0x${string}`,
    }

    let estimation: {
      callGasLimit: string
      verificationGasLimit: string
      preVerificationGas: string
    }

    try {
      estimation = await this.callBundler<{
        callGasLimit: string
        verificationGasLimit: string
        preVerificationGas: string
      }>("eth_estimateUserOperationGas", [this.formatUserOperation(userOpBase), entryPoint])
    } catch (err) {
      log.warn({ err }, "Bundler estimation failed in registerBatchWithPaymaster, using defaults")
      const baseGas = 150000 + commitments.length * 30000
      estimation = {
        callGasLimit: String(baseGas),
        verificationGasLimit: "200000",
        preVerificationGas: "80000",
      }
    }

    const userOp: UserOperation = {
      ...userOpBase,
      callGasLimit: this.parseBundlerNumber(estimation.callGasLimit),
      verificationGasLimit: this.parseBundlerNumber(estimation.verificationGasLimit),
      preVerificationGas: this.parseBundlerNumber(estimation.preVerificationGas),
    }

    const maxCostEstimate =
      (userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas) *
      userOp.maxFeePerGas

    const institutionTier = await this.getInstitutionTier(institutionId)
    const sponsoredPool = await this.getPaymasterSponsoredPool()
    const institutionBalance = await this.getPaymasterInstitutionBalance(institutionId)
    const entryPointDeposit = await this.getPaymasterEntryPointDeposit()
    const isSponsored = institutionTier === 0 && commitments.length <= 999
    const availableFunds = isSponsored ? sponsoredPool : institutionBalance
    const hasEnoughFunds = availableFunds >= maxCostEstimate
    const hasEnoughEntryPointDeposit = entryPointDeposit >= maxCostEstimate

    if (!hasEnoughFunds || !hasEnoughEntryPointDeposit) {
      const error = new Error(
        isSponsored
          ? `Paymaster sponsored pool or EntryPoint deposit too low. tier=FREE sponsoredPool=${sponsoredPool.toString()} entryPointDeposit=${entryPointDeposit.toString()} maxCostEstimate=${maxCostEstimate.toString()}`
          : `Paymaster institution balance or EntryPoint deposit too low. tier=PAID institutionBalance=${institutionBalance.toString()} entryPointDeposit=${entryPointDeposit.toString()} maxCostEstimate=${maxCostEstimate.toString()}`
      )
      ;(error as { sponsoredPool?: string; maxCostEstimate?: string }).sponsoredPool =
        sponsoredPool.toString()
      ;(error as { sponsoredPool?: string; maxCostEstimate?: string }).maxCostEstimate =
        maxCostEstimate.toString()
      ;(error as { institutionBalance?: string; maxCostEstimate?: string }).institutionBalance =
        institutionBalance.toString()
      ;(error as { entryPointDeposit?: string; maxCostEstimate?: string }).entryPointDeposit =
        entryPointDeposit.toString()
      ;(error as { availableFundsWei?: string; availableFundsEth?: string }).availableFundsWei =
        availableFunds.toString()
      ;(error as { availableFundsWei?: string; availableFundsEth?: string }).availableFundsEth =
        formatEther(availableFunds)
      ;(
        error as { fundingShortfallWei?: string; fundingShortfallEth?: string }
      ).fundingShortfallWei = (hasEnoughFunds ? 0n : maxCostEstimate - availableFunds).toString()
      ;(
        error as { fundingShortfallWei?: string; fundingShortfallEth?: string }
      ).fundingShortfallEth = formatEther(hasEnoughFunds ? 0n : maxCostEstimate - availableFunds)
      ;(
        error as { hasEnoughFunds?: boolean; hasEnoughEntryPointDeposit?: boolean }
      ).hasEnoughFunds = hasEnoughFunds
      ;(
        error as { hasEnoughFunds?: boolean; hasEnoughEntryPointDeposit?: boolean }
      ).hasEnoughEntryPointDeposit = hasEnoughEntryPointDeposit
      throw error
    }

    const userOpHash = await this.publicClient.readContract({
      address: entryPoint,
      abi: entryPointAbi,
      functionName: "getUserOpHash",
      args: [userOp],
    })
    const signature = await this.aaAccount.signMessage({ message: { raw: userOpHash } })
    userOp.signature = signature as `0x${string}`

    let sentUserOpHash: Hash | undefined

    try {
      sentUserOpHash = await this.callBundler<Hash>("eth_sendUserOperation", [
        this.formatUserOperation(userOp),
        entryPoint,
      ])
      const txHash = await this.waitForUserOperationReceipt(sentUserOpHash)
      return { txHash, userOpHash: sentUserOpHash }
    } catch (err) {
      const wrapped = new Error(err instanceof Error ? err.message : "User operation failed") as Error & {
        userOpHash: Hash | undefined
        callGasLimit: string
        verificationGasLimit: string
        preVerificationGas: string
        bundlerResponse: string | undefined
        maxFeePerGas: string
        initCodeLength: string
        callDataLength: string
      }
      if (sentUserOpHash) wrapped.userOpHash = sentUserOpHash
      wrapped.callGasLimit = userOp.callGasLimit.toString()
      wrapped.verificationGasLimit = userOp.verificationGasLimit.toString()
      wrapped.preVerificationGas = userOp.preVerificationGas.toString()
      wrapped.maxFeePerGas = userOp.maxFeePerGas.toString()
      wrapped.initCodeLength = userOp.initCode.length.toString()
      wrapped.callDataLength = userOp.callData.length.toString()
      if (err && typeof err === "object" && "bundlerResponse" in err) {
        wrapped.bundlerResponse = (err as { bundlerResponse: string }).bundlerResponse
      }
      throw wrapped
    }
  }

  async predeployAaAccount(): Promise<{ sender: Address; deployed: boolean; txHash?: Hash }> {
    const factoryAddress = this.getSimpleAccountFactoryAddress()
    const ownerAddress = this.aaAccount.address as Address
    const salt = this.getSimpleAccountSalt()

    const sender = (await this.publicClient.readContract({
      address: factoryAddress,
      abi: simpleAccountFactoryAbi,
      functionName: "getAddress",
      args: [ownerAddress, salt],
    })) as Address

    const senderCode = await this.publicClient.getBytecode({ address: sender })
    if (senderCode && senderCode !== "0x") {
      return { sender, deployed: false }
    }

    const txHash = await this.walletClient.writeContract({
      address: factoryAddress,
      abi: simpleAccountFactoryAbi,
      functionName: "createAccount",
      args: [ownerAddress, salt],
    })
    await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    return { sender, deployed: true, txHash }
  }

  async estimateBatchUserOpCost(
    institutionId: `0x${string}`,
    batchSize: number,
    graduationYear: number,
    degreeTypeCode: number
  ): Promise<{
    maxCostWei: string
    maxCostEth: string
    needsInit: boolean
    isSponsored: boolean
    institutionTier: number
    sponsoredPool: string
    institutionBalance: string
    entryPointDepositWei: string
    entryPointDepositEth: string
    availableFundsWei: string
    availableFundsEth: string
    fundingShortfallWei: string
    fundingShortfallEth: string
    hasEnoughFunds: boolean
    hasEnoughEntryPointDeposit: boolean
  }> {
    if (!this.isAaEnabled()) {
      throw new Error("Account abstraction is not configured")
    }

    const entryPoint = config.ENTRY_POINT_ADDRESS as Address
    const factoryAddress = this.getSimpleAccountFactoryAddress()
    const ownerAddress = this.aaAccount.address as Address
    const salt = this.getSimpleAccountSalt()

    const sender = (await this.publicClient.readContract({
      address: factoryAddress,
      abi: simpleAccountFactoryAbi,
      functionName: "getAddress",
      args: [ownerAddress, salt],
    })) as Address

    const senderCode = await this.publicClient.getBytecode({ address: sender })
    const needsInit = !senderCode || senderCode === "0x"
    const initCode = needsInit
      ? concatHex([
          factoryAddress,
          encodeFunctionData({
            abi: simpleAccountFactoryAbi,
            functionName: "createAccount",
            args: [ownerAddress, salt],
          }),
        ])
      : ("0x" as `0x${string}`)

    const zeroBytes32 = "0x" + "0".repeat(64)
    const commitments = Array.from({ length: batchSize }, () => zeroBytes32 as `0x${string}`)
    const nullifiers = Array.from({ length: batchSize }, () => zeroBytes32 as `0x${string}`)
    const txRef = zeroBytes32 as `0x${string}`

    const registerBatchCalldata = encodeFunctionData({
      abi: credentialRegistryAbi,
      functionName: "registerBatch",
      args: [institutionId, commitments, nullifiers, graduationYear, degreeTypeCode, txRef],
    })

    const callData = encodeFunctionData({
      abi: simpleAccountAbi,
      functionName: "execute",
      args: [config.CREDENTIAL_REGISTRY_ADDRESS as Address, 0n, registerBatchCalldata],
    })

    const paymasterData = encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [institutionId, BigInt(batchSize)]
    )
    const paymasterAndData = concatHex([this.getPaymasterAddress(), paymasterData])

    const nonce = (await this.publicClient.readContract({
      address: entryPoint,
      abi: entryPointAbi,
      functionName: "getNonce",
      args: [sender, 0n],
    })) as bigint

    const gasPrice = await this.publicClient.getGasPrice()
    const maxPriority = await this.publicClient
      .estimateMaxPriorityFeePerGas()
      .catch(() => parseGwei("1"))

    const userOpBase: UserOperation = {
      sender,
      nonce,
      initCode,
      callData,
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: maxPriority,
      paymasterAndData,
      signature: `0x${"0".repeat(130)}` as `0x${string}`,
    }

    let estimation: {
      callGasLimit: string
      verificationGasLimit: string
      preVerificationGas: string
    }
    try {
      estimation = await this.callBundler<{
        callGasLimit: string
        verificationGasLimit: string
        preVerificationGas: string
      }>("eth_estimateUserOperationGas", [this.formatUserOperation(userOpBase), entryPoint])
    } catch (err) {
      log.warn({ err }, "Bundler estimation failed, using defaults")
      const baseGas = 150000 + batchSize * 30000
      estimation = {
        callGasLimit: String(baseGas),
        verificationGasLimit: "200000",
        preVerificationGas: "80000",
      }
    }

    const userOp: UserOperation = {
      ...userOpBase,
      callGasLimit: this.parseBundlerNumber(estimation.callGasLimit),
      verificationGasLimit: this.parseBundlerNumber(estimation.verificationGasLimit),
      preVerificationGas: this.parseBundlerNumber(estimation.preVerificationGas),
    }

    const maxCostEstimate =
      (userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas) *
      userOp.maxFeePerGas

    const institutionTier = await this.getInstitutionTier(institutionId)
    const sponsoredPool = await this.getPaymasterSponsoredPool()
    const institutionBalance = await this.getPaymasterInstitutionBalance(institutionId)
    const entryPointDeposit = await this.getPaymasterEntryPointDeposit()
    const isSponsored = institutionTier === 0 && batchSize <= 999
    const availableFunds = isSponsored ? sponsoredPool : institutionBalance
    const hasEnoughFunds = availableFunds >= maxCostEstimate
    const hasEnoughEntryPointDeposit = entryPointDeposit >= maxCostEstimate
    const fundingShortfall = hasEnoughFunds ? 0n : maxCostEstimate - availableFunds

    return {
      maxCostWei: maxCostEstimate.toString(),
      maxCostEth: formatEther(maxCostEstimate),
      needsInit,
      isSponsored,
      institutionTier,
      sponsoredPool: sponsoredPool.toString(),
      institutionBalance: institutionBalance.toString(),
      entryPointDepositWei: entryPointDeposit.toString(),
      entryPointDepositEth: formatEther(entryPointDeposit),
      availableFundsWei: availableFunds.toString(),
      availableFundsEth: formatEther(availableFunds),
      fundingShortfallWei: fundingShortfall.toString(),
      fundingShortfallEth: formatEther(fundingShortfall),
      hasEnoughFunds,
      hasEnoughEntryPointDeposit,
    }
  }

  /**
   * Check whether a specific commitment exists on-chain.
   */
  async commitmentExists(commitment: bigint): Promise<boolean> {
    const nullifier = await this.publicClient.readContract({
      address: config.CREDENTIAL_REGISTRY_ADDRESS as Address,
      abi: credentialRegistryAbi,
      functionName: "getNullifierForCommitment",
      args: [BlockchainService.bigintToBytes32(commitment)],
    })

    return String(nullifier).toLowerCase() !== ZERO_BYTES32
  }

  /**
   * Check whether a nullifier exists (i.e. the credential was registered).
   */
  async nullifierExists(nullifier: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: config.CREDENTIAL_REGISTRY_ADDRESS as Address,
      abi: credentialRegistryAbi,
      functionName: "exists",
      args: [BlockchainService.bigintToBytes32(nullifier)],
    })
  }

  /**
   * Revoke a credential by its nullifier. Only callable by authorized accounts.
   */
  async revokeCredential(nullifier: bigint, reasonCode: number): Promise<Hash> {
    const hash = await this.walletClient.writeContract({
      address: config.REVOCATION_REGISTRY_ADDRESS as Address,
      abi: revocationRegistryAbi,
      functionName: "revokeCredential",
      args: [BlockchainService.bigintToBytes32(nullifier), reasonCode],
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  /**
   * Check whether a credential has been revoked.
   */
  async isRevoked(nullifier: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: config.REVOCATION_REGISTRY_ADDRESS as Address,
      abi: revocationRegistryAbi,
      functionName: "isRevoked",
      args: [BlockchainService.bigintToBytes32(nullifier)],
    })
  }

  /**
   * Call verifyProof on the deployed Groth16 verifier.
   * Inputs are [commitment, nullifier, claimValue, claimType].
   * This is the on-chain step that finalises a verification request.
   */
  async verifyProof(
    a: [bigint, bigint],
    b: [[bigint, bigint], [bigint, bigint]],
    c: [bigint, bigint],
    publicInputs: [bigint, bigint, bigint, bigint]
  ): Promise<boolean> {
    return this.publicClient.readContract({
      address: config.ZK_VERIFIER_ADDRESS as Address,
      abi: verifierAbi,
      functionName: "verifyProof",
      args: [a, b, c, publicInputs],
    })
  }

  async setInstitutionTier(institutionId: `0x${string}`, tier: "FREE" | "PAID"): Promise<Hash> {
    const tierValue = tier === "FREE" ? 0 : 1
    const hash = await this.walletClient.writeContract({
      address: this.getSubscriptionManagerAddress(),
      abi: subscriptionManagerAbi,
      functionName: "setInstitutionTier",
      args: [institutionId, tierValue],
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  async getInstitutionTier(institutionId: `0x${string}`): Promise<number> {
    const tier = await this.publicClient.readContract({
      address: this.getSubscriptionManagerAddress(),
      abi: subscriptionManagerAbi,
      functionName: "institutionTiers",
      args: [institutionId],
    })
    return Number(tier)
  }

  async initialiseEmployer(employerAddress: Address): Promise<Hash> {
    const hash = await this.walletClient.writeContract({
      address: this.getSubscriptionManagerAddress(),
      abi: subscriptionManagerAbi,
      functionName: "initialiseEmployer",
      args: [employerAddress],
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  async consumeFreeVerification(employerAddress: Address): Promise<Hash> {
    const hash = await this.walletClient.writeContract({
      address: this.getSubscriptionManagerAddress(),
      abi: subscriptionManagerAbi,
      functionName: "consumeFreeVerification",
      args: [employerAddress],
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  async isEmployerInitialised(employerAddress: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.getSubscriptionManagerAddress(),
      abi: subscriptionManagerAbi,
      functionName: "isEmployerInitialised",
      args: [employerAddress],
    })
  }

  async getRemainingFreeVerifications(employerAddress: Address): Promise<number> {
    const remaining = await this.publicClient.readContract({
      address: this.getSubscriptionManagerAddress(),
      abi: subscriptionManagerAbi,
      functionName: "freeVerificationsRemaining",
      args: [employerAddress],
    })
    return Number(remaining)
  }

  /**
   * Get the current ETH balance of an address. Useful for monitoring
   * the PaymasterVault balance to avoid running out of gas funds.
   */
  async getBalance(address: Address): Promise<bigint> {
    return this.publicClient.getBalance({ address })
  }

  async getTransactionReceipt(txHash: `0x${string}`) {
    return this.publicClient.getTransactionReceipt({ hash: txHash })
  }

  async getTransaction(txHash: `0x${string}`) {
    return this.publicClient.getTransaction({ hash: txHash })
  }

  async getPaymasterInstitutionBalance(institutionId: `0x${string}`): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.getPaymasterAddress(),
      abi: paymasterVaultAbi,
      functionName: "institutionBalances",
      args: [institutionId],
    })
  }

  async getPaymasterSponsoredPool(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.getPaymasterAddress(),
      abi: paymasterVaultAbi,
      functionName: "sponsoredPool",
      args: [],
    })
  }

  async getPaymasterEntryPointDeposit(): Promise<bigint> {
    if (!config.ENTRY_POINT_ADDRESS) {
      throw new Error("ENTRY_POINT_ADDRESS is not set")
    }

    return this.publicClient.readContract({
      address: config.ENTRY_POINT_ADDRESS as Address,
      abi: entryPointAbi,
      functionName: "balanceOf",
      args: [this.getPaymasterAddress()],
    })
  }

  async fundInstitutionPaymaster(institutionId: `0x${string}`, amountWei: bigint): Promise<Hash> {
    const hash = await this.walletClient.writeContract({
      address: this.getPaymasterAddress(),
      abi: paymasterVaultAbi,
      functionName: "fundInstitution",
      args: [institutionId],
      value: amountWei,
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  async fundSponsoredPool(amountWei: bigint): Promise<Hash> {
    const hash = await this.walletClient.writeContract({
      address: this.getPaymasterAddress(),
      abi: paymasterVaultAbi,
      functionName: "fundSponsoredPool",
      value: amountWei,
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  /**
   * Convert a UUID string to bytes32 hex. This is the canonical way we
   * derive on-chain identifiers from database UUIDs.
   */
  static uuidToBytes32(uuid: string): `0x${string}` {
    // Strip hyphens and left-pad to 32 bytes (64 hex chars)
    const hex = uuid.replace(/-/g, "").padStart(64, "0")
    return `0x${hex}`
  }

  /**
   * Create a viem wallet client for an institution's dedicated EOA.
   * The private key hex (without 0x prefix) is decrypted from the DB.
   * Used by the batch processor to sign registerBatch transactions.
   */
  static createInstitutionWallet(privateKeyHex: string) {
    const key = (privateKeyHex.startsWith("0x") ? privateKeyHex : `0x${privateKeyHex}`) as `0x${string}`
    const account = privateKeyToAccount(key)
    const transport = http(config.ALCHEMY_BASE_SEPOLIA_URL, { timeout: 120_000 })
    const walletClient = createWalletClient({ account, chain: baseSepolia, transport })
    return { walletClient, account }
  }

  /**
   * Send ETH from the platform operator wallet to an external address.
   * Uses PLATFORM_OPERATOR_PRIVATE_KEY (separate from the admin key).
   * Used for institution withdrawal payouts.
   */
  async sendEth(to: Address, amountWei: bigint): Promise<Hash> {
    const operatorKey = config.PLATFORM_OPERATOR_PRIVATE_KEY
    if (!operatorKey) {
      throw new Error("PLATFORM_OPERATOR_PRIVATE_KEY is not configured")
    }
    if (amountWei <= 0n) {
      throw new Error("Amount must be positive")
    }

    const operatorAccount = privateKeyToAccount(operatorKey as `0x${string}`)
    const operatorWalletClient = createWalletClient({
      account: operatorAccount,
      chain: baseSepolia,
      transport: http(config.ALCHEMY_BASE_SEPOLIA_URL),
    })

    const hash = await operatorWalletClient.sendTransaction({
      to,
      value: amountWei,
    })
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }
}
