/**
 * ETH/USD reference price.
 *
 * Payouts are denominated in USD but settled in ETH, so the conversion has to
 * use a current price rather than a literal baked into the source. The quote is
 * cached in-process for a few minutes: a payout does not need second-level
 * precision, and a burst of withdrawals should not hammer the provider.
 *
 * Failure policy is deliberately conservative. If the provider cannot be
 * reached the fallback is used and the caller records that fact in the payout
 * metadata, so an operator can see which rate was applied.
 */

import pino from "pino"
import { config } from "../config/index.js"

const log = pino({ name: "eth-price" })

export type EthUsdQuote = {
  usd: number
  source: string
  fetchedAt: string
  stale: boolean
}

const PROVIDER = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"

let cached: EthUsdQuote | null = null

function isFresh(quote: EthUsdQuote): boolean {
  const age = Date.now() - new Date(quote.fetchedAt).getTime()
  return Number.isFinite(age) && age >= 0 && age < config.ETH_USD_CACHE_SECONDS * 1000
}

function fallbackQuote(): EthUsdQuote {
  return {
    usd: config.ETH_USD_FALLBACK,
    source: "config-fallback",
    fetchedAt: new Date().toISOString(),
    stale: true,
  }
}

/**
 * Returns the current ETH price in USD. Never throws: a network failure yields
 * the configured fallback instead, because refusing a payout outright is worse
 * than paying at a documented reference rate.
 */
export async function getEthUsdQuote(): Promise<EthUsdQuote> {
  if (cached && isFresh(cached)) return cached

  try {
    const res = await fetch(PROVIDER, {
      signal: AbortSignal.timeout(8_000),
      headers: { accept: "application/json" },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const body = (await res.json()) as { ethereum?: { usd?: number } }
    const usd = body.ethereum?.usd
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
      throw new Error("malformed payload")
    }

    cached = {
      usd,
      source: "coingecko",
      fetchedAt: new Date().toISOString(),
      stale: false,
    }
    return cached
  } catch (err) {
    log.warn({ err }, "ETH/USD lookup failed, using the configured fallback")
    // Keep a stale real quote if we have one: it is still closer to market than
    // the fallback constant.
    if (cached) return { ...cached, stale: true }
    return fallbackQuote()
  }
}

/** Test seam — clears the in-process cache between cases. */
export function resetEthUsdCache(): void {
  cached = null
}
