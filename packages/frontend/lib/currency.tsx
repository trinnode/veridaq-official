"use client"
/**
 * Currency display layer.
 *
 * Every amount the API returns is USD, and every payment is charged in USD.
 * This context only chooses how that number is *rendered*: Naira by default,
 * US dollars on request. The user's choice persists in localStorage.
 *
 * The rate is fetched from /api/fx/rate on mount and refreshed every 30
 * minutes, matching the backend cache window. If the fetch fails we keep the
 * last known rate (and say so), because a wrong-looking price is worse than a
 * visibly stale one.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { api } from "./api"

export type Currency = "NGN" | "USD"

type Quote = {
  rate: number
  fetchedAt: string
  stale: boolean
  source: string
}

type CurrencyCtx = {
  currency: Currency
  setCurrency: (next: Currency) => void
  toggleCurrency: () => void
  /** Naira per USD currently in use. */
  rate: number
  /** True until the first rate fetch settles. */
  loading: boolean
  /** True when the displayed rate is older than the refresh window. */
  stale: boolean
  rateUpdatedAt: string | null
  /** Format a USD amount into the active display currency. */
  format: (usd: number, opts?: { decimals?: number }) => string
  /** Always-USD helper for places that must state the actual charge. */
  formatUsd: (usd: number) => string
  /** Always-NGN helper for a secondary "≈ ₦…" line. */
  formatNgn: (usd: number) => string
}

// Used only until the first successful fetch. Kept deliberately conservative
// rather than precise — it is replaced within the first second of page load.
const INITIAL_RATE = 1350
const STORAGE_KEY = "veridaq.currency"
const REFRESH_MS = 30 * 60 * 1000

const Ctx = createContext<CurrencyCtx>({} as CurrencyCtx)

function nairaFormatter(maximumFractionDigits: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
}

function dollarFormatter(fractionDigits: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("NGN")
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)

  // Read the saved preference after mount so the server and first client render
  // agree (both start at NGN) and React does not report a hydration mismatch.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === "NGN" || saved === "USD") setCurrencyState(saved)
    } catch {
      // localStorage can be unavailable in private mode; NGN remains the default.
    }
  }, [])

  const loadRate = useCallback(async () => {
    try {
      const { data } = await api.get<Quote>("/fx/rate")
      if (data && Number.isFinite(data.rate) && data.rate > 0) {
        setQuote(data)
      }
    } catch {
      // Leave the previous quote in place. `format` falls back to INITIAL_RATE.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRate()
    const timer = setInterval(loadRate, REFRESH_MS)
    return () => clearInterval(timer)
  }, [loadRate])

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference is still applied for this session even if it cannot persist.
    }
  }, [])

  const toggleCurrency = useCallback(() => {
    setCurrencyState((prev) => {
      const next: Currency = prev === "NGN" ? "USD" : "NGN"
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignored — session-only preference
      }
      return next
    })
  }, [])

  const rate = quote?.rate ?? INITIAL_RATE

  const format = useCallback(
    (usd: number, opts?: { decimals?: number }) => {
      const safe = Number.isFinite(usd) ? usd : 0
      if (currency === "USD") {
        return dollarFormatter(opts?.decimals ?? 2).format(safe)
      }
      const converted = safe * rate
      // Naira is not quoted in cents in normal use. Below ₦100 keep two
      // decimals so small unit prices (per-credit costs) stay legible.
      const digits = opts?.decimals ?? (Math.abs(converted) < 100 ? 2 : 0)
      return nairaFormatter(digits).format(converted)
    },
    [currency, rate],
  )

  const formatUsd = useCallback((usd: number) => {
    const safe = Number.isFinite(usd) ? usd : 0
    return dollarFormatter(2).format(safe)
  }, [])

  const formatNgn = useCallback(
    (usd: number) => {
      const safe = Number.isFinite(usd) ? usd : 0
      const converted = safe * rate
      const digits = Math.abs(converted) < 100 ? 2 : 0
      return nairaFormatter(digits).format(converted)
    },
    [rate],
  )

  const value = useMemo<CurrencyCtx>(
    () => ({
      currency,
      setCurrency,
      toggleCurrency,
      rate,
      loading,
      stale: quote?.stale ?? false,
      rateUpdatedAt: quote?.fetchedAt ?? null,
      format,
      formatUsd,
      formatNgn,
    }),
    [currency, setCurrency, toggleCurrency, rate, loading, quote, format, formatUsd, formatNgn],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCurrency(): CurrencyCtx {
  return useContext(Ctx)
}
