"use client"
import { DashboardLayout } from "@/components/institution/layout"
import { GuardKyc } from "@/components/ui/guard-kyc"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { toast } from "@/components/ui/toast"
import { UpgradeModal } from "@/components/institution/upgrade-modal"
import { ArrowUpCircle, CreditCard, Shield, Sparkles, Wallet, Layers, FileText, ArrowDown } from "@/lib/icons"
import { useEffect, useState } from "react"

type BillingData = {
  tier: "FREE" | "PAID"
  kycApproved: boolean
  alsoEmployer: boolean
  employerCredits?: number
  employerFreeRemaining?: number
  totalCredentials: number
  totalBatches: number
}

type PaymentHistoryItem = {
  id: string
  referenceId: string
  type: string
  method?: string
  status: string
  amountFiat?: string
  fiatCurrency?: string
  amountWei?: string
  description?: string
  createdAt: string
  completedAt?: string
}

export default function InstitutionBilling() {
  const { user } = useAuth()
  const [data, setData] = useState<BillingData | null>(null)
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  function load() {
    if (!user) return
    api.get("/institution/billing")
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load billing data"))
      .finally(() => setLoading(false))
  }

  async function loadPaymentHistory() {
    setHistoryLoading(true)
    try {
      await api.get("/institution/payments")
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => { 
    load()
    loadPaymentHistory()
  }, [user])

  const batchPricing = [
    { range: "1,001 – 5,000", price: 20, txs: "6–25" },
    { range: "5,001 – 10,000", price: 30, txs: "26–50" },
    { range: "10,001 – 25,000", price: 90, txs: "51–125" },
    { range: "25,001 – 50,000", price: 170, txs: "126–250" },
  ]

  const creditPacks = [
    { label: "5 (Trial)", credits: 5, usd: 7 },
    { label: "10", credits: 10, usd: 15 },
    { label: "25", credits: 25, usd: 35 },
    { label: "50", credits: 50, usd: 65 },
    { label: "100", credits: 100, usd: 120 },
    { label: "500", credits: 500, usd: 550 },
  ]

  return (
    <DashboardLayout title="Billing & Subscription">
      {loading ? (
        <div className="text-muted flex h-64 items-center justify-center text-sm">Loading…</div>
      ) : (
        <GuardKyc>
          <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} onSuccess={load} />

          <div className="animate-fade-in space-y-6">
            {/* Tier Status */}
            <div className="relative overflow-hidden rounded-xl border border-surface-border bg-gradient-to-br from-surface-card to-void p-6">
              <div className="bg-accent/5 pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                    <Shield className="h-7 w-7 text-accent" />
                  </div>
                  <div>
                    <p className="text-muted text-sm">Current Tier</p>
                    <p className="text-2xl font-bold text-foreground">{data?.tier ?? "FREE"}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    data?.tier === "PAID"
                      ? "bg-accent/10 text-accent"
                      : "bg-amber-500/10 text-amber-500"
                  }`}
                >
                  {data?.tier === "PAID" ? "Active" : "Free Tier"}
                </span>
              </div>

              {data?.tier === "FREE" ? (
                <div className="mt-6 border-t border-surface-border pt-4">
                  <p className="text-muted mb-3 text-sm">
                    Upgrade to PAID tier to upload larger batches and access employer verification features.
                    Pay with crypto or fiat via Crossmint.
                  </p>
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="bg-accent text-void hover:bg-accent/90 inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-medium transition-colors"
                  >
                    <CreditCard size={16} /> Upgrade to PAID — $75/year
                  </button>
                </div>
              ) : (
                <div className="mt-6 border-t border-surface-border pt-4">
                  <p className="text-muted mb-3 text-sm">
                    Your institution is on the PAID tier. Batch uploads are billed per submission range.
                  </p>
                </div>
              )}
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative overflow-hidden rounded-xl border border-surface-border bg-surface-card p-5">
                <div className="flex items-start justify-between">
                  <p className="text-muted text-sm">Total Credentials</p>
                  <Layers className="h-4 w-4 text-accent" />
                </div>
                <p className="mt-2 text-3xl font-bold text-foreground">{data?.totalCredentials ?? 0}</p>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-card p-5">
                <div className="flex items-start justify-between">
                  <p className="text-muted text-sm">Total Batches</p>
                  <FileText className="h-4 w-4 text-accent" />
                </div>
                <p className="mt-2 text-3xl font-bold text-foreground">{data?.totalBatches ?? 0}</p>
              </div>
              {data?.alsoEmployer && (
                <>
                  <div className="rounded-xl border border-surface-border bg-surface-card p-5">
                    <div className="flex items-start justify-between">
                      <p className="text-muted text-sm">Employer Credits</p>
                      <Wallet className="h-4 w-4 text-accent" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-foreground">{data?.employerCredits ?? 0}</p>
                    <p className="text-muted mt-1 text-xs">
                      {data?.employerFreeRemaining ?? 0} free trials remaining
                    </p>
                  </div>
                  <div className="rounded-xl border border-surface-border bg-surface-card p-5">
                    <div className="flex items-start justify-between">
                      <p className="text-muted text-sm">Total Earnings</p>
                      <ArrowDown className="h-4 w-4 text-accent" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-accent">$0.00</p>
                    <p className="text-muted mt-1 text-xs">View details in Earnings page</p>
                  </div>
                </>
              )}
            </div>

            {/* Batch Upload Pricing (PAID tier) */}
            {data?.tier === "PAID" && (
              <div className="rounded-xl border border-surface-border bg-surface-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-accent" />
                  Batch Upload Pricing
                </h2>
                <p className="text-muted mb-4 text-sm">
                  Pay per batch submission. FREE tier: platform sponsors gas for batches up to 999 students.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-surface-border border-b text-left text-xs font-medium uppercase tracking-wider text-muted">
                        <th className="pb-2 pr-4">Batch Range</th>
                        <th className="pb-2 pr-4">On-Chain Txs</th>
                        <th className="pb-2 pr-4">Price (USD)</th>
                        <th className="pb-2 pr-4">Price (₦)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchPricing.map((p) => (
                        <tr key={p.range} className="border-surface-border border-b">
                          <td className="py-3 pr-4 font-mono text-foreground">{p.range}</td>
                          <td className="py-3 pr-4 text-muted">{p.txs}</td>
                          <td className="py-3 pr-4 font-semibold text-foreground">${p.price}</td>
                          <td className="py-3 pr-4 text-muted">₦{Math.round(p.price * 1361).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Employer Credit Packs (if alsoEmployer) */}
            {data?.alsoEmployer && (
              <div className="rounded-xl border border-surface-border bg-surface-card p-5">
                <h2 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Verification Credit Packs
                </h2>
                <p className="text-muted mb-4 text-sm">
                  Purchase credits to verify credentials from other institutions. 3 free verifications included.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {creditPacks.map((pack) => (
                    <div key={pack.credits} className="border-surface-border bg-void/50 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{pack.label}</p>
                          <p className="text-muted text-xs">${pack.usd} USD</p>
                        </div>
                        <p className="text-accent text-sm font-semibold">${(pack.usd / pack.credits).toFixed(2)}/credit</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment History */}
            <div className="rounded-xl border border-surface-border bg-surface-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
                <button
                  onClick={loadPaymentHistory}
                  disabled={historyLoading}
                  className="text-accent text-xs font-medium hover:underline"
                >
                  Refresh
                </button>
              </div>
              {historyLoading ? (
                <div className="text-muted py-8 text-center text-sm">Loading…</div>
              ) : paymentHistory.length === 0 ? (
                <p className="text-muted text-sm text-center py-8">No payment history yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-surface-border border-b text-left text-xs font-medium uppercase tracking-wider text-muted">
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Amount</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2 pr-4">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((p) => (
                        <tr key={p.id} className="border-surface-border border-b">
                          <td className="py-3 pr-4 text-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 pr-4 text-foreground">{p.type}</td>
                          <td className="py-3 pr-4 font-semibold text-foreground">
                            {p.amountFiat ? `$${p.amountFiat} ${p.fiatCurrency}` : `${p.amountWei} wei`}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              p.status === "COMPLETED" ? "border-accent/20 bg-accent/10 text-accent" :
                              p.status === "PENDING" ? "border-amber-500/20 bg-amber-500/10 text-amber-500" :
                              "border-red-500/20 bg-red-500/10 text-red-400"
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted">{p.referenceId.slice(0, 12)}...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </GuardKyc>
      )}
    </DashboardLayout>
  )
}
