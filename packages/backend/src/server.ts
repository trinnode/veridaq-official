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
import Fastify from "fastify"

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
import { paymentRoutes } from "./routes/payment.js"
import { statsRoutes } from "./routes/stats.js"
import { verificationRoutes } from "./routes/verification.js"

const loggerConfig =
  config.NODE_ENV === "production"
    ? { level: "warn" }
    : { level: "info", transport: { target: "pino-pretty", options: { colorize: true } } }

const app = Fastify({
  logger: loggerConfig,
  // Limit request bodies to 10 MB. Excel files with thousands of rows are
  // typically well under this; raise it if institutions report failures.
  bodyLimit: 10 * 1024 * 1024,
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

  // CORS — only allow the configured frontend origin
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (origin === config.FRONTEND_URL || extensionOrigins.includes(origin)) {
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
    parseOptions: { httpOnly: true, sameSite: "lax", secure: config.NODE_ENV === "production" },
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
  app.get("/health", async () => ({ status: "ok", ts: Date.now() }))

  await app.listen({ port: config.PORT, host: "0.0.0.0" })
  app.log.info(`Server running at http://0.0.0.0:${config.PORT}`)

  if (config.NODE_ENV !== "production") {
    app.log.info(`API docs at http://localhost:${config.PORT}/docs`)
  }
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err)
  process.exit(1)
})
