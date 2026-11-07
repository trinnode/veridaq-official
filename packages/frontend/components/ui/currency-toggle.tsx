"use client"
/**
 * Compact NGN/USD display switch for portal headers.
 *
 * Two segments rather than a dropdown: the choice is binary and used often
 * enough that one click should be enough.
 */

import { useCurrency } from "@/lib/currency"

export function CurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency, rate, stale } = useCurrency()

  return (
    <div
      className={`border-surface-border bg-surface flex items-center rounded-full border p-0.5 ${className}`}
      role="group"
      aria-label="Display currency"
      title={`1 USD ≈ ₦${rate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}${
        stale ? " (rate is stale)" : ""
      }`}
    >
      {(["NGN", "USD"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setCurrency(code)}
          aria-pressed={currency === code}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
            currency === code
              ? "bg-accent text-void"
              : "text-muted hover:text-foreground"
          }`}
        >
          {code === "NGN" ? "₦ NGN" : "$ USD"}
        </button>
      ))}
    </div>
  )
}
