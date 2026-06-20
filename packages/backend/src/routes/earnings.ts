import type { FastifyPluginAsync } from "fastify"
import { z } from "zod"
import { EarningsService } from "../services/earnings.service.js"

const withdrawBody = z.object({
  amountUsd: z.number().positive().min(10),
  method: z.enum(["CRYPTO", "FIAT"]),
  destinationWallet: z.string().optional(),
})

const walletBody = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM wallet address"),
})

export const earningsRoutes: FastifyPluginAsync = async (app) => {
  const earningsSvc = new EarningsService(app.prisma)

  // All routes require institution auth
  app.addHook("preHandler", app.requireInstitution)

  // ── Earnings summary ────────────────────────────────────────────────────

  app.get("/", async (req) => {
    return earningsSvc.getInstitutionSummary(req.jwtPayload.sub)
  })

  // ── Transaction history ─────────────────────────────────────────────────

  app.get("/transactions", async (req) => {
    const query = req.query as { page?: string; limit?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 20)))
    return earningsSvc.listTransactions(req.jwtPayload.sub, page, limit)
  })

  // ── Request withdrawal ──────────────────────────────────────────────────

  app.post("/withdraw", async (req, rep) => {
    const body = withdrawBody.parse(req.body)
    try {
      const result = await earningsSvc.requestWithdrawal(
        req.jwtPayload.sub,
        body.amountUsd,
        body.method,
        body.destinationWallet
      )
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "Withdrawal failed"
      return rep.code(400).send({ error: message })
    }
  })

  // ── Set payout wallet ───────────────────────────────────────────────────

  app.put("/wallet", async (req, _rep) => {
    const body = walletBody.parse(req.body)
    await earningsSvc.setPayoutWallet(req.jwtPayload.sub, body.walletAddress)
    return { ok: true }
  })
}
