"use client"

import { useMemo, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"

type ChartMode = "area" | "bar"

type SeriesItem = {
  month: string
  verifications: number
  verified: number
  failed: number
  pending: number
  batches: number
  credentials: number
  earnedUsd: number
  institutionShare: number
}

type ActivityChartProps = {
  title: string
  description?: string
  series: SeriesItem[]
  metrics: {
    key: string
    label: string
    color: string
  }[]
  defaultMode?: ChartMode
  /** @deprecated Not implemented in this version */
  showCredits?: boolean
  isLoading?: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="border-surface-border bg-surface-card/95 rounded-xl border p-3 shadow-lg backdrop-blur-xl">
      <p className="text-foreground mb-1 text-xs font-semibold">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted">{entry.name}:</span>
          <span className="text-foreground font-medium">
            {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
            {entry.name.toLowerCase().includes("earn") || entry.name.toLowerCase().includes("share")
              ? ` $${Number(entry.value).toFixed(2)}`
              : ""}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ActivityChart({
  title,
  description,
  series,
  metrics,
  defaultMode = "bar",
  showCredits: _showCredits = false,
  isLoading = false,
}: ActivityChartProps) {
  const [mode, setMode] = useState<ChartMode>(defaultMode)
  const [months, setMonths] = useState(6)

  const filtered = useMemo(() => {
    if (!series?.length) return []
    return series.slice(-months)
  }, [series, months])

  if (isLoading) {
    return (
      <div className="bg-surface-card border-surface-border rounded-xl border p-5">
        <div className="mb-4 h-5 w-48 animate-pulse rounded bg-white/5" />
        <div className="h-64 animate-pulse rounded bg-white/5" />
      </div>
    )
  }

  if (!filtered.length) {
    return (
      <div className="bg-surface-card border-surface-border rounded-xl border p-5">
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-muted mt-1 text-xs">{description}</p>}
        <div className="text-muted flex h-48 items-center justify-center text-sm">
          No data yet
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-card border-surface-border rounded-xl border p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-muted mt-0.5 text-xs">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-void/60 px-2 py-1 text-[10px] text-muted outline-none"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
          <div className="bg-void/60 flex rounded-lg border border-white/10 p-0.5">
            <button
              onClick={() => setMode("bar")}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                mode === "bar" ? "bg-accent text-void" : "text-muted hover:text-foreground"
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setMode("area")}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                mode === "area" ? "bg-accent text-void" : "text-muted hover:text-foreground"
              }`}
            >
              Area
            </button>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "bar" ? (
            <BarChart data={filtered} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "#9ca3af" }}
                iconType="circle"
                iconSize={6}
              />
              {metrics.map((m) => (
                <Bar
                  key={m.key}
                  dataKey={m.key}
                  name={m.label}
                  fill={m.color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={24}
                />
              ))}
            </BarChart>
          ) : (
            <AreaChart data={filtered} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                {metrics.map((m) => (
                  <linearGradient key={m.key} id={`gradient-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={m.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "#9ca3af" }}
                iconType="circle"
                iconSize={6}
              />
              {metrics.map((m) => (
                <Area
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  fill={`url(#gradient-${m.key})`}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
