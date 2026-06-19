"use client"

import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { Loader2, X } from "@/lib/icons"
import { useState } from "react"

type Props = {
  available: number
  walletAddress: string | null
  onClose(): void
  onDone(): void
}

export function WithdrawModal({ available, walletAddress, onClose, onDone }: Props) {
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"crypto" | "fiat">("crypto")
  const [wallet, setWallet] = useState(walletAddress ?? "")
  const [submitting, setSubmitting] = useState(false)

  const numericAmount = Math.round(parseFloat(amount) * 100) / 100
  const valid = numericAmount >= 10 && numericAmount <= available

  async function handleSubmit() {
    if (!valid) return
    setSubmitting(true)
    try {
      await api.post("/earnings/withdraw", { amountUsd: numericAmount, method: method.toUpperCase(), destinationWallet: method === "crypto" ? wallet : undefined })
      toast.success("Withdrawal request submitted")
      onDone()
    } catch {
      toast.error("Withdrawal failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-card border-surface-border mx-4 w-full max-w-md rounded-xl border p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Withdraw Earnings</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-muted mb-4 text-sm">
          Available: <span className="font-semibold text-foreground">${available.toFixed(2)}</span>
          <br />
          Minimum withdrawal: $10.00
        </div>

        <label className="text-muted mb-1 block text-xs font-medium uppercase tracking-wider">Amount (USD)</label>
        <input
          type="number"
          min={10}
          max={available}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10.00"
          className="border-surface-border bg-void text-foreground placeholder:text-muted w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label className="text-muted mt-4 mb-1 block text-xs font-medium uppercase tracking-wider">Method</label>
        <div className="flex gap-2">
          {(["crypto", "fiat"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                method === m
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-surface-border text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              {m === "crypto" ? "Crypto (ETH)" : "Bank Transfer"}
            </button>
          ))}
        </div>

        {method === "crypto" && (
          <>
            <label className="text-muted mt-4 mb-1 block text-xs font-medium uppercase tracking-wider">
              Wallet Address
            </label>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
              className="border-surface-border bg-void text-foreground placeholder:text-muted w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-accent font-mono"
            />
          </>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-muted hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="bg-accent text-void flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `Withdraw $${numericAmount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
