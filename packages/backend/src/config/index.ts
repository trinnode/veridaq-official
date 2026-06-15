/**
 * Centralised, Zod-validated environment configuration.
 * The server will not start if any required variable is missing or malformed.
 * This prevents silent misconfiguration in any environment.
 */

import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1000).max(65535).default(4000),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_SECRET: z.string().min(32),
  REFRESH_EXPIRES_IN: z.string().default("7d"),
  EXTENSION_JWT_EXPIRES_IN: z.string().default("5m"),

  ALCHEMY_API_KEY: z.string().min(1),
  ALCHEMY_BASE_SEPOLIA_URL: z.string().url(),

  INSTITUTION_REGISTRY_ADDRESS: z.string().optional(),
  CREDENTIAL_REGISTRY_ADDRESS: z.string().optional(),
  REVOCATION_REGISTRY_ADDRESS: z.string().optional(),
  PAYMASTER_VAULT_ADDRESS: z.string().optional(),
  SUBSCRIPTION_MANAGER_ADDRESS: z.string().optional(),
  ZK_VERIFIER_ADDRESS: z.string().optional(),
  ENTRY_POINT_ADDRESS: z.string().default("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"),

  BUNDLER_RPC_URL: z.string().url().optional(),
  AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS: z.string().optional(),
  AA_SIMPLE_ACCOUNT_OWNER_PRIVATE_KEY: z.string().min(64).optional(),
  AA_SIMPLE_ACCOUNT_SALT: z.coerce.number().int().nonnegative().default(0),

  PLATFORM_ADMIN_PRIVATE_KEY: z.string().min(64).optional(),
  PLATFORM_ADMIN_ADDRESS: z.string().optional(),

  CIRCUIT_ZKEY_PATH: z.string().min(1),
  CIRCUIT_WASM_PATH: z.string().min(1),

  // Must be exactly 64 hex characters (32 bytes)
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex chars"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  BASESCAN_API_KEY: z.string().optional(),

  EXTENSION_ORIGINS: z.string().optional(),

  CROSSMINT_SERVER_API_KEY: z.string().optional(),
  CROSSMINT_WEBHOOK_SECRET: z.string().optional(),

  // Revenue sharing
  VERIFICATION_PRICE_USD: z.coerce.number().positive().default(1.50),
  PLATFORM_REVENUE_SHARE_PERCENT: z.coerce.number().int().min(0).max(100).default(70),
  INSTITUTION_REVENUE_SHARE_PERCENT: z.coerce.number().int().min(0).max(100).default(20),
  GAS_POOL_REVENUE_SHARE_PERCENT: z.coerce.number().int().min(0).max(100).default(10),

  // Batch upload pricing (flat fees per range)
  BATCH_PRICE_1001_5000_USD: z.coerce.number().positive().default(20),
  BATCH_PRICE_5001_10000_USD: z.coerce.number().positive().default(30),
  BATCH_PRICE_10001_25000_USD: z.coerce.number().positive().default(90),
  BATCH_PRICE_25001_50000_USD: z.coerce.number().positive().default(170),

  // Credit pack pricing
  CREDIT_PACK_5_USD: z.coerce.number().positive().default(7),
  CREDIT_PACK_10_USD: z.coerce.number().positive().default(15),
  CREDIT_PACK_25_USD: z.coerce.number().positive().default(35),
  CREDIT_PACK_50_USD: z.coerce.number().positive().default(65),
  CREDIT_PACK_100_USD: z.coerce.number().positive().default(120),
  CREDIT_PACK_500_USD: z.coerce.number().positive().default(550),

  // Gas pool
  GAS_POOL_MIN_BALANCE_USD: z.coerce.number().positive().default(10),
  GAS_POOL_LOW_BALANCE_ALERT: z.coerce.boolean().default(false),

  // Batch processing
  MAX_BATCH_CHUNK_SIZE: z.coerce.number().int().positive().default(200),

  // Operator wallet for sending crypto withdrawals
  PLATFORM_OPERATOR_PRIVATE_KEY: z.string().min(64).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("Environment variable validation failed:")
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
export type Config = typeof config
