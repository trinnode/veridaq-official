"use client"
import { downloadReport } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { format } from "date-fns"
import { useState } from "react"

type Item = {
  id: string
  status: string
  result: string | null
  claimType: number
  createdAt: string
  completedAt?: string
  /** Public note from the institution — carries the decline reason. */
  institutionNote?: string | null
  institution: { name: string }
}

const CLAIM_LABELS: Record<number, string> = {
  1: "Graduated",
  2: "Minimum Second Class Lower",
  3: "Minimum Second Class Upper",
  4: "First Class",
  5: "CGPA Above Threshold",
  6: "Programme Completion",
}

const resultClass: Record<string, string> = {
  VERIFIED: "badge-green",
  CLAIM_NOT_SATISFIED: "badge-red",
  CREDENTIAL_REVOKED: "badge-red",
  RECORD_NOT_FOUND: "badge-red",
}

export function HistoryTable({ items }: { items: Item[] }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(requestId: string) {
    setDownloading(requestId)
    try {
      await downloadReport(requestId)
    } catch {
      toast.error("Failed to download report")
    } finally {
      setDownloading(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="border-surface-border bg-surface-card rounded-xl border px-6 py-12 text-center">
        <p className="text-foreground text-sm font-medium">No verification history yet</p>
        <p className="text-muted mt-1 text-xs">
          Checks you run will appear here with their outcome and, where the institution
          declined, the reason it gave.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-surface-border border-b text-left">
            <th className="text-muted pb-3 font-medium">Date</th>
            <th className="text-muted pb-3 font-medium">Institution</th>
            <th className="text-muted pb-3 font-medium">Claim</th>
            <th className="text-muted pb-3 font-medium">Result</th>
            <th className="text-muted pb-3 font-medium">Report</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="table-row">
              <td className="text-muted py-3">{format(new Date(item.createdAt), "dd MMM yyyy")}</td>
              <td className="py-3 text-foreground">{item.institution.name}</td>
              <td className="text-muted py-3">{CLAIM_LABELS[item.claimType] ?? `Type ${item.claimType}`}</td>
              <td className="py-3">
                {item.result ? (
                  <div className="space-y-1">
                    <span className={resultClass[item.result] ?? "badge-muted"}>
                      {item.result.replace(/_/g, " ")}
                    </span>
                    {/* The institution's decline reason, verbatim. Truncated in the
                        cell but available in full on hover and to screen readers. */}
                    {item.institutionNote && (
                      <p
                        className="text-muted max-w-[22rem] text-xs leading-snug"
                        title={item.institutionNote}
                      >
                        {item.institutionNote}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="badge-yellow">{item.status}</span>
                )}
              </td>
              <td className="py-3">
                {item.result ? (
                  <button
                    onClick={() => handleDownload(item.id)}
                    disabled={downloading === item.id}
                    className="btn-ghost text-xs disabled:opacity-50"
                  >
                    {downloading === item.id ? "Downloading..." : "Download PDF"}
                  </button>
                ) : (
                  <span className="text-muted text-xs">Unavailable</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
