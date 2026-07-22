"use client"

import { api } from "@/lib/api"
import { useEffect, useState } from "react"
import { SafeLink as Link } from "@/components/safe-link"
import { ArrowRight, Wallet } from "@/lib/icons"

type EarningsData = {
  totalEarnedUsd: number
  availableUsd: number
  withdrawnUsd: number
  payoutWallet: string | null
}

export function EarningsSummary() {
  const [data, setData] = useState<EarningsData | null>(null)

  useEffect(() => {
    api.get("/earnings").then(({ data }) => setData(data as EarningsData)).catch(() => {})
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-muted text-xs">Available</span>
        <span className="text-accent text-lg font-bold">
          ${(data?.availableUsd ?? 0).toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted text-xs">Total Earned</span>
        <span className="text-foreground text-sm font-medium">
          ${(data?.totalEarnedUsd ?? 0).toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted text-xs">Withdrawn</span>
        <span className="text-foreground text-sm">
          ${(data?.withdrawnUsd ?? 0).toFixed(2)}
        </span>
      </div>
      <Link
        href="/institution/earnings"
        className="text-accent hover:text-accent/80 mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-accent/20 bg-accent/5 py-1.5 text-xs font-medium transition-colors"
      >
        <Wallet size={12} /> Details & Withdraw <ArrowRight size={12} />
      </Link>
    </div>
  )
}
