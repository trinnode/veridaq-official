/**
 * USD → NGN reference rate.
 *
 * USD is the system of record for every price, payment and payout. This service
 * exists only so the interface can render a Naira figure, and so that figure is
 * defensible: it is the **median of several independent providers**, not
 * whichever one happened to answer first.
 *
 * Why consensus rather than first-success: the daily FX APIs all mirror the
 * same upstream dataset, and a single provider returning 0, null or a decimal
 * in the wrong place would otherwise reprice the entire product. Taking the
 * median means one broken or wildly divergent source is outvoted.
 *
 * Refresh cadence is FX_REFRESH_MINUTES (30). The quote is cached in Redis so
 * every instance serves the same number and the provider budget stays tiny
 * (2 requests per hour per provider).
 *
 * Measured behaviour at time of writing (all keyless, all HTTP 200):
 *   fxratesapi.com       ₦1,346.23  intraday timestamp, 61 req/min
 *   open.er-api.com      ₦1,346.47  daily, 1500 req/month
 *   fawazahmed0/jsDelivr ₦1,346.60  daily, CDN, unlimited
 *   exchangerate-api v4  ₦1,346.47  daily
 *
 * CoinGecko USDT/NGN is polled as a *liveness* cross-check only. It is not
 * allowed to set the price: a thin crypto pair or a brief depeg would otherwise
 * move every Naira figure on the site.
 */

import type { Redis } from "ioredis"
import pino from "pino"
import { config } from "../config/index.js"

const log = pino({ name: "fx-service" })

export type FxQuote = {
  base: "USD"
  quote: "NGN"
  /** Naira per one US dollar — the median of the responsive providers. */
  rate: number
  /** ISO timestamp of this retrieval. */
  fetchedAt: string
  /** Providers whose value formed the median. */
  sources: string[]
  /** How many sane values were collected. */
  agreement: number
  /** (max - min) / median, as a percentage. Large values mean providers disagree. */
  spreadPercent: number
  /** True when a live cross-check landed within tolerance of the median. */
  intraday: boolean
  /** True when the value is older than the refresh window. */
  stale: boolean
  /** Provider name, "cache", or "fallback". */
  source: string
  refreshMinutes: number
}

const CACHE_KEY = "fx:usd-ngn"

// 1 USD has sat between roughly ₦400 and ₦2,000 since 2020. Anything outside
// this band is a broken payload, not an exchange rate.
const SANE_MIN = 100
const SANE_MAX = 100_000

// A live cross-check further than this from the median is discarded rather
// than shown to users. 3% absorbs normal intraday movement.
const INTRADAY_TOLERANCE_PERCENT = 3

type Provider = {
  name: string
  url: string
  /** Pull NGN-per-USD out of this provider's particular response shape. */
  pick: (payload: any) => unknown
}

const USD_PROVIDERS: Provider[] = [
  {
    name: "fxratesapi.com",
    url: "https://api.fxratesapi.com/latest?base=USD&currencies=NGN",
    pick: (p) => p?.rates?.NGN,
  },
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    pick: (p) => p?.rates?.NGN,
  },
  {
    name: "fawazahmed0",
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    pick: (p) => p?.usd?.ngn,
  },
  {
    name: "exchangerate-api.com",
    url: "https://api.exchangerate-api.com/v4/latest/USD",
    pick: (p) => p?.rates?.NGN,
  },
]

const LIVENESS_PROVIDER = {
  name: "coingecko-usdt",
  url: "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn&include_last_updated_at=true",
  pick: (p: any) => p?.tether?.ngn,
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function toSaneRate(raw: unknown): number | null {
  const value = typeof raw === "string" ? Number(raw) : raw
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < SANE_MIN || value > SANE_MAX) return null
  return value
}

/**
 * Median of the collected values. With an even count this averages the two
 * middle values, which is exactly the behaviour we want: a single outlier at
 * either end cannot shift the result.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const lower = sorted[mid - 1] ?? 0
  const upper = sorted[mid] ?? 0
  return sorted.length % 2 === 1 ? upper : (lower + upper) / 2
}

function isFresh(quote: FxQuote): boolean {
  const ageMs = Date.now() - new Date(quote.fetchedAt).getTime()
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < config.FX_REFRESH_MINUTES * 60_000
}

export class FxService {
  private memory: FxQuote | null = null
  private inFlight: Promise<FxQuote> | null = null

  constructor(private readonly redis?: Redis) {}

  /** The configured URL is treated as an additional provider, so a deployment
   *  can point at its own bank feed without losing the consensus check. */
  private providers(): Provider[] {
    const configured = config.FX_API_URL
    if (USD_PROVIDERS.some((p) => p.url === configured)) return USD_PROVIDERS
    return [
      {
        name: new URL(configured).hostname,
        url: configured,
        pick: (p) => p?.rates?.NGN ?? p?.conversion_rates?.NGN ?? p?.usd?.ngn,
      },
      ...USD_PROVIDERS,
    ]
  }

  private fallbackQuote(): FxQuote {
    return {
      base: "USD",
      quote: "NGN",
      rate: config.FX_FALLBACK_USD_NGN,
      fetchedAt: new Date().toISOString(),
      sources: [],
      agreement: 0,
      spreadPercent: 0,
      intraday: false,
      // Marked stale so the UI can label it rather than silently pretending it
      // is a live market rate.
      stale: true,
      source: "fallback",
      refreshMinutes: config.FX_REFRESH_MINUTES,
    }
  }

  private async persist(quote: FxQuote): Promise<void> {
    if (!this.redis) return
    try {
      await this.redis.set(
        CACHE_KEY,
        JSON.stringify(quote),
        "EX",
        config.FX_REFRESH_MINUTES * 60,
      )
    } catch (err) {
      log.warn({ err }, "could not persist FX rate to redis")
    }
  }

  /**
   * Resolve the current rate. Concurrent callers share one provider round trip
   * so a cold cache under load does not fan out into N outbound requests.
   */
  async getUsdToNgn(forceRefresh = false): Promise<FxQuote> {
    if (!forceRefresh) {
      if (this.memory && isFresh(this.memory)) return this.memory

      if (this.redis) {
        try {
          const raw = await this.redis.get(CACHE_KEY)
          if (raw) {
            const cached = JSON.parse(raw) as FxQuote
            if (cached?.rate && Number.isFinite(cached.rate)) {
              this.memory = cached
              if (isFresh(cached)) return cached
            }
          }
        } catch (err) {
          log.warn({ err }, "could not read FX rate from redis")
        }
      }
    }

    if (this.inFlight) return this.inFlight

    this.inFlight = this.refresh()
    try {
      return await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  private async refresh(): Promise<FxQuote> {
    const providers = this.providers()

    // All providers are queried in parallel. A slow or failing one costs the
    // timeout, not the whole request.
    const settled = await Promise.allSettled(
      providers.map(async (provider) => {
        const payload = await fetchJson(provider.url)
        const rate = toSaneRate(provider.pick(payload))
        if (rate === null) throw new Error("no sane NGN rate in payload")
        return { name: provider.name, rate }
      }),
    )

    const hits: { name: string; rate: number }[] = []
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        hits.push(result.value)
      } else {
        log.warn(
          { provider: providers[index]?.name ?? "unknown", err: result.reason?.message ?? result.reason },
          "FX provider unavailable",
        )
      }
    })

    if (hits.length > 0) {
      const rates = hits.map((h) => h.rate)
      const rate = median(rates)
      const spreadPercent = ((Math.max(...rates) - Math.min(...rates)) / rate) * 100

      if (spreadPercent > 2) {
        // Worth knowing about: the median still protects users, but a jump this
        // size usually means one provider is misreporting or the market moved.
        log.warn(
          { rate, spreadPercent: Number(spreadPercent.toFixed(3)), hits },
          "FX providers disagree",
        )
      }

      const intraday = await this.confirmIntraday(rate)

      const quote: FxQuote = {
        base: "USD",
        quote: "NGN",
        rate,
        fetchedAt: new Date().toISOString(),
        sources: hits.map((h) => h.name),
        agreement: hits.length,
        spreadPercent: Number(spreadPercent.toFixed(3)),
        intraday,
        stale: false,
        source: hits.length > 1 ? "consensus" : (hits[0]?.name ?? "provider"),
        refreshMinutes: config.FX_REFRESH_MINUTES,
      }

      this.memory = quote
      await this.persist(quote)
      log.info(
        { rate, sources: quote.sources, spreadPercent: quote.spreadPercent, intraday },
        "FX rate refreshed",
      )
      return quote
    }

    // Every provider failed. Prefer the last known real rate over the constant,
    // because a two-hour-old rate is still far closer than a hardcoded one.
    if (this.memory) {
      log.warn({ rate: this.memory.rate }, "serving stale FX rate")
      return { ...this.memory, stale: true }
    }

    log.error("no FX provider reachable and no cached rate — using configured fallback")
    return this.fallbackQuote()
  }

  /**
   * Ask a live market source whether it agrees with the daily-median figure.
   * Returns true only when it is within tolerance; a disagreement is logged and
   * discarded rather than shown, because a thin pair can briefly print anything.
   */
  private async confirmIntraday(rate: number): Promise<boolean> {
    try {
      const payload = await fetchJson(LIVENESS_PROVIDER.url)
      const live = toSaneRate(LIVENESS_PROVIDER.pick(payload))
      if (live === null) return false
      const delta = Math.abs(live - rate) / rate * 100
      if (delta > INTRADAY_TOLERANCE_PERCENT) {
        log.warn(
          { live, rate, deltaPercent: Number(delta.toFixed(3)) },
          "intraday FX cross-check outside tolerance — ignored",
        )
        return false
      }
      return true
    } catch (err) {
      // The cross-check is best effort; the median already stands on its own.
      log.debug({ err }, "intraday FX cross-check unavailable")
      return false
    }
  }
}
