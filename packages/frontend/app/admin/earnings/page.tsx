"use client"

import { AdminLayout } from "@/components/admin/layout"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { useEffect, useState } from "react"
import { Loader2 } from "@/lib/icons"

type PoolSummary = {
  availableUsd: number
  totalDepositedUsd: number
  totalSpentUsd: number
}

type PlatformData = {
  pool: PoolSummary
  totalEarnedUsd: number
  totalWithdrawnUsd: number
  totalTransactions: number
  institutionEarnings: {
    totalEarnedUsd: number
    availableUsd: number
    withdrawnUsd: number
  }
}

type InstitutionEarningItem = {
  id: string
  institution: { id: string; name: string; email: string }
  totalEarnedUsd: number
  availableUsd: number
  withdrawnUsd: number
  payoutWallet: string | null
}

type InstitutionListResponse = {
  total: number
  page: number
  limit: number
  items: InstitutionEarningItem[]
}

export default function AdminEarningsPage() {
  const [pool, setPool] = useState<PoolSummary | null>(null)
  const [platform, setPlatform] = useState<PlatformData | null>(null)
  const [instList, setInstList] = useState<InstitutionListResponse | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const [poolRes, platRes, instRes] = await Promise.all([
        api.get("/admin/earnings/pool"),
        api.get("/admin/earnings/platform"),
        api.get("/admin/earnings/institutions"),
      ])
      setPool(poolRes.data as PoolSummary)
      setPlatform(platRes.data as PlatformData)
      setInstList(instRes.data as InstitutionListResponse)
    } catch {
      toast.error("Failed to load earnings data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <AdminLayout title="Earnings">
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      </AdminLayout>
    )
  }

  const platInst = platform?.institutionEarnings

  return (
    <AdminLayout title="Earnings">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Platform Revenue</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            ${((platform?.totalEarnedUsd ?? 0) - (platInst?.totalEarnedUsd ?? 0)).toFixed(2)}
          </div>
          <div className="text-muted mt-1 text-xs">
            Total earned: ${(platform?.totalEarnedUsd ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Withdrawn (Platform)</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            ${(platform?.totalWithdrawnUsd ?? 0).toFixed(2)}
          </div>
          <div className="text-muted mt-1 text-xs">{platform?.totalTransactions ?? 0} transactions</div>
        </div>
        <div className="bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Gas Pool</div>
          <div className="mt-1 text-2xl font-bold text-accent">${(pool?.availableUsd ?? 0).toFixed(2)}</div>
          <div className="text-muted mt-1 text-xs">Deposited: ${(pool?.totalDepositedUsd ?? 0).toFixed(2)}</div>
        </div>
        <div className="bg-surface-card border-surface-border rounded-xl border p-5">
          <div className="text-muted text-xs font-medium uppercase tracking-wider">Institution Earnings</div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            ${(platInst?.totalEarnedUsd ?? 0).toFixed(2)}
          </div>
          <div className="text-muted mt-1 text-xs">Available: ${(platInst?.availableUsd ?? 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Institution earnings table */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Institution Earnings</h2>
        {!instList || instList.items.length === 0 ? (
          <p className="text-muted text-sm">No institutions with earnings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-surface-border border-b text-left text-xs font-medium uppercase tracking-wider text-muted">
                  <th className="pb-2 pr-4">Institution</th>
                  <th className="pb-2 pr-4">Total Earned</th>
                  <th className="pb-2 pr-4">Available</th>
                  <th className="pb-2 pr-4">Withdrawn</th>
                  <th className="pb-2 pr-4">Wallet</th>
                </tr>
              </thead>
              <tbody>
                {instList.items.map((item) => (
                  <tr key={item.id} className="border-surface-border border-b">
                    <td className="py-3 pr-4 font-medium text-foreground">{item.institution.name}</td>
                    <td className="py-3 pr-4 text-foreground">${item.totalEarnedUsd.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-foreground">
                      <span className={item.availableUsd > 0 ? "text-accent" : ""}>
                        ${item.availableUsd.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted">${item.withdrawnUsd.toFixed(2)}</td>
                    <td className="py-3 text-muted font-mono text-xs">
                      {item.payoutWallet
                        ? `${item.payoutWallet.slice(0, 6)}...${item.payoutWallet.slice(-4)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
