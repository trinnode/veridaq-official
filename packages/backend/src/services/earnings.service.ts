import { PrismaClient } from "@prisma/client"
import pino from "pino"
import { parseEther } from "viem"
import { config } from "../config/index.js"

const log = pino({ name: "earnings-service" })

export class EarningsService {
  constructor(private prisma: PrismaClient) {}

  // ─── Ensure singleton gas pool row exists ─────────────────────────────

  private async ensureGasPool() {
    let pool = await this.prisma.gasPool.findFirst()
    if (!pool) {
      pool = await this.prisma.gasPool.create({
        data: {
          id: "gas-pool-singleton",
          totalDepositedUsd: 0,
          totalDepositedWei: 0,
          totalSpentUsd: 0,
          totalSpentWei: 0,
          availableUsd: 0,
          availableWei: 0,
        },
      })
    }
    return pool
  }

  // ─── Ensure institution earnings row exists ───────────────────────────

  private async ensureInstitutionEarnings(institutionId: string) {
    let earnings = await this.prisma.institutionEarnings.findUnique({
      where: { institutionId },
    })
    if (!earnings) {
      earnings = await this.prisma.institutionEarnings.create({
        data: { institutionId },
      })
    }
    return earnings
  }

  // ─── Credit a verification — called when verification completes ───────

  async creditVerification(
    institutionId: string,
    verificationId: string,
    amountUsd: number,
    amountWei: string,
    isFreeVerification: boolean
  ) {
    // Free verifications don't trigger revenue sharing
    if (isFreeVerification) {
      return
    }

    const platformPct = config.PLATFORM_REVENUE_SHARE_PERCENT
    const instPct = config.INSTITUTION_REVENUE_SHARE_PERCENT
    const poolPct = config.GAS_POOL_REVENUE_SHARE_PERCENT

    const platformShareUsd = parseFloat((amountUsd * (platformPct / 100)).toFixed(4))
    const institutionShareUsd = parseFloat((amountUsd * (instPct / 100)).toFixed(4))
    const poolShareUsd = parseFloat((amountUsd * (poolPct / 100)).toFixed(4))

    const amountWeiBig = BigInt(amountWei)
    const platformShareWei = (amountWeiBig * BigInt(platformPct)) / BigInt(100)
    const institutionShareWei = (amountWeiBig * BigInt(instPct)) / BigInt(100)
    const poolShareWei = (amountWeiBig * BigInt(poolPct)) / BigInt(100)

    await this.prisma.$transaction(async (tx) => {
      // Update institution earnings (+20%)
      const instEarnings = await tx.institutionEarnings.upsert({
        where: { institutionId },
        update: {
          totalEarnedUsd: { increment: institutionShareUsd },
          totalEarnedWei: { increment: institutionShareWei.toLocaleString("fullwide", { useGrouping: false }) },
          availableUsd: { increment: institutionShareUsd },
          availableWei: { increment: institutionShareWei.toLocaleString("fullwide", { useGrouping: false }) },
        },
        create: {
          institutionId,
          totalEarnedUsd: institutionShareUsd,
          totalEarnedWei: institutionShareWei.toLocaleString("fullwide", { useGrouping: false }),
          availableUsd: institutionShareUsd,
          availableWei: institutionShareWei.toLocaleString("fullwide", { useGrouping: false }),
        },
      })

      // Update gas pool (+10%)
      const pool = await this.ensureGasPool()
      await tx.gasPool.update({
        where: { id: pool.id },
        data: {
          totalDepositedUsd: { increment: poolShareUsd },
          totalDepositedWei: { increment: poolShareWei.toLocaleString("fullwide", { useGrouping: false }) },
          availableUsd: { increment: poolShareUsd },
          availableWei: { increment: poolShareWei.toLocaleString("fullwide", { useGrouping: false }) },
        },
      })

      // Record EarningTransaction
      await tx.earningTransaction.create({
        data: {
          institutionId,
          verificationId,
          type: "EARNED",
          amountUsd,
          amountWei: amountWei,
          platformShareUsd,
          institutionShareUsd,
          poolShareUsd,
          description: `Verification ${verificationId} — ${instPct}% institution share`,
          referenceId: verificationId,
        },
      })

      // Record GasPoolTransaction
      await tx.gasPoolTransaction.create({
        data: {
          type: "DEPOSIT",
          amountUsd: poolShareUsd,
          amountWei: poolShareWei.toLocaleString("fullwide", { useGrouping: false }),
          source: "VERIFICATION_SHARE",
          referenceId: verificationId,
          description: `10% pool share from verification ${verificationId}`,
        },
      })
    })

    // Check pool health after transaction
    this.checkPoolHealth().catch((err) => {
      log.error({ err }, "Gas pool health check failed")
    })
  }

  // ─── Get institution earnings summary ─────────────────────────────────

  async getInstitutionSummary(institutionId: string) {
    const earnings = await this.ensureInstitutionEarnings(institutionId)
    return {
      totalEarnedUsd: earnings.totalEarnedUsd.toNumber(),
      totalEarnedWei: earnings.totalEarnedWei.toString(),
      withdrawnUsd: earnings.withdrawnUsd.toNumber(),
      withdrawnWei: earnings.withdrawnWei.toString(),
      availableUsd: earnings.availableUsd.toNumber(),
      availableWei: earnings.availableWei.toString(),
      payoutWallet: earnings.payoutWallet,
    }
  }

  // ─── List earning transactions ────────────────────────────────────────

  async listTransactions(institutionId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const total = await this.prisma.earningTransaction.count({
      where: { institutionId },
    })
    const items = await this.prisma.earningTransaction.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    })
    return { total, page, limit, items }
  }

  // ─── Set payout wallet ───────────────────────────────────────────────

  async setPayoutWallet(institutionId: string, walletAddress: string) {
    const earnings = await this.ensureInstitutionEarnings(institutionId)
    return this.prisma.institutionEarnings.update({
      where: { id: earnings.id },
      data: { payoutWallet: walletAddress },
    })
  }

  // ─── Get gas pool summary ─────────────────────────────────────────────

  async getGasPoolSummary() {
    const pool = await this.ensureGasPool()
    return {
      totalDepositedUsd: pool.totalDepositedUsd.toNumber(),
      totalDepositedWei: pool.totalDepositedWei.toString(),
      totalSpentUsd: pool.totalSpentUsd.toNumber(),
      totalSpentWei: pool.totalSpentWei.toString(),
      availableUsd: pool.availableUsd.toNumber(),
      availableWei: pool.availableWei.toString(),
    }
  }

  // ─── Sponsor gas from pool (for FREE tier ops) ────────────────────────

  async sponsorGas(amountUsd: number, amountWei: string, destination: string, referenceId?: string) {
    const pool = await this.ensureGasPool()
    const currentAvailable = pool.availableUsd.toNumber()
    if (currentAvailable < amountUsd) {
      log.warn({ available: currentAvailable, needed: amountUsd }, "Gas pool insufficient")
      throw new Error("GasPool insufficient balance")
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.gasPool.update({
        where: { id: pool.id },
        data: {
          totalSpentUsd: { increment: amountUsd },
          totalSpentWei: { increment: amountWei },
          availableUsd: { decrement: amountUsd },
          availableWei: { decrement: amountWei },
        },
      })
      await tx.gasPoolTransaction.create({
        data: {
          type: "SPEND",
          amountUsd,
          amountWei,
          destination: destination ?? null,
          referenceId: referenceId ?? null,
          description: `Gas sponsored for ${destination}${referenceId ? ` (${referenceId})` : ""}`,
        },
      })
    })
  }

  // ─── Pool health check ────────────────────────────────────────────────

  private async checkPoolHealth() {
    const pool = await this.ensureGasPool()
    const available = pool.availableUsd.toNumber()
    const minBalance = config.GAS_POOL_MIN_BALANCE_USD

    if (available < minBalance && config.GAS_POOL_LOW_BALANCE_ALERT) {
      log.warn(
        { available, minBalance },
        "Gas pool balance is below minimum threshold"
      )
    }
  }

  // ─── Request withdrawal (institutions) ─────────────────────────────────

  async requestWithdrawal(
    institutionId: string,
    amountUsd: number,
    method: "CRYPTO" | "FIAT",
    destinationWallet?: string
  ) {
    const earnings = await this.ensureInstitutionEarnings(institutionId)
    const available = earnings.availableUsd.toNumber()

    if (amountUsd < 10) {
      throw new Error("Minimum withdrawal is $10")
    }

    if (available < amountUsd) {
      throw new Error(`Insufficient balance. Available: $${available}, requested: $${amountUsd}`)
    }

    const destWallet = destinationWallet ?? earnings.payoutWallet

    if (method === "CRYPTO") {
      if (!destWallet) {
        throw new Error("No payout wallet set. Set a payout wallet before requesting crypto withdrawal.")
      }
      // For crypto, use a simple wei estimate: $1 ≈ 0.0006 ETH (at ~$1669 ETH)
      const ethAmount = (amountUsd / 1669.3).toFixed(10)
      const weiEquivalent = parseEther(ethAmount)

      const { BlockchainService } = await import("./blockchain.service.js")
      const blockchainSvc = new BlockchainService()
      const txHash = await blockchainSvc.sendEth(destWallet as `0x${string}`, weiEquivalent)

      return this.prisma.$transaction(async (tx) => {
        await tx.institutionEarnings.update({
          where: { id: earnings.id },
          data: {
            availableUsd: { decrement: amountUsd },
            availableWei: { decrement: weiEquivalent.toString() },
            withdrawnUsd: { increment: amountUsd },
            withdrawnWei: { increment: weiEquivalent.toString() },
          },
        })

        const txRecord = await tx.earningTransaction.create({
          data: {
            institutionId,
            type: "WITHDRAWN",
            amountUsd,
            amountWei: weiEquivalent.toString(),
            description: `Crypto withdrawal of $${amountUsd} to ${destWallet}`,
            referenceId: txHash,
            metadata: { method: "CRYPTO", destinationWallet: destWallet, status: "COMPLETED", txHash },
          },
        })

        return { transactionId: txRecord.id, status: "COMPLETED", txHash }
      })
    }

    // FIAT withdrawal — recorded as pending, admin processes manually
    return this.prisma.$transaction(async (tx) => {
      await tx.institutionEarnings.update({
        where: { id: earnings.id },
        data: {
          availableUsd: { decrement: amountUsd },
          withdrawnUsd: { increment: amountUsd },
        },
      })

      const txRecord = await tx.earningTransaction.create({
        data: {
          institutionId,
          type: "WITHDRAWN",
          amountUsd,
          amountWei: "0",
          description: `FIAT withdrawal of $${amountUsd}`,
          referenceId: destWallet ?? null,
          metadata: { method: "FIAT", destinationWallet: destWallet, status: "PENDING" },
        },
      })

      return { transactionId: txRecord.id, status: "PENDING" }
    })
  }

  // ─── Get platform earnings summary (admin) ────────────────────────────

  async getPlatformEarnings() {
    const [pool, totalEarned, totalWithdrawn, totalTransactions] = await Promise.all([
      this.ensureGasPool(),
      this.prisma.earningTransaction.aggregate({
        _sum: { amountUsd: true },
        where: { type: "EARNED" },
      }),
      this.prisma.earningTransaction.aggregate({
        _sum: { amountUsd: true },
        where: { type: "WITHDRAWN" },
      }),
      this.prisma.earningTransaction.count(),
    ])

    const totalInstitutionEarnings = await this.prisma.institutionEarnings.aggregate({
      _sum: { totalEarnedUsd: true, availableUsd: true, withdrawnUsd: true },
    })

    return {
      pool: {
        availableUsd: pool.availableUsd.toNumber(),
        totalDepositedUsd: pool.totalDepositedUsd.toNumber(),
        totalSpentUsd: pool.totalSpentUsd.toNumber(),
      },
      totalEarnedUsd: totalEarned._sum.amountUsd?.toNumber() ?? 0,
      totalWithdrawnUsd: totalWithdrawn._sum.amountUsd?.toNumber() ?? 0,
      totalTransactions,
      institutionEarnings: {
        totalEarnedUsd: totalInstitutionEarnings._sum.totalEarnedUsd?.toNumber() ?? 0,
        availableUsd: totalInstitutionEarnings._sum.availableUsd?.toNumber() ?? 0,
        withdrawnUsd: totalInstitutionEarnings._sum.withdrawnUsd?.toNumber() ?? 0,
      },
    }
  }

  // ─── List all institution earnings (admin view) ───────────────────────

  async listAllInstitutionEarnings(page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const total = await this.prisma.institutionEarnings.count()
    const items = await this.prisma.institutionEarnings.findMany({
      skip,
      take: limit,
      include: {
        institution: {
          select: { id: true, name: true, email: true, onChainId: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })
    return { total, page, limit, items }
  }

  // ─── Admin processes a pending fiat withdrawal ────────────────────────

  async processFiatWithdrawal(transactionId: string, approved: boolean) {
    const tx = await this.prisma.earningTransaction.findUnique({
      where: { id: transactionId },
    })
    if (!tx) throw new Error("Transaction not found")
    if (tx.type !== "WITHDRAWN") throw new Error("Not a withdrawal transaction")
    if (tx.metadata && typeof tx.metadata === "object" && "status" in tx.metadata && tx.metadata.status === "COMPLETED") {
      throw new Error("Withdrawal already processed")
    }

    if (approved) {
      await this.prisma.earningTransaction.update({
        where: { id: transactionId },
        data: {
          metadata: { ...(tx.metadata as Record<string, unknown> ?? {}), status: "COMPLETED" },
        },
      })
    }

    return { status: approved ? "COMPLETED" : "REJECTED" }
  }
}
