"use client"

import { api } from "@/lib/api"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function EarningsSummary() {
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    api.get("/earnings").then(({ data }) => setTotal(data.totalEarned)).catch(() => {})
  }, [])

  return (
    <div className="mt-2 flex items-center justify-between">
      <p className="text-2xl font-semibold text-foreground">
        ${total?.toFixed(2) ?? "0.00"}
      </p>
      <Link
        href="/institution/earnings"
        className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-xs font-medium"
      >
        Details <ArrowRight size={12} />
      </Link>
    </div>
  )
}
