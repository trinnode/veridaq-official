"use client"

import { DashboardLayout } from "@/components/institution/layout"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { WithdrawModal } from "@/components/institution/withdraw-modal"
import { ChevronDown, ChevronUp, Wallet, CheckCircle2 } from "@/lib/icons"
import { toast } from "@/components/ui/toast"

type EarningsSummary = {
  totalEarnedUsd: number
  availableUsd: number
  withdrawnUsd: number
  payoutWallet: string | null
}

type TransactionItem = {
  id: string
  amountUsd: number
  amountWei: number
  type: string
  description: string
  createdAt: string
  platformShareUsd?: number | null
  institutionShareUsd?: number | null
  poolShareUsd?: number | null
  referenceId?: string | null
  metadata?: Record<string, unknown> | null
}

type TxResponse = {
  total: number
  page: number
  limit: number
  items: TransactionItem[]
}

function safeUsd(value: string | number | undefined | null): string {
  if (value == null) return "0.00"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "0.00"
  return num.toFixed(2)
}

export default function InstitutionEarningsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [txnResponse, setTxnResponse] = useState<TxResponse | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [walletInput, setWalletInput] = useState("")
  const [savingWallet, setSavingWallet] = useState(false)
  const [walletSaved, setWalletSaved] = useState(false)

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
      .catch(() => {})
    api.get("/earnings/transactions")
      .then(({ data }) => setTxnResponse(data as TxResponse))
      .catch((err) => {
        const msg = err?.response?.data?.error ?? "Failed to load earnings data"
        setApiError(msg)
      })
  }, [user])

  async function handleSaveWallet() {
    if (!walletInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Invalid wallet address")
      return
    }
    setSavingWallet(true)
    try {
      await api.put("/earnings/wallet", { walletAddress: walletInput })
      setSummary((prev) => prev ? { ...prev, payoutWallet: walletInput } : prev)
      setWalletSaved(true)
      toast.success("Payout wallet saved")
      setTimeout(() => setWalletSaved(false), 2000)
    } catch {
      toast.error("Failed to save wallet")
    } finally {
      setSavingWallet(false)
    }
  }

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
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Total Earned</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            ${safeUsd(summary?.totalEarnedUsd)}
          </div>
        </div>
        <div className="bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Available</div>
          <div className="mt-1 text-2xl font-bold text-accent">
            ${safeUsd(summary?.availableUsd)}
          </div>
        </div>
        <div className="bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Withdrawn</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            ${safeUsd(summary?.withdrawnUsd)}
          </div>
        </div>
      </div>

      {/* Withdraw + Wallet Section */}
      <div className="mt-6 rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Withdraw Funds</h3>
        {summary?.payoutWallet ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWithdraw(true)}
              disabled={!summary?.availableUsd || summary.availableUsd < 10}
              className="bg-accent text-void hover:bg-accent/90 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Withdraw
            </button>
            <span className="text-muted flex items-center gap-1.5 text-xs">
              <Wallet className="h-3 w-3" />
              {summary.payoutWallet.slice(0, 6)}...{summary.payoutWallet.slice(-4)}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted text-xs">
              Set a payout wallet address to enable withdrawals (minimum $10).
            </p>
            <div className="flex max-w-md gap-2">
              <input
                className="input flex-1 font-mono text-xs"
                placeholder="0x..."
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
              />
              <button
                onClick={handleSaveWallet}
                disabled={savingWallet || !walletInput}
                className="bg-accent text-void hover:bg-accent/90 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
              >
                {savingWallet ? "Saving..." : walletSaved ? (
                  <><CheckCircle2 className="h-4 w-4" /> Saved</>
                ) : (
                  "Save Wallet"
                )}
              </button>
            </div>
            <p className="text-xs text-muted">
              Withdrawals to EVM wallets (Base Sepolia / Base Mainnet).
            </p>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Minimum withdrawal: $10 &middot; Available: ${safeUsd(summary?.availableUsd)}
        </p>
      </div>

      {/* Transaction History */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
          Transaction History
          {txnResponse && <span className="text-muted ml-2 font-normal">({txnResponse.total})</span>}
        </h2>
        {!txnResponse || txnResponse.items.length === 0 ? (
          <p className="text-muted py-10 text-center text-sm">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {txnResponse.items.map((tx) => {
              const isOpen = expandedTx === tx.id
              return (
                <div key={tx.id} className="bg-surface-card border-surface-border rounded-lg border overflow-hidden">
                  <button
                    onClick={() => setExpandedTx(isOpen ? null : tx.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-void/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {tx.description || `${tx.type} Transaction`}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          tx.type === "EARNED" ? "bg-accent/10 text-accent" :
                          tx.type === "WITHDRAWN" ? "bg-warning/10 text-warning" :
                          "bg-info/10 text-info"
                        }`}>
                          {tx.type}
                        </span>
                      </div>
                      <div className="text-muted mt-0.5 text-xs">
                        {new Date(tx.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">
                          ${safeUsd(tx.amountUsd)}
                        </div>
                        {tx.type === "EARNED" && tx.institutionShareUsd != null && (
                          <div className="text-accent text-[10px]">
                            +${safeUsd(tx.institutionShareUsd)} your share
                          </div>
                        )}
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-surface-border animate-fade-in border-t px-4 py-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div className="text-muted">Reference</div>
                        <div className="font-mono text-foreground">{tx.referenceId ?? "—"}</div>

                        <div className="text-muted">Total Amount</div>
                        <div className="text-foreground">${safeUsd(tx.amountUsd)}</div>

                        {tx.type === "EARNED" && (
                          <>
                            <div className="text-muted">Platform Share (70%)</div>
                            <div className="text-foreground">${safeUsd(tx.platformShareUsd)}</div>
                            <div className="text-muted">Your Share (20%)</div>
                            <div className="text-accent font-medium">+${safeUsd(tx.institutionShareUsd)}</div>
                            <div className="text-muted">Gas Pool Share (10%)</div>
                            <div className="text-foreground">${safeUsd(tx.poolShareUsd)}</div>
                          </>
                        )}

                        {tx.type === "WITHDRAWN" && tx.metadata && (
                          <>
                            <div className="text-muted">Method</div>
                            <div className="text-foreground">{(tx.metadata as Record<string, unknown>)?.method as string ?? "—"}</div>
                            <div className="text-muted">Status</div>
                            <div className="text-foreground">{(tx.metadata as Record<string, unknown>)?.status as string ?? "—"}</div>
                          </>
                        )}

                        <div className="text-muted">Wei Value</div>
                        <div className="font-mono text-foreground">{tx.amountWei?.toString() ?? "0"}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
            api.get("/earnings/transactions")
              .then(({ data }) => setTxnResponse(data as TxResponse))
              .catch(() => {})
          }}
        />
      )}
    </DashboardLayout>
  )
}
