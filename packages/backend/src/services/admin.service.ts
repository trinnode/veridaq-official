/**
 * AdminService — institution and employer KYC approval, tier management,
 * and platform-level statistics for the admin portal.
 *
 * BlockchainService is injected via the constructor so that tests can swap in
 * a mock without dynamic require() hacks.
 */

import { PrismaClient } from "@prisma/client"
import crypto from "crypto"
import PDFDocument from "pdfkit"
import ExcelJS from "exceljs"
import pino from "pino"
import { formatEther, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { config } from "../config/index.js"
import { BlockchainService } from "./blockchain.service.js"
import { EmailService } from "./email.service.js"
import { encrypt } from "../utils/crypto.js"

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

  private async createDefaultClaims(institutionId: string): Promise<void> {
    const existingClaims = await this.prisma.claimDefinition.count({
      where: { institutionId },
    })
    if (existingClaims > 0) return

    const defaults = [
      { label: "Graduated", claimCode: 1, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student graduated in a valid year (1960–2030)" },
      { label: "Minimum Second Class Lower", claimCode: 2, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved at least Second Class Lower (classification ≥ 2)" },
      { label: "Minimum Second Class Upper", claimCode: 3, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved at least Second Class Upper (classification ≥ 3)" },
      { label: "First Class", claimCode: 4, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved First Class (classification == 4)" },
      { label: "CGPA Above Threshold", claimCode: 5, threshold: 350, reviewType: "AUTO" as const, description: "Verify CGPA meets a minimum threshold (employer sets the value)" },
      { label: "Programme Completion", claimCode: 6, threshold: 0, reviewType: "MANUAL" as const, description: "Institution confirms the student completed a specific programme" },
    ]

    await this.prisma.claimDefinition.createMany({
      data: defaults.map((cd) => ({
        institutionId,
        label: cd.label,
        claimCode: cd.claimCode,
        threshold: cd.threshold,
        reviewType: cd.reviewType,
        description: cd.description,
        active: true,
      })),
      skipDuplicates: true,
    })

    log.info({ institutionId, count: defaults.length }, "Default claim definitions created")
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
          blockchainStatus: true,
          alsoEmployer: true,
          employerProfile: { select: { id: true, kycApproved: true, freeVerificationsRemaining: true, verificationCredits: true } },
          _count: { select: { batches: true } },
        },
      }),
    ])

    return { total, page, limit, items }
  }

  async approveInstitution(institutionId: string, adminId: string, adminWalletOverride?: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null

    // Allow admin to override the wallet before on-chain registration.
    // This lets the platform admin correct a dummy wallet before going on-chain.
    const walletForChain = adminWalletOverride ?? inst.adminWallet

    // If the institution has no admin wallet override and no generated wallet,
    // generate one now so we never register a dummy address on-chain.
    let finalWallet = walletForChain
    if (!inst.adminKeyEncrypted && !adminWalletOverride) {
      const pk = "0x" + crypto.randomBytes(32).toString("hex")
      const acct = privateKeyToAccount(pk as `0x${string}`)
      finalWallet = acct.address
      const { encryptedData: ek, encryptedIv: eiv, encryptedTag: etag } = encrypt(pk.slice(2))
      // Persist the generated key immediately so the batch processor can use it
      await this.prisma.institution.update({
        where: { id: institutionId },
        data: {
          adminWallet: finalWallet as string,
          adminKeyEncrypted: ek,
          adminKeyIv: eiv,
          adminKeyTag: etag,
        },
      })
    }

    // Update blockchainStatus to PENDING immediately so UI can show loading state
    await this.prisma.institution.update({
      where: { id: institutionId },
      data: { blockchainStatus: "PENDING" },
    })

    // Register on-chain if missing, then set tier
    try {
      const alreadyRegistered = await this.blockchainSvc.isInstitutionRegistered(inst.onChainId as `0x${string}`)
      if (!alreadyRegistered) {
        await this.blockchainSvc.registerInstitution(inst.onChainId as `0x${string}`, inst.name, finalWallet as `0x${string}`, inst.publicKey)
      }
      const onChainTier = await this.blockchainSvc.getInstitutionTier(inst.onChainId as `0x${string}`)
      const desiredTier = inst.tier === "FREE" ? 0 : 1
      if (onChainTier !== desiredTier) {
        await this.blockchainSvc.setInstitutionTier(inst.onChainId as `0x${string}`, inst.tier)
      }
      await this.prisma.institution.update({
        where: { id: institutionId },
        data: { blockchainStatus: "REGISTERED" },
      })
    } catch (err) {
      log.error({ err, institutionId }, "On-chain registration failed — DB approved with FAILED status")
      await this.prisma.institution.update({
        where: { id: institutionId },
        data: { blockchainStatus: "FAILED" },
      })
    }

    const updateData: Record<string, unknown> = { kycApproved: true }
    if (adminWalletOverride) {
      updateData.adminWallet = adminWalletOverride
      // If the institution doesn't have a generated key yet, generate one for this wallet
      if (!inst.adminKeyEncrypted) {
        const pk = "0x" + crypto.randomBytes(32).toString("hex")
        const { encryptedData: ek, encryptedIv: eiv, encryptedTag: etag } = encrypt(pk.slice(2))
        updateData.adminKeyEncrypted = ek
        updateData.adminKeyIv = eiv
        updateData.adminKeyTag = etag
      }
    }

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

    // Auto-create default claim definitions for newly approved institutions
    await this.createDefaultClaims(institutionId)

    // Send the good news (best-effort — don't fail the request if email is down)
    try {
      await this.emailService.sendKycApproval({
        to: inst.email,
        orgName: inst.name,
        role: "institution",
      })
    } catch (emailErr) {
      log.error({ emailErr, institutionId }, "Failed to send KYC approval email")
    }

    // Return the current blockchain status
    const updated = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    return { ok: true, blockchainStatus: updated?.blockchainStatus ?? "UNKNOWN" }
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

    if (inst.onChainId && config.INSTITUTION_REGISTRY_ADDRESS) {
      try {
        await this.blockchainSvc.deactivateInstitutionOnChain(inst.onChainId as `0x${string}`)
        log.info({ institutionId }, "Institution deactivated on-chain")
      } catch (err) {
        log.error({ err, institutionId }, "Failed to deactivate institution on-chain (DB already updated)")
      }
    }

    await this.emailService.sendInstitutionDeactivationAlert({
      to: inst.email,
      orgName: inst.name,
      reason,
      date: deactivatedAt.toISOString(),
    })

    return true
  }

  async reactivateInstitution(institutionId: string, adminId: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null
    if (inst.active) return false

    await this.prisma.$transaction([
      this.prisma.institution.update({
        where: { id: institutionId },
        data: {
          active: true,
          deactivatedAt: null,
          deactivationReason: null,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "INSTITUTION_REACTIVATED",
          details: { orgName: inst.name },
          adminId,
          institutionId: inst.id,
        },
      }),
    ])

    if (inst.onChainId && config.INSTITUTION_REGISTRY_ADDRESS) {
      try {
        await this.blockchainSvc.reactivateInstitutionOnChain(inst.onChainId as `0x${string}`)
        log.info({ institutionId }, "Institution reactivated on-chain")
      } catch (err) {
        log.error({ err, institutionId }, "Failed to reactivate institution on-chain (DB already updated)")
      }
    }

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

  async updateInstitution(institutionId: string, data: { email?: string; adminWallet?: string; active?: boolean; deactivationReason?: string }, adminId: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null

    const updateData: Record<string, unknown> = {}
    if (data.email) updateData.email = data.email
    if (data.adminWallet) updateData.adminWallet = data.adminWallet
    if (typeof data.active === "boolean") {
      updateData.active = data.active
      updateData.deactivatedAt = data.active ? null : new Date()
      if (!data.active && data.deactivationReason) {
        updateData.deactivationReason = data.deactivationReason
      }
    }

    if (Object.keys(updateData).length === 0) return { ok: true }

    const details = {
      previous: { email: inst.email, adminWallet: inst.adminWallet, active: inst.active },
      updated: Object.fromEntries(Object.entries(updateData)),
    }

    await this.prisma.$transaction([
      this.prisma.institution.update({
        where: { id: institutionId },
        data: updateData,
      }),
      this.prisma.auditLog.create({
        data: {
          action: updateData.active === false ? "INSTITUTION_DEACTIVATED" : updateData.active === true ? "INSTITUTION_REACTIVATED" : "INSTITUTION_UPDATED",
          details: details as any,
          adminId,
          institutionId: inst.id,
        },
      }),
    ])

    return { ok: true }
  }

  async getInstitutionReport(institutionId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        _count: { select: { batches: true, verificationRequests: true, claims: true } },
        batches: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, status: true, studentCount: true, graduationYear: true, createdAt: true },
        },
        employerProfile: {
          select: { id: true, name: true, email: true, kycApproved: true, freeVerificationsRemaining: true, verificationCredits: true },
        },
        earnings: true,
      },
    })
    if (!inst) return null

    const verifiedCount = await this.prisma.verificationRequest.count({
      where: { institutionId, result: "VERIFIED" },
    })

    return {
      id: inst.id,
      name: inst.name,
      email: inst.email,
      tier: inst.tier,
      active: inst.active,
      kycApproved: inst.kycApproved,
      blockchainStatus: inst.blockchainStatus,
      adminWallet: inst.adminWallet,
      onChainId: inst.onChainId,
      alsoEmployer: inst.alsoEmployer,
      createdAt: inst.createdAt,
      deactivatedAt: inst.deactivatedAt,
      deactivationReason: inst.deactivationReason,
      stats: {
        totalBatches: inst._count.batches,
        totalVerifications: inst._count.verificationRequests,
        verifiedVerifications: verifiedCount,
        totalClaims: inst._count.claims,
      },
      recentBatches: inst.batches,
      employerProfile: inst.employerProfile,
      earnings: inst.earnings,
    }
  }

  async getInstitutionReportPdf(institutionId: string): Promise<Buffer | null> {
    const data = await this.getInstitutionReport(institutionId)
    if (!data) return null

    const NAVY = "#0f172a"
    const WHITE = "#ffffff"
    const FG = "#1e293b"
    const MUTED = "#64748b"
    const BORDER = "#e2e8f0"
    const ROW_LIGHT = "#f8fafc"
    const FONT = "Helvetica"
    const FONT_BOLD = "Helvetica-Bold"
    const M = 40

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    })

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: M })
      const chunks: Buffer[] = []
      doc.on("data", (chunk) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      const CW = doc.page.width - M * 2
      const LX = M
      const PAGE_BOTTOM = doc.page.height - M

      function row(label: string, value: string, mono = false) {
        const rh = 14
        if (doc.y + rh > PAGE_BOTTOM) doc.addPage()
        const ry = doc.y
        doc.rect(LX, ry, CW, rh).fill(ry % 28 === 0 ? ROW_LIGHT : WHITE)
        doc.fontSize(7.5).fillColor(MUTED).font(FONT)
        doc.text(label, LX + 8, ry + 3, { width: 130 })
        doc.fillColor(FG)
        doc.font(mono ? "Courier" : FONT).fontSize(mono ? 6.5 : 7.5)
        doc.text(value, LX + 146, ry + 3, { width: CW - 160, lineBreak: false })
        doc.y = ry + rh
      }

      function section(title: string) {
        if (doc.y + 30 > PAGE_BOTTOM) doc.addPage()
        doc.y += 8
        doc.fontSize(9).fillColor(NAVY).font(FONT_BOLD)
        doc.text(title, LX, doc.y)
        doc.y += 2
        doc.rect(LX, doc.y, CW, 0.5).fill(BORDER)
        doc.y += 6
      }

      // Header
      doc.rect(0, 0, doc.page.width, 50).fill(NAVY)
      doc.rect(0, 50, doc.page.width, 1).fill(MUTED)
      doc.fontSize(15).fillColor(WHITE).font(FONT_BOLD)
      doc.text("VERIDAQ", M + 4, 13)
      doc.fontSize(6.5).fillColor(MUTED)
      doc.text("Institution Report", M + 4, 31)
      doc.fontSize(8).fillColor(WHITE).font("Courier")
      doc.text(`REF: ${data.id.slice(0, 8).toUpperCase()}`, M, 13, { width: CW, align: "right" })
      doc.y = 60

      // Institution Details
      section("Institution Details")
      row("Name", data.name)
      row("Email", data.email)
      row("Tier", data.tier)
      row("KYC Status", data.kycApproved ? "Approved" : "Pending")
      row("Blockchain Status", data.blockchainStatus ?? "N/A")
      row("Active", data.active ? "Yes" : "No")
      row("Also Employer", data.alsoEmployer ? "Yes" : "No")
      row("Admin Wallet", data.adminWallet, true)
      row("On-Chain ID", data.onChainId ?? "N/A", true)
      row("Created", dateFormatter.format(new Date(data.createdAt)))
      if (data.deactivatedAt) row("Deactivated", dateFormatter.format(new Date(data.deactivatedAt)))
      if (data.deactivationReason) row("Reason", data.deactivationReason)

      // Stats
      doc.y += 4
      section("Statistics")
      row("Total Batches", String(data.stats.totalBatches))
      row("Total Verifications", String(data.stats.totalVerifications))
      row("Verified Verifications", String(data.stats.verifiedVerifications))
      row("Total Claims", String(data.stats.totalClaims))

      // Recent Batches
      if (data.recentBatches.length > 0) {
        doc.y += 4
        section("Recent Batches")
        const batchHeaders = ["Status", "Students", "Year", "Date"]
        const colW = (CW - 16) / batchHeaders.length
        doc.fontSize(7).fillColor(NAVY).font(FONT_BOLD)
        batchHeaders.forEach((h, i) => doc.text(h, LX + 8 + i * colW, doc.y, { width: colW }))
        doc.y += 2
        doc.rect(LX + 4, doc.y, CW - 8, 0.5).fill(BORDER)
        doc.y += 6
        data.recentBatches.forEach((b, i) => {
          if (doc.y + 14 > PAGE_BOTTOM) doc.addPage()
          doc.rect(LX, doc.y, CW, 12).fill(i % 2 === 0 ? ROW_LIGHT : WHITE)
          doc.fontSize(7).fillColor(FG).font(FONT)
          doc.text(b.status, LX + 8, doc.y + 1, { width: colW })
          doc.text(String(b.studentCount ?? "-"), LX + 8 + colW, doc.y + 1, { width: colW })
          doc.text(String(b.graduationYear ?? "-"), LX + 8 + colW * 2, doc.y + 1, { width: colW })
          doc.text(dateFormatter.format(new Date(b.createdAt)), LX + 8 + colW * 3, doc.y + 1, { width: colW })
          doc.y += 12
        })
      }

      // Employer Profile
      if (data.employerProfile) {
        doc.y += 4
        section("Employer Profile")
        row("Name", data.employerProfile.name)
        row("Email", data.employerProfile.email)
        row("KYC Approved", data.employerProfile.kycApproved ? "Yes" : "No")
        row("Free Verifications", String(data.employerProfile.freeVerificationsRemaining))
        row("Paid Credits", String(data.employerProfile.verificationCredits))
      }

      // Footer
      const fh = 30
      const fy = PAGE_BOTTOM - fh
      doc.rect(0, fy, doc.page.width, fh).fill(NAVY)
      doc.rect(0, fy, doc.page.width, 0.5).fill(MUTED)
      doc.fontSize(6).fillColor(MUTED).font(FONT)
      doc.text(`Generated ${dateFormatter.format(new Date())}  ·  Report ${data.id.slice(0, 8).toUpperCase()}`, M, fy + 8, { width: CW, align: "center" })
      doc.fontSize(5.5).fillColor(MUTED)
      doc.text("VERIDAQ — Censor-Resistant Academic Truth", M, fy + 19, { width: CW, align: "center" })

      doc.end()
    })
  }

  async approveInstitutionEmployerAccess(institutionId: string, adminId: string) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      include: { employerProfile: true },
    })
    if (!inst) return null

    if (inst.employerProfile) {
      // Reactivate existing employer profile
      await this.prisma.$transaction([
        this.prisma.employer.update({
          where: { id: inst.employerProfile.id },
          data: { active: true, kycApproved: true },
        }),
        this.prisma.institution.update({
          where: { id: institutionId },
          data: { alsoEmployer: true },
        }),
        this.prisma.auditLog.create({
          data: {
            action: "EMPLOYER_ACCESS_APPROVED",
            details: { orgName: inst.name, employerId: inst.employerProfile.id },
            adminId,
            institutionId: inst.id,
          },
        }),
      ])

      if (inst.employerProfile.walletAddress) {
        try {
          await this.blockchainSvc.initialiseEmployer(inst.employerProfile.walletAddress as `0x${string}`)
          log.info({ institutionId, wallet: inst.employerProfile.walletAddress }, "Employer initialised on-chain")
        } catch (err) {
          log.error({ err, institutionId }, "Failed to initialise employer on-chain (DB already updated)")
        }
      }

      return { ok: true, message: "Employer access approved" }
    }

    // No employer profile exists — create one
    const pk = "0x" + crypto.randomBytes(32).toString("hex")
    const acct = privateKeyToAccount(pk as `0x${string}`)
    const empId = `emp-${institutionId}`

    await this.prisma.$transaction([
      this.prisma.employer.create({
        data: {
          id: empId,
          name: `${inst.name} (Employer)`,
          cacNumber: `AUTO-${inst.id.slice(0, 8)}`,
          email: `employer-${inst.email}`,
          passwordHash: inst.passwordHash,
          walletAddress: acct.address,
          kycApproved: true,
          active: true,
          freeVerificationsRemaining: 3,
          verificationCredits: 0,
          institutionId: inst.id,
        },
      }),
      this.prisma.institution.update({
        where: { id: institutionId },
        data: { alsoEmployer: true },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "EMPLOYER_ACCESS_APPROVED",
          details: { orgName: inst.name, employerId: empId, walletCreated: acct.address },
          adminId,
          institutionId: inst.id,
        },
      }),
    ])

    try {
      await this.blockchainSvc.initialiseEmployer(acct.address)
      log.info({ institutionId, wallet: acct.address }, "New employer initialised on-chain")
    } catch (err) {
      log.error({ err, institutionId }, "Failed to initialise new employer on-chain (DB already updated)")
    }

    return { ok: true, message: "Employer access granted with new profile" }
  }

  async generateInstitutionWallet(institutionId: string, adminId: string, manualWallet?: string) {
    const inst = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!inst) return null

    let walletAddress: string
    let encryptedKey: string | null = null
    let encryptedIv: string | null = null
    let encryptedTag: string | null = null

    if (manualWallet) {
      walletAddress = manualWallet
    } else {
      const pk = "0x" + crypto.randomBytes(32).toString("hex")
      const acct = privateKeyToAccount(pk as `0x${string}`)
      walletAddress = acct.address
      const { encryptedData, encryptedIv: iv, encryptedTag: tag } = encrypt(pk.slice(2))
      encryptedKey = encryptedData
      encryptedIv = iv
      encryptedTag = tag
    }

    await this.prisma.$transaction([
      this.prisma.institution.update({
        where: { id: institutionId },
        data: {
          adminWallet: walletAddress,
          ...(encryptedKey ? { adminKeyEncrypted: encryptedKey } : {}),
          ...(encryptedIv ? { adminKeyIv: encryptedIv } : {}),
          ...(encryptedTag ? { adminKeyTag: encryptedTag } : {}),
        },
      }),
      this.prisma.auditLog.create({
        data: {
          action: "WALLET_GENERATED",
          details: { orgName: inst.name, walletAddress, generatedBy: manualWallet ? "manual" : "auto" },
          adminId,
          institutionId: inst.id,
        },
      }),
    ])

    return { ok: true, walletAddress }
  }

  // Helper to safely convert Prisma Decimal to number
  private toNum(val: unknown): number {
    if (val == null) return 0
    if (typeof val === "number") return val
    if (typeof (val as any).toNumber === "function") return (val as any).toNumber()
    return Number(val)
  }

  // ─── Revenue Analytics (time series for charts) ────────────────────────

  async getRevenueAnalytics(days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const transactions = await this.prisma.earningTransaction.findMany({
      where: { createdAt: { gte: since }, type: "EARNED" },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        amountUsd: true,
        platformShareUsd: true,
        institutionShareUsd: true,
        poolShareUsd: true,
      },
    })

    // Group by day
    const dailyMap = new Map<string, { revenue: number; platform: number; institution: number; pool: number; count: number }>()
    for (const tx of transactions) {
      const day = tx.createdAt.toISOString().slice(0, 10)
      const entry = dailyMap.get(day) ?? { revenue: 0, platform: 0, institution: 0, pool: 0, count: 0 }
      entry.revenue += this.toNum(tx.amountUsd)
      entry.platform += this.toNum(tx.platformShareUsd)
      entry.institution += this.toNum(tx.institutionShareUsd)
      entry.pool += this.toNum(tx.poolShareUsd)
      entry.count++
      dailyMap.set(day, entry)
    }

    const dailySeries: Array<{ date: string; revenue: number; platform: number; institution: number; pool: number; count: number }> = []
    const cursor = new Date(since)
    const today = new Date()
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10)
      const entry = dailyMap.get(key)
      dailySeries.push({
        date: key,
        revenue: entry?.revenue ?? 0,
        platform: entry?.platform ?? 0,
        institution: entry?.institution ?? 0,
        pool: entry?.pool ?? 0,
        count: entry?.count ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    // Aggregates
    const totalRevenue = transactions.reduce((s, t) => s + this.toNum(t.amountUsd), 0)
    const totalPlatform = transactions.reduce((s, t) => s + this.toNum(t.platformShareUsd), 0)
    const totalInstitution = transactions.reduce((s, t) => s + this.toNum(t.institutionShareUsd), 0)
    const totalPool = transactions.reduce((s, t) => s + this.toNum(t.poolShareUsd), 0)

    return {
      daily: dailySeries,
      totals: {
        revenue: parseFloat(totalRevenue.toFixed(2)),
        platform: parseFloat(totalPlatform.toFixed(2)),
        institution: parseFloat(totalInstitution.toFixed(2)),
        pool: parseFloat(totalPool.toFixed(2)),
        count: transactions.length,
      },
    }
  }

  // ─── Registration Analytics ────────────────────────────────────────────

  async getRegistrationAnalytics(days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const [institutions, employers, credentials, verifications] = await Promise.all([
      this.prisma.institution.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.employer.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.credential.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.verificationRequest.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, result: true },
        orderBy: { createdAt: "asc" },
      }),
    ])

    const groupByDay = <T extends { createdAt: Date }>(items: T[], getVal?: (item: T) => number) => {
      const map = new Map<string, number>()
      for (const item of items) {
        const day = item.createdAt.toISOString().slice(0, 10)
        map.set(day, (map.get(day) ?? 0) + (getVal ? getVal(item) : 1))
      }
      return map
    }

    const instMap = groupByDay(institutions)
    const empMap = groupByDay(employers)
    const credMap = groupByDay(credentials)
    const verMap = groupByDay(verifications)
    const verifiedMap = groupByDay(verifications.filter((v) => v.result === "VERIFIED"))

    const series: Array<{ date: string; institutions: number; employers: number; credentials: number; verifications: number; verified: number }> = []
    const cursor = new Date(since)
    const today = new Date()
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10)
      series.push({
        date: key,
        institutions: instMap.get(key) ?? 0,
        employers: empMap.get(key) ?? 0,
        credentials: credMap.get(key) ?? 0,
        verifications: verMap.get(key) ?? 0,
        verified: verifiedMap.get(key) ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return { daily: series }
  }

  // ─── Monthly Analytics (for charts) ───────────────────────────────────

  async getMonthlyAnalytics(months = 6) {
    const since = new Date()
    since.setMonth(since.getMonth() - months)
    since.setDate(1)
    since.setHours(0, 0, 0, 0)

    const [institutions, employers, credentials, verifications, earnings] = await Promise.all([
      this.prisma.institution.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.employer.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.credential.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.verificationRequest.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, result: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.earningTransaction.findMany({
        where: { createdAt: { gte: since }, type: "EARNED" },
        select: { createdAt: true, amountUsd: true, platformShareUsd: true, poolShareUsd: true, institutionShareUsd: true },
        orderBy: { createdAt: "asc" },
      }),
    ])

    const monthMap = new Map<string, {
      month: string
      institutions: number
      employers: number
      credentials: number
      verifications: number
      verified: number
      revenue: number
      platformShare: number
      institutionShare: number
      poolShare: number
    }>()

    const cursor = new Date(since)
    while (cursor <= new Date()) {
      const key = cursor.toISOString().slice(0, 7)
      monthMap.set(key, {
        month: key,
        institutions: 0,
        employers: 0,
        credentials: 0,
        verifications: 0,
        verified: 0,
        revenue: 0,
        platformShare: 0,
        institutionShare: 0,
        poolShare: 0,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    for (const i of institutions) {
      const key = i.createdAt.toISOString().slice(0, 7)
      monthMap.get(key)!.institutions++
    }
    for (const e of employers) {
      const key = e.createdAt.toISOString().slice(0, 7)
      monthMap.get(key)!.employers++
    }
    for (const c of credentials) {
      const key = c.createdAt.toISOString().slice(0, 7)
      monthMap.get(key)!.credentials++
    }
    for (const v of verifications) {
      const key = v.createdAt.toISOString().slice(0, 7)
      const entry = monthMap.get(key)!
      entry.verifications++
      if (v.result === "VERIFIED") entry.verified++
    }
    for (const e of earnings) {
      const key = e.createdAt.toISOString().slice(0, 7)
      const entry = monthMap.get(key)!
      entry.revenue += this.toNum(e.amountUsd)
      entry.platformShare += this.toNum(e.platformShareUsd)
      entry.institutionShare += this.toNum(e.institutionShareUsd)
      entry.poolShare += this.toNum(e.poolShareUsd)
    }

    const series = Array.from(monthMap.values())
    return {
      months: series.length,
      series,
      totals: {
        institutions: series.reduce((s, m) => s + m.institutions, 0),
        employers: series.reduce((s, m) => s + m.employers, 0),
        credentials: series.reduce((s, m) => s + m.credentials, 0),
        verifications: series.reduce((s, m) => s + m.verifications, 0),
        verified: series.reduce((s, m) => s + m.verified, 0),
        revenue: parseFloat(series.reduce((s, m) => s + m.revenue, 0).toFixed(2)),
      },
    }
  }

  // ─── Transaction History with Filters ──────────────────────────────────

  async listAllTransactions(filters: {
    page?: number | undefined
    limit?: number | undefined
    type?: string | undefined
    institutionId?: string | undefined
    dateFrom?: string | undefined
    dateTo?: string | undefined
  }) {
    const page = filters.page ?? 1
    const limit = Math.min(100, filters.limit ?? 20)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters.type) where.type = filters.type
    if (filters.institutionId) where.institutionId = filters.institutionId
    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, Date> = {}
      if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) createdAt.lte = new Date(filters.dateTo)
      where.createdAt = createdAt
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.earningTransaction.count({ where }),
      this.prisma.earningTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          institution: { select: { name: true } },
        },
      }),
    ])

    const mapped = items.map((item) => ({
      id: item.id,
      type: item.type,
      amountUsd: item.amountUsd.toNumber(),
      amountWei: item.amountWei.toNumber(),
      platformShareUsd: item.platformShareUsd?.toNumber() ?? null,
      institutionShareUsd: item.institutionShareUsd?.toNumber() ?? null,
      poolShareUsd: item.poolShareUsd?.toNumber() ?? null,
      description: item.description,
      referenceId: item.referenceId,
      institutionName: (item as any).institution?.name ?? null,
      createdAt: item.createdAt,
    }))

    return { total, page, limit, items: mapped }
  }

  // ─── Export Analytics ──────────────────────────────────────────────────

  async exportAnalytics(format: "json" | "xlsx", days = 90) {
    const revenue = await this.getRevenueAnalytics(days)
    const registrations = await this.getRegistrationAnalytics(days)

    const transactions = await this.prisma.earningTransaction.findMany({
      where: { createdAt: { gte: new Date(Date.now() - days * 86400000) } },
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { institution: { select: { name: true } } },
    })

    if (format === "json") {
      return {
        contentType: "application/json",
        filename: `veridaq-analytics-${new Date().toISOString().slice(0, 10)}.json`,
        data: JSON.stringify({ revenue, registrations, transactions, exportedAt: new Date().toISOString() }, null, 2),
      }
    }

    // Excel export
    const workbook = new ExcelJS.Workbook()

    // Sheet 1: Revenue Summary
    const revSheet = workbook.addWorksheet("Revenue Summary")
    revSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Revenue ($)", key: "revenue", width: 14 },
      { header: "Platform Share ($)", key: "platform", width: 18 },
      { header: "Institution Share ($)", key: "institution", width: 20 },
      { header: "Gas Pool Share ($)", key: "pool", width: 18 },
      { header: "Verifications", key: "count", width: 14 },
    ]
    for (const row of revenue.daily) {
      revSheet.addRow(row)
    }
    // Totals row
    revSheet.addRow({
      date: "TOTAL",
      revenue: revenue.totals.revenue,
      platform: revenue.totals.platform,
      institution: revenue.totals.institution,
      pool: revenue.totals.pool,
      count: revenue.totals.count,
    })

    // Sheet 2: Registration Trends
    const regSheet = workbook.addWorksheet("Registration Trends")
    regSheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Institutions", key: "institutions", width: 14 },
      { header: "Employers", key: "employers", width: 14 },
      { header: "Credentials", key: "credentials", width: 14 },
      { header: "Verifications", key: "verifications", width: 14 },
      { header: "Verified", key: "verified", width: 14 },
    ]
    for (const row of registrations.daily) {
      regSheet.addRow(row)
    }

    // Sheet 3: All Transactions
    const txSheet = workbook.addWorksheet("Transactions")
    txSheet.columns = [
      { header: "Date", key: "date", width: 18 },
      { header: "Type", key: "type", width: 14 },
      { header: "Institution", key: "institution", width: 24 },
      { header: "Amount ($)", key: "amount", width: 14 },
      { header: "Platform Share", key: "platform", width: 16 },
      { header: "Institution Share", key: "institutionShare", width: 18 },
      { header: "Pool Share", key: "pool", width: 14 },
      { header: "Reference", key: "reference", width: 28 },
    ]
    for (const tx of transactions) {
      txSheet.addRow({
        date: tx.createdAt.toISOString(),
        type: tx.type,
        institution: (tx as any).institution?.name ?? "—",
        amount: this.toNum(tx.amountUsd),
        platform: this.toNum(tx.platformShareUsd),
        institutionShare: this.toNum(tx.institutionShareUsd),
        pool: this.toNum(tx.poolShareUsd),
        reference: tx.referenceId ?? "—",
      })
    }

    const buf = await workbook.xlsx.writeBuffer()
    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `veridaq-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`,
      data: Buffer.from(buf as ArrayBuffer),
    }
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
