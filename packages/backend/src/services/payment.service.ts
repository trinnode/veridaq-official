import { PrismaClient, PaymentMethod, PaymentStatus, PaymentType } from "@prisma/client"
import { randomBytes } from "crypto"
import pino from "pino"
import { parseEther, type Address } from "viem"
import { BlockchainService } from "./blockchain.service.js"
import { config } from "../config/index.js"

const log = pino({ name: "payment-service" })

export const UPGRADE_PRICE_ETH = "0.05"
export const UPGRADE_PRICE_WEI = parseEther(UPGRADE_PRICE_ETH)

export const PAYMASTER_VAULT_ADDRESS = config.PAYMASTER_VAULT_ADDRESS

// Credit packs for employer verification purchases
export const CREDIT_PACKS = [
  { label: "5 Verifications", amountWei: parseEther("0.005").toString(), eth: "0.005", credits: 5, usd: 7 },
  { label: "10 Verifications", amountWei: parseEther("0.01").toString(), eth: "0.01", credits: 10, usd: 15 },
  { label: "25 Verifications", amountWei: parseEther("0.02").toString(), eth: "0.02", credits: 25, usd: 35 },
  { label: "50 Verifications", amountWei: parseEther("0.035").toString(), eth: "0.035", credits: 50, usd: 65 },
  { label: "100 Verifications", amountWei: parseEther("0.06").toString(), eth: "0.06", credits: 100, usd: 120 },
  { label: "500 Verifications", amountWei: parseEther("0.38").toString(), eth: "0.38", credits: 500, usd: 550 },
] as const

export class PaymentService {
  private blockchainSvc: BlockchainService

  constructor(
    private prisma: PrismaClient,
    blockchainSvc?: BlockchainService
  ) {
    this.blockchainSvc = blockchainSvc ?? new BlockchainService()
  }

  private generateReference(): string {
    return "VRD-" + randomBytes(16).toString("hex").toUpperCase()
  }

  async createPayment(data: {
    type: PaymentType
    method?: PaymentMethod | null
    amountWei: string
    payerId: string
    payerRole: "INSTITUTION" | "EMPLOYER"
    description?: string | null
    amountFiat?: string | null
    fiatCurrency?: string | null
  }) {
    const referenceId = this.generateReference()

    const payment = await this.prisma.payment.create({
      data: {
        referenceId,
        type: data.type,
        method: data.method as any,
        amountWei: data.amountWei,
        amountFiat: data.amountFiat ?? null,
        fiatCurrency: data.fiatCurrency ?? null,
        payerId: data.payerId,
        payerRole: data.payerRole,
        description: data.description ?? null,
      },
    })

    log.info({ referenceId, type: data.type, payerId: data.payerId, method: data.method }, "Payment created")
    return payment
  }

  /**
   * Verify a crypto payment transaction on-chain before applying benefits.
   */
  async completeCryptoPayment(referenceId: string, txHash: string) {
    const payment = await this.prisma.payment.findUnique({ where: { referenceId } })
    if (!payment) return { error: "NOT_FOUND" as const }
    if (payment.status !== "PENDING") return { error: "ALREADY_PROCESSED" as const }

    const paymasterAddress = config.PAYMASTER_VAULT_ADDRESS as Address | undefined
    if (!paymasterAddress) {
      return { error: "PAYMASTER_NOT_CONFIGURED" as const }
    }

    try {
      const receipt = await this.blockchainSvc.getTransactionReceipt(txHash as `0x${string}`)
      if (!receipt || receipt.status !== "success") {
        log.warn({ txHash, status: receipt?.status }, "Crypto payment tx reverted or not found")
        return { error: "TX_REVERTED" as const }
      }

      const tx = await this.blockchainSvc.getTransaction(txHash as `0x${string}`)
      if (!tx) return { error: "TX_NOT_FOUND" as const }

      if (tx.to?.toLowerCase() !== paymasterAddress.toLowerCase()) {
        log.warn({ txTo: tx.to, expected: paymasterAddress }, "Tx not sent to PaymasterVault")
        return { error: "WRONG_DESTINATION" as const }
      }

      if (tx.value < BigInt(payment.amountWei)) {
        log.warn({ sent: tx.value.toString(), required: payment.amountWei }, "Insufficient ETH sent")
        return { error: "INSUFFICIENT_AMOUNT" as const }
      }

      log.info({ txHash, value: tx.value.toString(), to: tx.to }, "Crypto payment verified on-chain")
    } catch (err) {
      log.error({ err, txHash }, "Failed to verify crypto payment on-chain")
      return { error: "VERIFICATION_FAILED" as const }
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: "COMPLETED", method: "CRYPTO", txHash, completedAt: new Date() },
    })

    await this.applyPayment(payment)
    return { completed: true }
  }

  /**
   * Complete a fiat payment processed via Crossmint.
   * Crossmint sends USDC to the recipient wallet; we apply the credit/balance
   * to the specific institution or employer.
   */
  async completeFiatPayment(
    referenceId: string,
    fiatProvider: string,
    fiatSessionId: string,
    amountFiat: string,
    fiatCurrency: string
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { referenceId } })
    if (!payment) return { error: "NOT_FOUND" as const }
    if (payment.status !== "PENDING") return { error: "ALREADY_PROCESSED" as const }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        method: "FIAT",
        fiatProvider,
        fiatSessionId,
        amountFiat,
        fiatCurrency,
        completedAt: new Date(),
      },
    })

    const amountWei = BigInt(payment.amountWei)

    if (
      (payment.type === "INSTITUTION_UPGRADE" || payment.type === "INSTITUTION_FUNDING") &&
      amountWei > 0n
    ) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: payment.payerId },
        select: { onChainId: true, id: true, name: true },
      })
      if (institution) {
        try {
          const txHash = await this.blockchainSvc.fundInstitutionPaymaster(
            institution.onChainId as `0x${string}`,
            amountWei
          )
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              txHash,
              metadata: { fundedFromFiat: true, fiatProvider },
            },
          })
          log.info(
            { institutionId: institution.id, amountWei: amountWei.toString(), txHash },
            "Admin funded institution from fiat payment"
          )
        } catch (err) {
          log.warn(
            { err, institutionId: payment.payerId },
            "Could not send ETH from admin wallet — DB updated but on-chain may not reflect yet"
          )
        }
      }
    }

    if (payment.type === "EMPLOYER_TOPUP" && amountWei > 0n) {
      const emp = await this.prisma.employer.findUnique({ where: { id: payment.payerId } })
      if (emp) {
        const added = this.calculateCreditsForAmount(amountWei)
        await this.prisma.employer.update({
          where: { id: payment.payerId },
          data: { verificationCredits: { increment: added } },
        })
        if (emp.walletAddress) {
          try {
            await this.blockchainSvc.initialiseEmployer(emp.walletAddress as Address)
          } catch (err) {
            log.error({ err, employerId: payment.payerId }, "Failed to re-init employer after top-up")
          }
        }
      }
    }

    await this.applyPayment(payment)
    return { completed: true }
  }

  private calculateCreditsForAmount(amountWei: bigint): number {
    if (amountWei >= parseEther("0.1")) return 100
    if (amountWei >= parseEther("0.05")) return 50
    if (amountWei >= parseEther("0.02")) return 25
    if (amountWei >= parseEther("0.01")) return 10
    return 5
  }

  private async applyPayment(payment: {
    id: string
    type: PaymentType
    payerId: string
    payerRole: string
    amountWei: string
    method?: string | null
  }) {
    const amountWei = BigInt(payment.amountWei)

    if (payment.type === "INSTITUTION_UPGRADE") {
      const institution = await this.prisma.institution.findUnique({
        where: { id: payment.payerId },
        select: { onChainId: true },
      })
      if (institution) {
        await this.prisma.institution.update({
          where: { id: payment.payerId },
          data: { tier: "PAID", paymasterBalance: payment.amountWei },
        })
        try {
          await this.blockchainSvc.setInstitutionTier(
            institution.onChainId as `0x${string}`,
            "PAID"
          )
          log.info({ institutionId: payment.payerId }, "On-chain tier set to PAID")
        } catch (err) {
          log.error({ err, institutionId: payment.payerId }, "Failed to set on-chain tier")
        }
      }
    } else if (payment.type === "INSTITUTION_FUNDING") {
      const inst = await this.prisma.institution.findUnique({ where: { id: payment.payerId } })
      if (inst) {
        const current = BigInt(inst.paymasterBalance || "0")
        await this.prisma.institution.update({
          where: { id: payment.payerId },
          data: { paymasterBalance: (current + amountWei).toString() },
        })
      }
    } else if (payment.type === "EMPLOYER_TOPUP") {
      const emp = await this.prisma.employer.findUnique({ where: { id: payment.payerId } })
      if (emp) {
        const added = payment.method === "CRYPTO"
          ? this.calculateCreditsForAmount(amountWei)
          : this.calculateCreditsForAmount(amountWei)
        await this.prisma.employer.update({
          where: { id: payment.payerId },
          data: { verificationCredits: { increment: added } },
        })
        if (emp.walletAddress) {
          try {
            await this.blockchainSvc.initialiseEmployer(emp.walletAddress as Address)
          } catch (err) {
            log.error({ err, employerId: payment.payerId }, "Failed to re-init employer")
          }
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        action: "PAYMENT_" + payment.type,
        details: {
          paymentId: payment.id,
          amountWei: payment.amountWei,
          payerId: payment.payerId,
          payerRole: payment.payerRole,
          method: payment.method,
        },
      },
    })
  }

  async failPayment(referenceId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { referenceId } })
    if (!payment) return { error: "NOT_FOUND" as const }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    })
    return { failed: true }
  }

  async getPayment(referenceId: string) {
    return this.prisma.payment.findUnique({ where: { referenceId } })
  }

  async listPayments(params: {
    payerId?: string
    payerRole?: string
    status?: PaymentStatus
    page?: number
    limit?: number
  }) {
    const { payerId, payerRole, status, page = 1, limit = 20 } = params
    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}
    if (payerId) where.payerId = payerId
    if (payerRole) where.payerRole = payerRole
    if (status) where.status = status

    const [total, items] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ])
    return { total, page, limit, items }
  }

  async getPayerBalance(payerId: string, payerRole: string) {
    if (payerRole === "INSTITUTION") {
      const inst = await this.prisma.institution.findUnique({
        where: { id: payerId },
        select: { paymasterBalance: true, tier: true },
      })
      if (!inst) return null
      const onChain = await this.blockchainSvc
        .getPaymasterInstitutionBalance(payerId as `0x${string}`)
        .catch(() => 0n)
      return {
        dbBalance: inst.paymasterBalance,
        onChainBalance: onChain.toString(),
        tier: inst.tier,
      }
    }
    if (payerRole === "EMPLOYER") {
      const emp = await this.prisma.employer.findUnique({
        where: { id: payerId },
        select: {
          freeVerificationsRemaining: true,
          verificationCredits: true,
          walletAddress: true,
        },
      })
      if (!emp) return null
      let onChainVerifications = 0
      if (emp.walletAddress) {
        onChainVerifications = await this.blockchainSvc
          .getRemainingFreeVerifications(emp.walletAddress as `0x${string}`)
          .catch(() => 0)
      }
      return {
        dbVerifications: emp.freeVerificationsRemaining,
        dbCredits: emp.verificationCredits,
        onChainVerifications,
        totalAvailable: emp.freeVerificationsRemaining + emp.verificationCredits,
      }
    }
    return null
  }
}
