"use client"
/**
 * Compact NGN/USD display switch for portal headers.
 *
 * Two segments rather than a dropdown: the choice is binary and used often
 * enough that one click should be enough.
 */

import { useCurrency } from "@/lib/currency"

export function CurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency, rate, stale, rateUpdatedAt } = useCurrency()

  const updatedLabel = rateUpdatedAt
    ? new Date(rateUpdatedAt).toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  const title = [
    `1 USD ≈ ₦${rate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`,
    stale ? "rate is stale" : updatedLabel ? `updated ${updatedLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      className={`border-surface-border bg-surface flex shrink-0 items-center whitespace-nowrap rounded-full border p-0.5 ${className}`}
      role="group"
      aria-label="Display currency"
      title={title}
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
      {stale && (
        <span
          className="bg-warning ml-1 mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          aria-label="Exchange rate is stale"
          title={`Exchange rate is stale. Last known: ${updatedLabel ?? "unknown"}`}
        />
      )}
    </div>
  )
}
