"use client"

import { DashboardLayout } from "@/components/institution/layout"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { WithdrawModal } from "@/components/institution/withdraw-modal"

type EarningsSummary = {
  totalEarnedUsd: number
  availableUsd: number
  withdrawnUsd: number
  payoutWallet: string | null
}

type TransactionItem = {
  id: string
  amountUsd: number
  type: string
  description: string
  createdAt: string
  metadata?: Record<string, unknown>
}

type TxResponse = {
  total: number
  page: number
  limit: number
  items: TransactionItem[]
}

function safeUsd(value: number | undefined | null): string {
  if (value == null || typeof value !== "number" || isNaN(value)) return "0.00"
  return value.toFixed(2)
}

export default function InstitutionEarningsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [txnResponse, setTxnResponse] = useState<TxResponse | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)

  useEffect(() => {
    if (!loading && user && !user.alsoEmployer) {
      router.push("/institution/dashboard")
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!user?.alsoEmployer) return
    setApiError(null)
    api.get("/earnings")
      .then(({ data }) => setSummary(data as EarningsSummary))
      .catch(() => { /* handled below */ })
    api.get("/earnings/transactions")
      .then(({ data }) => setTxnResponse(data as TxResponse))
      .catch((err) => {
        const msg = err?.response?.data?.error ?? "Failed to load earnings data"
        setApiError(msg)
      })
  }, [user])

  if (loading || !user) return null
  if (!user.alsoEmployer) return null

  if (apiError) {
    return (
      <DashboardLayout title="Earnings">
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted text-sm">{apiError}</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Earnings">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="card bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Total Earned</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            ${safeUsd(summary?.totalEarnedUsd)}
          </div>
        </div>
        <div className="card bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Available</div>
          <div className="mt-1 text-2xl font-bold text-accent">
            ${safeUsd(summary?.availableUsd)}
          </div>
        </div>
        <div className="card bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Withdrawn</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            ${safeUsd(summary?.withdrawnUsd)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => setShowWithdraw(true)}
          disabled={!summary?.availableUsd || summary.availableUsd < 10}
          className="bg-accent text-void hover:bg-accent/90 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Withdraw
        </button>
        {summary?.payoutWallet ? (
          <span className="text-muted text-xs">
            Wallet: {summary.payoutWallet.slice(0, 6)}...{summary.payoutWallet.slice(-4)}
          </span>
        ) : (
          <span className="text-muted text-xs">No payout wallet set</span>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Transaction History</h2>
        {!txnResponse || txnResponse.items.length === 0 ? (
          <p className="text-muted text-sm">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {txnResponse.items.map((tx) => (
              <div
                key={tx.id}
                className="bg-surface-card border-surface-border flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{tx.description}</div>
                  <div className="text-muted text-xs">{new Date(tx.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">${safeUsd(tx.amountUsd)}</div>
                  <div className="text-xs text-accent">{tx.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showWithdraw && summary && (
        <WithdrawModal
          available={summary.availableUsd}
          walletAddress={summary.payoutWallet}
          onClose={() => setShowWithdraw(false)}
          onDone={() => {
            setShowWithdraw(false)
            api.get("/earnings")
              .then(({ data }) => setSummary(data))
              .catch(() => {})
          }}
        />
      )}
    </DashboardLayout>
  )
}
