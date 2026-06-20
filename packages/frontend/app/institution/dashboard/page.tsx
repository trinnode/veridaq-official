"use client"
import { DashboardLayout } from "@/components/institution/layout"
import { GuardKyc } from "@/components/ui/guard-kyc"
import { StatCard } from "@/components/ui/stat-card"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { ArrowRight, FileCheck2, ShieldCheck, Upload } from "@/lib/icons"
import { EarningsSummary } from "@/components/institution/earnings-summary"
import { toast } from "@/components/ui/toast"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function InstitutionDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)

  async function loadDashboard() {
    try {
      const res = await api.get("/institution/dashboard")
      setStats(res.data)
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Failed to load dashboard"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadDashboard()
  }, [user])

  // Poll every 15s while dashboard has active items
  useEffect(() => {
    if (!stats) return
    const hasActive = (stats.pendingManual ?? 0) > 0 || (stats.requestsThisMonth ?? 0) > 0
    if (hasActive && !polling) {
      setPolling(true)
      const interval = setInterval(() => loadDashboard(), 15000)
      return () => { clearInterval(interval); setPolling(false) }
    } else if (!hasActive && polling) {
      setPolling(false)
    }
  }, [stats, polling])

  return (
    <DashboardLayout title="Dashboard">
      {loading ? (
        <div className="text-muted flex h-64 items-center justify-center text-sm">Loading…</div>
      ) : (
        <GuardKyc>
          <div className="animate-fade-in space-y-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-semibold text-foreground">
                Welcome back, {stats?.name || "Institution"}!
              </h1>

              <div className="flex gap-2">
                <Link
                  href="/institution/batches"
                  className="bg-surface-border hover:bg-surface-border/80 flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-foreground transition-colors"
                >
                  <Upload size={16} /> Upload Batch
                </Link>
                <Link
                  href="/institution/claims"
                  className="bg-accent text-void hover:bg-accent/90 flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors"
                >
                  <ShieldCheck size={16} /> Claim Specs
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Credentials" value={stats?.totalCredentials ?? 0} />
              <StatCard label="Requests (This Month)" value={stats?.requestsThisMonth ?? 0} />

              <div className="card bg-surface-card border-surface-border flex flex-col justify-between rounded-xl border p-4">
                <p className="text-muted text-sm">Pending Manual Reviews</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-2xl font-semibold text-foreground">{stats?.pendingManual ?? 0}</p>
                  {stats?.pendingManual > 0 && (
                    <Link
                      href="/institution/verifications?status=AWAITING_INSTITUTION"
                      className="rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-500 hover:underline"
                    >
                      Review Now
                    </Link>
                  )}
                </div>
              </div>

              {user?.alsoEmployer && (
                <div className="bg-surface-card border-surface-border flex flex-col justify-between rounded-xl border p-4">
                  <p className="text-muted text-sm">Earnings</p>
                  <EarningsSummary />
                </div>
              )}

              <div className="bg-surface-card border-surface-border flex flex-col justify-between rounded-xl border p-4">
                <p className="text-muted text-sm">Current Tier</p>
                <p className="text-2xl font-semibold text-foreground">{stats?.tier ?? "FREE"}</p>
                <p className="text-muted mt-1 text-xs">
                  {stats?.tier === "PAID" ? "PAID tier — batch upload fees apply" : "FREE tier — gas sponsored for ≤999 students"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card ">
                <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
                  <FileCheck2 size={18} className="text-accent" /> Subscription & Last Batch
                </h3>
                <div className="space-y-4">
                  <div className="border-surface-border/50 flex items-center justify-between border-b py-2">
                    <span className="text-muted text-sm">Current Tier</span>
                    <span className="text-sm font-medium text-foreground">{stats?.tier ?? "FREE"}</span>
                  </div>
                  <div className="border-surface-border/50 flex items-center justify-between border-b py-2">
                    <span className="text-muted text-sm">Account Created</span>
                    <span className="text-sm font-medium text-foreground">
                      {stats?.createdAt ? new Date(stats.createdAt).toLocaleDateString() : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted text-sm">Last Upload Status</span>
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {stats?.lastBatch ? (
                        <>
                          <span
                            className={`h-2 w-2 rounded-full ${stats.lastBatch.status === "CONFIRMED" ? "bg-green-500" : stats.lastBatch.status === "FAILED" ? "bg-red-500" : "bg-yellow-500"}`}
                          ></span>
                          {stats.lastBatch.status} (
                          {new Date(stats.lastBatch.createdAt).toLocaleDateString()})
                        </>
                      ) : (
                        "No batches yet"
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card bg-accent/5 border-accent/20 relative flex max-h-64 flex-col items-center justify-center overflow-hidden border p-8 text-center backdrop-blur-sm">
                <div className="bg-accent/10 pointer-events-none absolute right-0 top-0 -mr-10 -mt-10 min-h-[200px] min-w-[200px] rounded-full p-12 blur-3xl"></div>
                <h3 className="z-10 mb-2 text-lg font-semibold text-foreground">
                  Verification Requests
                </h3>
                <p className="text-muted z-10 mb-6 max-w-sm text-sm">
                  Manage recent academic verification requests from employers manually or let the
                  Auto-claims process proofs securely.
                </p>
                <Link
                  href="/institution/verifications"
                  className="btn-primary z-10 flex items-center gap-2"
                >
                  View Verifications <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </GuardKyc>
      )}
    </DashboardLayout>
  )
}
