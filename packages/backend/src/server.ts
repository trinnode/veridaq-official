import "./workers/batch.processor.js"
/**
 * VERIDAQ Fastify server entry point.
 *
 * Plugin registration order matters:
 *   1. Infrastructure plugins (cors, helmet, cookie, rate-limit, multipart)
 *   2. Auth plugin (registers JWT helpers used by route preHandlers)
 *   3. Route plugins
 *   4. Swagger (registers after routes so all schemas are available)
 */

import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import multipart from "@fastify/multipart"
import rateLimit from "@fastify/rate-limit"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import Fastify, { type FastifyError } from "fastify"
import { ZodError } from "zod"

import { config } from "./config/index.js"
import { authPlugin } from "./plugins/auth.js"
import { prismaPlugin } from "./plugins/prisma.js"
import { redisPlugin } from "./plugins/redis.js"

import { adminRoutes } from "./routes/admin.js"
import { authRoutes } from "./routes/auth.js"
import { employerRoutes } from "./routes/employer.js"
import { institutionRoutes } from "./routes/institution.js"
import { crossmintRoutes } from "./routes/crossmint.js"
import { earningsRoutes } from "./routes/earnings.js"
import { fxRoutes } from "./routes/fx.js"
import { paymentRoutes } from "./routes/payment.js"
import { statsRoutes } from "./routes/stats.js"
import { verificationRoutes } from "./routes/verification.js"
import { BlockchainService } from "./services/blockchain.service.js"
import { FX_CACHE_KEY, type FxQuote } from "./services/fx.service.js"
import { ReconcileService } from "./services/reconcile.service.js"

const loggerConfig =
  config.NODE_ENV === "production"
    ? { level: "warn" }
    : { level: "info", transport: { target: "pino-pretty", options: { colorize: true } } }

const app = Fastify({
  logger: loggerConfig,
  // Limit request bodies to 10 MB. Excel files with thousands of rows are
  // typically well under this; raise it if institutions report failures.
  bodyLimit: 10 * 1024 * 1024,
  // Trust the Railway proxy so req.protocol reflects x-forwarded-proto.
  // Without this, cookies would always think they're on HTTP (internal
  // proxy connection) and would set secure=false, breaking cross-origin auth.
  trustProxy: true,
})

async function bootstrap() {
  const extensionOrigins = (config.EXTENSION_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === "production",
  })

  // CORS — allow the configured frontend URL and any Railway
  // subdomain (dynamic `.up.railway.app` origins).  Railway
  // generates per-service subdomains that the user can't predict
  // at build time, so a static list won't work.
  const isRailwayOrigin = (origin: string) =>
    origin.endsWith(".up.railway.app") ||
    /^https:\/\/[a-z0-9-]+\.railway\.app$/.test(origin)

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (
        origin === config.FRONTEND_URL ||
        isRailwayOrigin(origin) ||
        extensionOrigins.includes(origin)
      ) {
        return cb(null, true)
      }
      return cb(new Error("Origin not allowed"), false)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })

  // Cookie support — used for httpOnly JWT refresh tokens
  await app.register(cookie, {
    secret: config.JWT_SECRET,
  })

  // Rate limiting — apply globally; tighten on auth routes in the route plugin
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    redis: app.redis, // uses the redis plugin registered below
  })

  // Multipart — for Excel file uploads (max 10 MB per file)
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

  // Database and cache
  await app.register(prismaPlugin)
  await app.register(redisPlugin)

  // Fix any institutions with non-hex onChainId (legacy seed bug)
  const crypto = await import("crypto")
  try {
    const badInstitutions = await app.prisma.$queryRaw<{ id: string; on_chain_id: string; kyc_approved: boolean }[]>`
      SELECT id, "onChainId" as on_chain_id, "kycApproved" as kyc_approved FROM institutions
      WHERE "onChainId" !~ '^0x[0-9a-f]{64}$'
    `
    for (const inst of badInstitutions) {
      const newOnChainId = "0x" + crypto.createHash("sha256").update(inst.id).digest("hex")
      await app.prisma.institution.update({
        where: { id: inst.id },
        data: { onChainId: newOnChainId, blockchainStatus: inst.kyc_approved ? "PENDING" : "NOT_REGISTERED" },
      })
      app.log.warn({ institutionId: inst.id, oldOnChainId: inst.on_chain_id, newOnChainId }, "Fixed non-hex onChainId")
    }
  } catch (err) {
    app.log.warn({ err }, "onChainId migration skipped — table may not exist yet")
  }

  // Validate platform admin wallet at startup
  try {
    const { privateKeyToAccount } = await import("viem/accounts")
    const rawKey = config.PLATFORM_ADMIN_PRIVATE_KEY
    if (rawKey) {
      const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
      const acct = privateKeyToAccount(key as `0x${string}`)
      app.log.info({ address: acct.address }, "Platform admin wallet validated")
    } else {
      app.log.error("PLATFORM_ADMIN_PRIVATE_KEY is not set — batch registration will fail")
    }
  } catch (err) {
    app.log.error({ err }, "CRITICAL: PLATFORM_ADMIN_PRIVATE_KEY is invalid — batch registration will fail")
  }

  // Auth plugin — registers jwtVerify, jwtSign, and role-check decorators
  await app.register(authPlugin)

  // API documentation (available at /docs in non-production environments)
  if (config.NODE_ENV !== "production") {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "VERIDAQ API",
          version: "1.0.0",
          description: "Privacy-preserving credential verification platform.",
        },
        components: {
          securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
        },
      },
    })
    await app.register(swaggerUi, { routePrefix: "/docs" })
  }

  // ── Error handling ──────────────────────────────────────────────
  // A Zod failure is the client's mistake, not a server fault. Without this
  // it surfaced as a 500 on any route that used `.parse()`, which reads as an
  // outage and hides the actual field that was wrong.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid request",
        details: error.issues.map((issue) => ({
          path: issue.path.join(".") || "(body)",
          message: issue.message,
        })),
      })
    }

    const statusCode =
      typeof error.statusCode === "number" && error.statusCode >= 400 ? error.statusCode : 500
    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed")
      return reply.code(500).send({ error: "Internal server error" })
    }
    return reply.code(statusCode).send({ error: error.message })
  })

  // ── Public routes (no auth) ─────────────────────────────────────
  // Must be registered before any plugin that adds auth hooks,
  // because Fastify parent hooks propagate to all child contexts.
  await app.register(async function publicRoutes(publicApp) {
    const { VerificationService } = await import("./services/verification.service.js")
    const verifySvc = new VerificationService(publicApp.prisma)

    publicApp.get("/api/verify/check/:id", async (req, rep) => {
      const { id } = req.params as { id: string }
      if (!id) return rep.code(400).send({ error: "Missing verification ID" })

      const request = await verifySvc.getPublicRequest(id)
      if (!request) return rep.code(404).send({ error: "Verification record not found" })
      if (!request.result || !request.completedAt) {
        return rep.code(202).send({ status: request.status, message: "Verification still processing" })
      }

      return {
        id: request.id,
        status: request.status,
        result: request.result,
        institution: request.institution?.name ?? null,
        claimType: request.claimType,
        threshold: request.threshold,
        txHash: request.txHash,
        completedAt: request.completedAt,
      }
    })
  })

  // Routes
  await app.register(authRoutes, { prefix: "/api/auth" })
  await app.register(institutionRoutes, { prefix: "/api/institution" })
  await app.register(earningsRoutes, { prefix: "/api/earnings" })
  await app.register(employerRoutes, { prefix: "/api/employer" })
  await app.register(adminRoutes, { prefix: "/api/admin" })
  await app.register(verificationRoutes, { prefix: "/api/verify" })
  await app.register(paymentRoutes, { prefix: "/api/payment" })
  await app.register(crossmintRoutes, { prefix: "/api/crossmint" })
  await app.register(statsRoutes, { prefix: "/api/stats" })
  await app.register(fxRoutes, { prefix: "/api/fx" })

  // Auto-fix stuck PROCESSING verification requests from before the last restart
  try {
    const stuckCount = await app.prisma.verificationRequest.updateMany({
      where: { status: "PROCESSING" },
      data: {
        status: "FAILED",
        result: "CLAIM_NOT_SATISFIED",
        completedAt: new Date(),
        proofJson: JSON.stringify({ note: "Auto-failed on server restart — proof gen interrupted" }),
      },
    })
    if (stuckCount.count > 0) {
      app.log.warn({ count: stuckCount.count }, "Fixed stuck verification requests from prior session")
    }
  } catch (err) {
    app.log.warn({ err }, "Failed to auto-fix stuck verification requests")
  }

  // Health check — used by Docker and load balancers
  // ── Health ───────────────────────────────────────────────────────────────
  // Reports each dependency separately. A single "ok" hides which part is
  // broken; a monitor needs to know whether the database is unreachable, the
  // chain RPC is timing out, or the FX rate has quietly gone stale.
  //
  // The chain probe is memoised for 15 seconds so a 1-second monitor does not
  // turn into a denial-of-service against the public RPC.
  const health = {
    chainAt: 0,
    chainOk: false,
    blockNumber: null as string | null,
    chainError: null as string | null,
  }
  const blockchainSvc = new BlockchainService()

  async function checkChain() {
    if (Date.now() - health.chainAt < 15_000) {
      return { ok: health.chainOk, blockNumber: health.blockNumber, error: health.chainError }
    }
    health.chainAt = Date.now()

    // Two attempts, because the first RPC call after a restart pays for a cold
    // TCP/TLS handshake and a 5s cap is not always enough for it. Without the
    // retry, every deploy produces a 503 on the first health check and pages
    // whoever is on call for something that is not broken.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const block = await Promise.race([
          blockchainSvc.getBlockNumber(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("RPC timed out after 5s")), 5_000).unref?.()
          ),
        ])
        health.chainOk = true
        health.blockNumber = block.toString()
        health.chainError = null
        return { ok: true, blockNumber: health.blockNumber, error: null }
      } catch (err) {
        if (attempt === 2) {
          health.chainOk = false
          health.blockNumber = null
          health.chainError = err instanceof Error ? err.message : "RPC unreachable"
        }
      }
    }
    return { ok: health.chainOk, blockNumber: health.blockNumber, error: health.chainError }
  }

  app.get("/health", async (_req, rep) => {
    const database = await app.prisma
      .$queryRaw`SELECT 1`
      .then(() => ({ ok: true, error: null as string | null }))
      .catch((err: unknown) => ({
        ok: false,
        error: err instanceof Error ? err.message : "database unreachable",
      }))

    const redis = await app.redis
      .ping()
      .then(() => ({ ok: true, error: null as string | null }))
      .catch((err: unknown) => ({
        ok: false,
        error: err instanceof Error ? err.message : "redis unreachable",
      }))

    const chain = await checkChain()

    const fx = await app.redis
      .get(FX_CACHE_KEY)
      .then((raw) => {
        if (!raw) return { ok: true, status: "uninitialised" as const }
        const quote = JSON.parse(raw) as FxQuote
        const ageMinutes = Math.round(
          (Date.now() - new Date(quote.fetchedAt).getTime()) / 60_000
        )
        return {
          ok: !quote.stale,
          status: quote.stale ? ("stale" as const) : ("fresh" as const),
          rate: quote.rate,
          ageMinutes,
          refreshMinutes: quote.refreshMinutes,
        }
      })
      .catch(() => ({ ok: false, status: "unreadable" as const }))

    const ok = database.ok && redis.ok && chain.ok
    const payload = {
      status: ok ? "ok" : "degraded",
      ts: new Date().toISOString(),
      checks: { database, redis, chain, fx },
    }

    // 503 makes a monitor act; the body still explains which check failed.
    return rep.code(ok ? 200 : 503).send(payload)
  })

  await app.listen({ port: config.PORT, host: "0.0.0.0" })
  app.log.info(`Server running at http://0.0.0.0:${config.PORT}`)

  if (config.NODE_ENV !== "production") {
    app.log.info(`API docs at http://localhost:${config.PORT}/docs`)
  }

  // Free-verification reconciliation. The contract is authoritative; this keeps
  // the database mirror honest. It runs in-process so no extra worker process is
  // required, and every run is idempotent.
  if (config.FREE_VERIFICATION_SYNC_MINUTES > 0) {
    const reconcileSvc = new ReconcileService(app.prisma)
    const run = () =>
      reconcileSvc
        .syncAll()
        .then((summary) => {
          if (summary.updated > 0 || summary.failed > 0) {
            app.log.info(summary, "free-verification reconciliation")
          }
        })
        .catch((err) => app.log.warn({ err }, "free-verification reconciliation failed"))

    const timer = setInterval(run, config.FREE_VERIFICATION_SYNC_MINUTES * 60_000)
    timer.unref()
    const first = setTimeout(run, 30_000)
    first.unref()
    app.log.info(
      { everyMinutes: config.FREE_VERIFICATION_SYNC_MINUTES },
      "free-verification reconciliation scheduled"
    )
  }
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err)
  process.exit(1)
})
