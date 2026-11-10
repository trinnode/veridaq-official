import { describe, expect, it } from "vitest"
import { getEthUsdQuote, resetEthUsdCache } from "../services/eth-price.service.js"
import { programmeMatchesRecord } from "../utils/course.js"
import { hashToField } from "../utils/field.js"

describe("ETH/USD payout pricing", () => {
  it("uses the live quote when the provider answers", async () => {
    resetEthUsdCache()
    const original = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ethereum: { usd: 2517.42 } }), { status: 200 })) as typeof fetch

    try {
      const quote = await getEthUsdQuote()
      expect(quote.usd).toBe(2517.42)
      expect(quote.source).toBe("coingecko")
      expect(quote.stale).toBe(false)
    } finally {
      globalThis.fetch = original
      resetEthUsdCache()
    }
  })

  it("falls back rather than throwing when the provider is unreachable", async () => {
    resetEthUsdCache()
    const original = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new Error("network down")
    }) as typeof fetch

    try {
      const quote = await getEthUsdQuote()
      expect(quote.stale).toBe(true)
      expect(quote.source).toBe("config-fallback")
      expect(quote.usd).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = original
      resetEthUsdCache()
    }
  })
})

describe("programme binding", () => {
  const recorded = hashToField("computer science").toString()

  it("accepts the programme exactly as recorded", () => {
    expect(programmeMatchesRecord("Computer Science", recorded)).toBe(true)
  })

  it("ignores case and surrounding whitespace", () => {
    expect(programmeMatchesRecord("  COMPUTER SCIENCE  ", recorded)).toBe(true)
  })

  it("tolerates collapsed internal whitespace", () => {
    expect(programmeMatchesRecord("Computer   Science", recorded)).toBe(true)
  })

  it("rejects a different programme", () => {
    expect(programmeMatchesRecord("Medicine", recorded)).toBe(false)
  })

  it("rejects a credential with no recorded programme", () => {
    expect(programmeMatchesRecord("Computer Science", "0")).toBe(false)
  })
})
