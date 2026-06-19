/**
 * AdminService — institution and employer KYC approval, tier management,
 * and platform-level statistics for the admin portal.
 *
 * BlockchainService is injected via the constructor so that tests can swap in
 * a mock without dynamic require() hacks.
 */

import { PrismaClient } from "@prisma/client"
import pino from "pino"
import { formatEther, parseEther } from "viem"
import { BlockchainService } from "./blockchain.service.js"
import { EmailService } from "./email.service.js"

const log = pino({ name: "admin-service" })

export class AdminService {
  private emailService: EmailService
  private blockchainSvc: BlockchainService

  constructor(
    private prisma: PrismaClient,
    blockchainSvc?: BlockchainService
  ) {
    this.emailService = new EmailService()
    this.blockchainSvc = blockchainSvc ?? new BlockchainService()
  }

  async listInstitutions(page: number, search?: string) {
    const limit = 20
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}

    const [total, items] = await this.prisma.$transaction([
      this.prisma.institution.count({ where }),
      this.prisma.institution.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          tier: true,
          kycApproved: true,
          active: true,
          paymasterBalance: true,
          createdAt: true,
          deactivationReason: true,
          adminWallet: true,
          publicKey: true,
          onChainId: true,
          _count: { select: { batches: true } },
        },
      }),
    ])

    return { total, page, limit, items }
  }

  async approveInstitution(institutionId: string, adminId: string, adminWalletOverride?: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null

    // Allow admin to override the wallet before on-chain registration
    const effectiveWallet = adminWalletOverride ?? inst.adminWallet

    // Register on-chain if missing, then set tier
    try {
      const alreadyRegistered = await this.blockchainSvc.isInstitutionRegistered(inst.onChainId as `0x${string}`)
      if (!alreadyRegistered) {
        await this.blockchainSvc.registerInstitution(inst.onChainId as `0x${string}`, inst.name, effectiveWallet as `0x${string}`, inst.publicKey)
      }
      const onChainTier = await this.blockchainSvc.getInstitutionTier(inst.onChainId as `0x${string}`)
      const desiredTier = inst.tier === "FREE" ? 0 : 1
      if (onChainTier !== desiredTier) {
        await this.blockchainSvc.setInstitutionTier(inst.onChainId as `0x${string}`, inst.tier)
      }
    } catch (err) {
      log.error({ err, institutionId }, "Failed to register institution on-chain")
      const msg = err instanceof Error ? err.message : "Unknown blockchain error"
      throw new Error(msg)
    }

    const updateData: Record<string, unknown> = { kycApproved: true }
    if (adminWalletOverride) updateData.adminWallet = adminWalletOverride

    await this.prisma.$transaction([
      this.prisma.institution.update({
        where: { id: institutionId },
        data: updateData,
      }),
      this.prisma.auditLog.create({
        data: {
          action: "KYC_APPROVED",
          details: { role: "institution", orgName: inst.name },
          adminId,
          institutionId: inst.id,
        },
      }),
    ])

    // Send the good news
    await this.emailService.sendKycApproval({
      to: inst.email,
      orgName: inst.name,
      role: "institution",
    })

    return true
  }

  async setInstitutionTier(institutionId: string, tier: "FREE" | "PAID") {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null

    try {
      await this.blockchainSvc.setInstitutionTier(inst.onChainId as `0x${string}`, tier)
    } catch (err) {
      log.error({ err, institutionId }, "Failed to update institution tier on-chain")
      return null
    }

    await this.prisma.institution.update({
      where: { id: institutionId },
      data: { tier },
    })

    return true
  }

  async fundInstitutionBalance(institutionId: string, amountWei: bigint, adminId: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null

    let txHash = ""
    try {
      txHash = await this.blockchainSvc.fundInstitutionPaymaster(inst.onChainId as `0x${string}`, amountWei)
    } catch (err) {
      log.error({ err, institutionId }, "Failed to fund institution paymaster")
      return { error: "Funding transaction failed" as const }
    }

    const balance = await this.blockchainSvc.getPaymasterInstitutionBalance(inst.onChainId as `0x${string}`)

    await this.prisma.$transaction([
      this.prisma.institution.update({
        where: { id: institutionId },
        data: { paymasterBalance: balance.toString() },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "INSTITUTION_FUNDED",
          details: { amountWei: amountWei.toString(), txHash },
          adminId,
          institutionId: inst.id,
        },
      }),
    ])

    return { txHash, paymasterBalanceWei: balance.toString() }
  }

  async syncInstitutionBalance(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, onChainId: true },
    })
    if (!inst) return null

    const balance = await this.blockchainSvc.getPaymasterInstitutionBalance(
      inst.onChainId as `0x${string}`
    )

    await this.prisma.institution.update({
      where: { id: inst.id },
      data: { paymasterBalance: balance.toString() },
    })

    return { paymasterBalanceWei: balance.toString() }
  }

  async fundSponsoredPool(amountEth: string, adminId: string): Promise<{ txHash: string } | { error: string }> {
    let amountWei: bigint
    try {
      amountWei = parseEther(amountEth)
    } catch {
      return { error: "Invalid amount" }
    }

    let txHash = ""
    try {
      txHash = await this.blockchainSvc.fundSponsoredPool(amountWei)
    } catch (err) {
      log.error({ err }, "Failed to fund sponsored pool")
      return { error: "Funding transaction failed" }
    }

    await this.prisma.auditLog.create({
      data: {
        action: "SPONSORED_POOL_FUNDED",
        details: { amountWei: amountWei.toString(), txHash },
        adminId,
      },
    })

    return { txHash }
  }

  async listEmployers(page: number) {
    const limit = 20
    const skip = (page - 1) * limit

    const [total, items] = await this.prisma.$transaction([
      this.prisma.employer.count(),
      this.prisma.employer.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          cacNumber: true,
          walletAddress: true,
          kycApproved: true,
          active: true,
          freeVerificationsRemaining: true,
          createdAt: true,
        },
      }),
    ])

    return { total, page, limit, items }
  }

  async approveEmployer(employerId: string, adminId: string) {
    const emp = await this.prisma.employer.findUnique({ where: { id: employerId } })
    if (!emp) return null

    if (!emp.walletAddress) return null

    try {
      const alreadyInitialised = await this.blockchainSvc.isEmployerInitialised(
        emp.walletAddress as `0x${string}`
      )
      if (!alreadyInitialised) {
        await this.blockchainSvc.initialiseEmployer(emp.walletAddress as `0x${string}`)
      }
    } catch (err) {
      log.error({ err, employerId }, "Failed to initialise employer on-chain")
      const msg = err instanceof Error ? err.message : "Unknown blockchain error"
      throw new Error(msg)
    }

    await this.prisma.$transaction([
      this.prisma.employer.update({
        where: { id: employerId },
        data: { kycApproved: true },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "KYC_APPROVED",
          details: { role: "employer", orgName: emp.name },
          adminId,
          employerId: emp.id,
        },
      }),
    ])

    await this.emailService.sendKycApproval({
      to: emp.email,
      orgName: emp.name,
      role: "employer",
    })

    return true
  }

  async deactivateInstitution(institutionId: string, adminId: string, reason: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null

    const deactivatedAt = new Date()

    await this.prisma.$transaction([
      this.prisma.institution.update({
        where: { id: institutionId },
        data: {
          active: false,
          deactivatedAt,
          deactivationReason: reason,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "INSTITUTION_DEACTIVATED",
          details: { orgName: inst.name, reason },
          adminId,
          institutionId: inst.id,
        },
      }),
    ])

    await this.emailService.sendInstitutionDeactivationAlert({
      to: inst.email,
      orgName: inst.name,
      reason,
      date: deactivatedAt.toISOString(),
    })

    return true
  }

  async deactivateEmployer(employerId: string, adminId: string, reason: string) {
    const emp = await this.prisma.employer.findUnique({ where: { id: employerId } })
    if (!emp) return null

    const deactivatedAt = new Date()

    await this.prisma.$transaction([
      this.prisma.employer.update({
        where: { id: employerId },
        data: {
          active: false,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "EMPLOYER_DEACTIVATED",
          details: { orgName: emp.name, reason },
          adminId,
          employerId: emp.id,
        },
      }),
    ])

    // E-mail the employer
    await this.emailService.sendEmployerDeactivationAlert({
      to: emp.email,
      orgName: emp.name,
      reason,
      date: deactivatedAt.toISOString(),
    })

    return true
  }

  async getPlatformStats() {
    let paymasterBalance = "0"
    let adminWalletBalance = "0"
    let sponsoredPoolEth = "0"
    let entryPointDepositEth = "0"
    try {
      const { config } = await import("../config/index.js")
      const addr = config.PAYMASTER_VAULT_ADDRESS
      if (addr) {
        const weis = await this.blockchainSvc.getBalance(addr as `0x${string}`)
        paymasterBalance = formatEther(weis)
      }
      if (config.PLATFORM_ADMIN_ADDRESS) {
        const adminWeis = await this.blockchainSvc.getBalance(
          config.PLATFORM_ADMIN_ADDRESS as `0x${string}`
        )
        adminWalletBalance = formatEther(adminWeis)
      }
      if (addr) {
        const poolWei = await this.blockchainSvc.getPaymasterSponsoredPool()
        sponsoredPoolEth = formatEther(poolWei)
        const depositWei = await this.blockchainSvc.getPaymasterEntryPointDeposit()
        entryPointDepositEth = formatEther(depositWei)
      }
    } catch (err) {
      log.error({ err }, "Could not fetch paymaster or admin wallet balance")
    }

    const [institutions, employers, batches, verifications, activeInstitutionsList] =
      await this.prisma.$transaction([
        this.prisma.institution.count(),
        this.prisma.employer.count(),
        this.prisma.batch.count({ where: { status: "CONFIRMED" } }),
        this.prisma.verificationRequest.count({ where: { result: "VERIFIED" } }),
        this.prisma.institution.findMany({
          where: { kycApproved: true, active: true },
          select: { name: true },
          orderBy: { createdAt: "desc" },
        }),
      ])

    const totalCredentials = await this.prisma.credential.count()
    const revokedCount = await this.prisma.credential.count({ where: { status: "REVOKED" } })

    return {
      institutions,
      employers,
      confirmedBatches: batches,
      successfulVerifications: verifications,
      totalCredentials,
      revokedCredentials: revokedCount,
      activeInstitutionNames: activeInstitutionsList.map((i) => i.name),
      paymasterBalance,
      adminWalletBalance,
      sponsoredPoolEth,
      entryPointDepositEth,
    }
  }
}
