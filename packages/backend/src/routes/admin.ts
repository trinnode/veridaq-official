/**
 * Admin routes — KYC approval, tier management, platform monitoring.
 *
 * GET  /api/admin/institutions          — list all institutions
 * POST /api/admin/institutions/:id/approve  — approve KYC
 * POST /api/admin/institutions/:id/tier     — change tier
 * GET  /api/admin/employers             — list all employers
 * POST /api/admin/employers/:id/approve     — approve employer KYC
 * GET  /api/admin/stats                 — platform-level statistics
 * GET  /api/admin/payments              — list all payments
 * GET  /api/admin/audit                 — audit log
 */

import type { FastifyPluginAsync } from "fastify"
import { parseEther } from "viem"
import { z } from "zod"
import { AdminService } from "../services/admin.service.js"
import { EarningsService } from "../services/earnings.service.js"
import { PaymentService } from "../services/payment.service.js"

const tierBody = z.object({
  tier: z.enum(["FREE", "PAID"]),
})

const deactivateBody = z.object({
  reason: z.string().min(10),
})

const fundBody = z.object({
  amountEth: z.string().min(1),
})

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const adminSvc = new AdminService(app.prisma)
  const paymentSvc = new PaymentService(app.prisma)

  app.addHook("preHandler", app.requireAdmin)

  app.get("/institutions", async (req) => {
    const q = req.query as { page?: string; search?: string }
    return adminSvc.listInstitutions(Number(q.page ?? 1), q.search)
  })

  app.post("/institutions/:id/approve", async (req, rep) => {
    const { id } = req.params as { id: string }
    const body = req.body as { adminWallet?: string } | null
    try {
      const result = await adminSvc.approveInstitution(id, req.jwtPayload.sub, body?.adminWallet)
      if (!result) return rep.code(404).send({ error: "Institution not found" })
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Approval failed"
      return rep.code(500).send({ error: msg })
    }
  })

  app.post("/institutions/:id/tier", async (req, rep) => {
    const { id } = req.params as { id: string }
    const { tier } = tierBody.parse(req.body)
    const result = await adminSvc.setInstitutionTier(id, tier)
    if (!result) return rep.code(404).send({ error: "Institution not found" })
    return { ok: true }
  })

  app.post("/institutions/:id/fund", async (req, rep) => {
    const { id } = req.params as { id: string }
    const { amountEth } = fundBody.parse(req.body)

    let amountWei: bigint
    try {
      amountWei = parseEther(amountEth)
    } catch {
      return rep.code(400).send({ error: "Invalid amount" })
    }

    const result = await adminSvc.fundInstitutionBalance(id, amountWei, req.jwtPayload.sub)
    if (!result) return rep.code(404).send({ error: "Institution not found" })
    if ("error" in result) return rep.code(400).send({ error: result.error })
    return result
  })

  app.post("/institutions/:id/sync-balance", async (req, rep) => {
    const { id } = req.params as { id: string }
    try {
      const result = await adminSvc.syncInstitutionBalance(id)
      if (!result) return rep.code(404).send({ error: "Institution not found" })
      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync failed"
      return rep.code(500).send({ error: message })
    }
  })

  app.post("/paymaster/fund-sponsor", async (req, rep) => {
    const { amountEth } = fundBody.parse(req.body)
    const result = await adminSvc.fundSponsoredPool(amountEth, req.jwtPayload.sub)
    if ("error" in result) return rep.code(400).send({ error: result.error })
    return result
  })

  app.post("/institutions/:id/deactivate", async (req, rep) => {
    const { id } = req.params as { id: string }
    const { reason } = deactivateBody.parse(req.body)
    const result = await adminSvc.deactivateInstitution(id, req.jwtPayload.sub, reason)
    if (!result) return rep.code(404).send({ error: "Institution not found" })
    return { ok: true }
  })

  app.get("/employers", async (req) => {
    const q = req.query as { page?: string }
    return adminSvc.listEmployers(Number(q.page ?? 1))
  })

  app.post("/employers/:id/approve", async (req, rep) => {
    const { id } = req.params as { id: string }
    const result = await adminSvc.approveEmployer(id, req.jwtPayload.sub)
    if (!result) return rep.code(404).send({ error: "Employer not found" })
    return { ok: true }
  })

  app.post("/employers/:id/deactivate", async (req, rep) => {
    const { id } = req.params as { id: string }
    const { reason } = deactivateBody.parse(req.body)
    const result = await adminSvc.deactivateEmployer(id, req.jwtPayload.sub, reason)
    if (!result) return rep.code(404).send({ error: "Employer not found" })
    return { ok: true }
  })

  app.get("/stats", async () => adminSvc.getPlatformStats())

  app.get("/payments", async (req) => {
    const q = req.query as { page?: string; limit?: string; status?: string }
    return paymentSvc.listPayments({
      page: Number(q.page ?? 1),
      limit: Number(q.limit ?? 50),
      status: q.status as any,
    })
  })

  app.get("/audit", async (req) => {
    const q = req.query as { page?: string; limit?: string }
    const page = Number(q.page ?? 1)
    const limit = Number(q.limit ?? 50)
    const skip = (page - 1) * limit
    const [total, items] = await app.prisma.$transaction([
      app.prisma.auditLog.count(),
      app.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ])
    return { total, page, limit, items }
  })

  // ── Admin: Earnings / Gas Pool ──────────────────────────────────────────

  app.get("/earnings/pool", async () => {
    const svc = new EarningsService(app.prisma)
    return svc.getGasPoolSummary()
  })

  app.get("/earnings/platform", async () => {
    const svc = new EarningsService(app.prisma)
    return svc.getPlatformEarnings()
  })

  app.get("/earnings/institutions", async (req) => {
    const q = req.query as { page?: string; limit?: string }
    const page = Math.max(1, Number(q.page ?? 1))
    const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)))
    const svc = new EarningsService(app.prisma)
    return svc.listAllInstitutionEarnings(page, limit)
  })

  app.post("/earnings/withdraw/:id/process", async (req, rep) => {
    const { id } = req.params as { id: string }
    const body = req.body as { approved: boolean } | null
    try {
      const svc = new EarningsService(app.prisma)
      return svc.processFiatWithdrawal(id, body?.approved ?? true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Processing failed"
      return rep.code(400).send({ error: message })
    }
  })
}
