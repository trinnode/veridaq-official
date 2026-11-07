/**
 * FX service tests.
 *
 * These are pure unit tests: global fetch is stubbed per provider URL, so no
 * network access and no database rows are involved. The property that matters
 * most is that one bad provider cannot move the displayed rate, so several
 * cases below assert exactly that.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { FxService, median } from "../services/fx.service.js"

const originalFetch = global.fetch

/** Route a stubbed response by a URL fragment. */
function stubProviders(handlers: Record<string, () => unknown>) {
  global.fetch = vi.fn(async (input: any) => {
    const url = String(input)
    for (const [fragment, handler] of Object.entries(handlers)) {
      if (url.includes(fragment)) {
        return new Response(JSON.stringify(handler()), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
    }
    return new Response("{}", { status: 404 })
  }) as unknown as typeof fetch
}

function ngn(rate: number) {
  return () => ({ rates: { NGN: rate } })
}

afterEach(() => {
  global.fetch = originalFetch
})

describe("median", () => {
  it("returns the middle value for an odd count", () => {
    expect(median([1346.6, 1346.2, 1346.4])).toBe(1346.4)
  })

  it("averages the two middle values for an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it("handles an empty list without throwing", () => {
    expect(median([])).toBe(0)
  })
})

describe("FxService consensus", () => {
  it("uses the median of agreeing providers", async () => {
    stubProviders({
      "fxratesapi.com": ngn(1346.23),
      "open.er-api.com": ngn(1346.47),
      "jsdelivr.net": () => ({ usd: { ngn: 1346.6 } }),
      "exchangerate-api.com": ngn(1346.47),
    })

    const quote = await new FxService().getUsdToNgn()

    expect(quote.rate).toBeCloseTo(1346.47, 1)
    expect(quote.agreement).toBe(4)
    expect(quote.source).toBe("consensus")
    expect(quote.stale).toBe(false)
  })

  it("ignores a single absurd outlier", async () => {
    stubProviders({
      "fxratesapi.com": ngn(1346.23),
      "open.er-api.com": ngn(1346.47),
      "jsdelivr.net": () => ({ usd: { ngn: 1346.6 } }),
      // Misplaced decimal or a bad feed. Must not reach the user.
      "exchangerate-api.com": ngn(13.4647),
    })

    const quote = await new FxService().getUsdToNgn()

    expect(quote.rate).toBeGreaterThan(1300)
    expect(quote.rate).toBeLessThan(1400)
  })

  it("survives a provider that refuses to respond", async () => {
    stubProviders({
      "fxratesapi.com": ngn(1346.23),
      "open.er-api.com": ngn(1346.47),
      "jsdelivr.net": () => ({ usd: { ngn: 1346.6 } }),
      // exchangerate-api.com is absent → 404 → rejected
    })

    const quote = await new FxService().getUsdToNgn()

    expect(quote.agreement).toBe(3)
    expect(quote.rate).toBeCloseTo(1346.47, 1)
  })

  it("drops an out-of-band value instead of trusting it", async () => {
    stubProviders({
      "fxratesapi.com": ngn(1346.23),
      "open.er-api.com": ngn(0),
      "jsdelivr.net": () => ({ usd: { ngn: "not-a-number" } }),
      "exchangerate-api.com": ngn(999_999),
    })

    const quote = await new FxService().getUsdToNgn()

    // Only fxratesapi survives the sanity band, so it is used alone, not
    // averaged with garbage.
    expect(quote.rate).toBeCloseTo(1346.23, 1)
    expect(quote.agreement).toBe(1)
  })

  it("falls back and marks the quote stale when every provider fails", async () => {
    stubProviders({})

    const quote = await new FxService().getUsdToNgn()

    expect(quote.source).toBe("fallback")
    expect(quote.stale).toBe(true)
    expect(quote.rate).toBeGreaterThan(0)
    expect(quote.agreement).toBe(0)
  })

  it("serves the in-memory quote without a second round trip", async () => {
    const fetchSpy = vi.fn(async (input: any) => {
      const url = String(input)
      if (url.includes("coingecko")) return new Response("{}", { status: 404 })
      return new Response(JSON.stringify({ rates: { NGN: 1346.5 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })
    global.fetch = fetchSpy as unknown as typeof fetch

    const svc = new FxService()
    const first = await svc.getUsdToNgn()
    const callsAfterFirst = fetchSpy.mock.calls.length
    const second = await svc.getUsdToNgn()

    expect(second.rate).toBe(first.rate)
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst)
  })
})
