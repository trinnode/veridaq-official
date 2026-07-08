"use client"

import { AdminLayout } from "@/components/admin/layout"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { useEffect, useState, useCallback } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts"
import {
  DollarSign, TrendingUp, FileJson, FileText, Database,
  CheckCircle2, Activity, X, ChevronRight, ArrowLeft,
} from "@/lib/icons"

type Tab = "revenue" | "transactions" | "registrations"

type RevenueData = {
  daily: Array<{ date: string; revenue: number; platform: number; institution: number; pool: number; count: number }>
  totals: { revenue: number; platform: number; institution: number; pool: number; count: number }
}

type RegData = {
  daily: Array<{ date: string; institutions: number; employers: number; credentials: number; verifications: number; verified: number }>
}

type TxItem = {
  id: string; type: string; amountUsd: number; platformShareUsd: number | null
  institutionShareUsd: number | null; poolShareUsd: number | null
  description: string; referenceId: string | null; institutionName: string | null
  createdAt: string
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n)
}

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<Tab>("revenue")
  const [days, setDays] = useState(30)
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [registrations, setRegistrations] = useState<RegData | null>(null)
  const [txs, setTxs] = useState<TxItem[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txPage, setTxPage] = useState(1)
  const [txLimit] = useState(20)
  const [txTypeFilter, setTxTypeFilter] = useState("")
  const [txDateFrom, setTxDateFrom] = useState("")
  const [txDateTo, setTxDateTo] = useState("")
  const [txLoading, setTxLoading] = useState(false)
  const [exporting, setExporting] = useState<"json" | "xlsx" | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchRevenue = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/analytics/revenue?days=${days}`)
      setRevenue(data)
    } catch { /* ignore */ }
  }, [days])

  const fetchRegistrations = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/analytics/registrations?days=${days}`)
      setRegistrations(data)
    } catch { /* ignore */ }
  }, [days])

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const params = new URLSearchParams({ page: String(txPage), limit: String(txLimit) })
      if (txTypeFilter) params.set("type", txTypeFilter)
      if (txDateFrom) params.set("dateFrom", txDateFrom)
      if (txDateTo) params.set("dateTo", txDateTo)
      const { data } = await api.get(`/admin/analytics/transactions?${params}`)
      setTxs(data.items ?? [])
      setTxTotal(data.total ?? 0)
    } catch { /* ignore */ }
    finally { setTxLoading(false) }
  }, [txPage, txLimit, txTypeFilter, txDateFrom, txDateTo])

  useEffect(() => { setLoading(true); Promise.all([fetchRevenue(), fetchRegistrations()]).finally(() => setLoading(false)) }, [fetchRevenue, fetchRegistrations])
  useEffect(() => { if (tab === "transactions") fetchTransactions() }, [tab, fetchTransactions])

  const handleExport = async (format: "json" | "xlsx") => {
    setExporting(format)
    try {
      const { data } = await api.get(`/admin/analytics/export?format=${format}&days=${days}`, {
        responseType: format === "xlsx" ? "blob" : "json",
      })
      if (format === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a"); a.href = url; a.download = `veridaq-analytics-${new Date().toISOString().slice(0, 10)}.json`
        a.click(); URL.revokeObjectURL(url)
      } else {
        const url = URL.createObjectURL(data as Blob)
        const a = document.createElement("a"); a.href = url; a.download = `veridaq-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`
        a.click(); URL.revokeObjectURL(url)
      }
      toast.success(`${format.toUpperCase()} exported`)
    } catch { toast.error("Export failed") }
    finally { setExporting(null) }
  }

  const totalPages = Math.ceil(txTotal / txLimit)

  return (
    <AdminLayout title="Analytics">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-surface-border">
        {([["revenue", "Revenue"], ["transactions", "Transactions"], ["registrations", "Registrations"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              tab === key ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >{label}</button>
        ))}
        <div className="flex-1" />
        {/* Export + Days filter */}
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="bg-void border border-surface-border rounded px-2 py-1.5 text-xs text-foreground"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button onClick={() => handleExport("json")} disabled={exporting !== null}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-surface-border rounded text-muted hover:text-foreground transition-colors disabled:opacity-50"
          ><FileJson className="w-3.5 h-3.5" /> JSON</button>
          <button onClick={() => handleExport("xlsx")} disabled={exporting !== null}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-surface-border rounded text-muted hover:text-foreground transition-colors disabled:opacity-50"
          ><FileText className="w-3.5 h-3.5" /> Excel</button>
        </div>
      </div>

      {loading && tab !== "transactions" ? (
        <div className="text-muted py-12 text-center text-sm">Loading analytics...</div>
      ) : (
        <>

          {/* ── Revenue Tab ── */}
          {tab === "revenue" && revenue && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatBox label="Total Revenue" value={fmt(revenue.totals.revenue)} icon={<DollarSign className="w-4 h-4" />} accent />
                <StatBox label="Platform (70%)" value={fmt(revenue.totals.platform)} icon={<TrendingUp className="w-4 h-4" />} />
                <StatBox label="Institutions (20%)" value={fmt(revenue.totals.institution)} icon={<Database className="w-4 h-4" />} />
                <StatBox label="Gas Pool (10%)" value={fmt(revenue.totals.pool)} icon={<Activity className="w-4 h-4" />} />
                <StatBox label="Verifications" value={String(revenue.totals.count)} icon={<CheckCircle2 className="w-4 h-4" />} />
              </div>

              <div className="border border-surface-border rounded bg-surface-card p-4">
                <h3 className="text-xs font-medium text-foreground mb-3">Daily Revenue Breakdown</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenue.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="platform" name="Platform (70%)" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="institution" name="Institution (20%)" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="pool" name="Gas Pool (10%)" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-surface-border rounded bg-surface-card overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-void/50 text-muted uppercase border-b border-surface-border">
                    <tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Revenue</th><th className="px-3 py-2 font-medium">Platform</th><th className="px-3 py-2 font-medium">Institution</th><th className="px-3 py-2 font-medium">Pool</th><th className="px-3 py-2 font-medium">Count</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {revenue.daily.slice().reverse().map((r) => (
                      <tr key={r.date} className="hover:bg-void/30">
                        <td className="px-3 py-2 text-muted">{r.date}</td>
                        <td className="px-3 py-2">{fmt(r.revenue)}</td>
                        <td className="px-3 py-2">{fmt(r.platform)}</td>
                        <td className="px-3 py-2">{fmt(r.institution)}</td>
                        <td className="px-3 py-2">{fmt(r.pool)}</td>
                        <td className="px-3 py-2">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Registrations Tab ── */}
          {tab === "registrations" && registrations && (
            <div className="space-y-6">
              <div className="border border-surface-border rounded bg-surface-card p-4">
                <h3 className="text-xs font-medium text-foreground mb-3">Daily Registration Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={registrations.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="institutions" name="Institutions" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="employers" name="Employers" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="credentials" name="Credentials" stroke="#a855f7" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="verifications" name="Verifications" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="verified" name="Verified" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-surface-border rounded bg-surface-card overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-void/50 text-muted uppercase border-b border-surface-border">
                    <tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Institutions</th><th className="px-3 py-2 font-medium">Employers</th><th className="px-3 py-2 font-medium">Credentials</th><th className="px-3 py-2 font-medium">Verifications</th><th className="px-3 py-2 font-medium">Verified</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {registrations.daily.slice().reverse().map((r) => (
                      <tr key={r.date} className="hover:bg-void/30">
                        <td className="px-3 py-2 text-muted">{r.date}</td>
                        <td className="px-3 py-2">{r.institutions}</td>
                        <td className="px-3 py-2">{r.employers}</td>
                        <td className="px-3 py-2">{r.credentials}</td>
                        <td className="px-3 py-2">{r.verifications}</td>
                        <td className="px-3 py-2">{r.verified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Transactions Tab ── */}
          {tab === "transactions" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select value={txTypeFilter} onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1) }}
                  className="bg-void border border-surface-border rounded px-2 py-1.5 text-xs text-foreground"
                >
                  <option value="">All Types</option>
                  <option value="EARNED">Earned</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                  <option value="DEPOSITED">Deposited</option>
                  <option value="SPONSORED">Sponsored</option>
                </select>
                <input type="date" value={txDateFrom} onChange={(e) => { setTxDateFrom(e.target.value); setTxPage(1) }}
                  className="bg-void border border-surface-border rounded px-2 py-1.5 text-xs text-foreground" placeholder="From"
                />
                <input type="date" value={txDateTo} onChange={(e) => { setTxDateTo(e.target.value); setTxPage(1) }}
                  className="bg-void border border-surface-border rounded px-2 py-1.5 text-xs text-foreground" placeholder="To"
                />
                {(txTypeFilter || txDateFrom || txDateTo) && (
                  <button onClick={() => { setTxTypeFilter(""); setTxDateFrom(""); setTxDateTo(""); setTxPage(1) }}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted hover:text-foreground"
                  ><X className="w-3 h-3" /> Clear</button>
                )}
              </div>

              {/* Table */}
              <div className="border border-surface-border rounded bg-surface-card overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-void/50 text-muted uppercase border-b border-surface-border">
                    <tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Institution</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Platform</th><th className="px-3 py-2 font-medium">Institution Share</th><th className="px-3 py-2 font-medium">Pool</th><th className="px-3 py-2 font-medium">Ref</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {txLoading ? (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">Loading...</td></tr>
                    ) : txs.length === 0 ? (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-muted">No transactions</td></tr>
                    ) : txs.map((tx) => (
                      <tr key={tx.id} className="hover:bg-void/30">
                        <td className="px-3 py-2 text-muted whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          tx.type === "EARNED" ? "bg-accent/10 text-accent" : tx.type === "WITHDRAWN" ? "bg-error/10 text-error" : "bg-info/10 text-info"
                        }`}>{tx.type}</span></td>
                        <td className="px-3 py-2">{tx.institutionName ?? "—"}</td>
                        <td className="px-3 py-2">{fmt(tx.amountUsd)}</td>
                        <td className="px-3 py-2">{tx.platformShareUsd != null ? fmt(tx.platformShareUsd) : "—"}</td>
                        <td className="px-3 py-2">{tx.institutionShareUsd != null ? fmt(tx.institutionShareUsd) : "—"}</td>
                        <td className="px-3 py-2">{tx.poolShareUsd != null ? fmt(tx.poolShareUsd) : "—"}</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-muted max-w-[100px] truncate">{tx.referenceId?.slice(0, 12) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{txTotal} total transactions</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setTxPage(Math.max(1, txPage - 1))} disabled={txPage <= 1}
                      className="flex items-center gap-1 px-2 py-1 border border-surface-border rounded hover:text-foreground disabled:opacity-40"
                    ><ArrowLeft className="w-3 h-3" /> Prev</button>
                    <span>Page {txPage} of {totalPages}</span>
                    <button onClick={() => setTxPage(Math.min(totalPages, txPage + 1))} disabled={txPage >= totalPages}
                      className="flex items-center gap-1 px-2 py-1 border border-surface-border rounded hover:text-foreground disabled:opacity-40"
                    >Next <ChevronRight className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}

function StatBox({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`border rounded p-3 bg-surface-card ${accent ? "border-accent/30" : "border-surface-border"}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${accent ? "text-accent" : "text-muted"}`}>
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className={`font-mono text-lg ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  )
}
