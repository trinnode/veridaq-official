"use client"
import { DashboardLayout } from "@/components/institution/layout"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { useParams, useRouter } from "next/navigation"
import { Ban } from "@/lib/icons"
import { useEffect, useState } from "react"
import { format } from "date-fns"

type Credential = {
  id: string
  commitment: string
  nullifier: string
  status: string
  graduationYear: number
  createdAt: string
}

type BatchDetail = {
  id: string
  status: string
  studentCount: number
  graduationYear: number
  createdAt: string
  txHash?: string
  credentials: Credential[]
}

const statusColors: Record<string, string> = {
  CONFIRMED: "badge-green",
  PROCESSING: "badge-blue",
  PENDING: "badge-yellow",
  FAILED: "badge-red",
  REVOKED: "badge-red",
}

function RevokeModal({
  credential,
  onClose,
  onRevoked,
}: {
  credential: Credential
  onClose: () => void
  onRevoked: () => void
}) {
  const [reasonCode, setReasonCode] = useState(1)
  const [busy, setBusy] = useState(false)
  const REASONS = [
    { code: 1, label: "Administrative error" },
    { code: 2, label: "Fraudulent document" },
    { code: 3, label: "Student request" },
    { code: 4, label: "Incorrect data" },
    { code: 5, label: "Other" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-4 backdrop-blur-sm">
      <div className="border-surface-border bg-surface-card w-full max-w-md rounded-xl border p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-foreground">Revoke Credential</h3>
        <p className="text-muted mt-1 text-xs">
          Nullifier: {credential.nullifier.slice(0, 18)}…
        </p>
        <div className="mt-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
            Reason for revocation
          </label>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(Number(e.target.value))}
            className="border-surface-border bg-void focus:border-accent w-full rounded-lg border px-3 py-2.5 text-sm text-foreground outline-none transition-colors"
          >
            {REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-muted mt-3 text-xs">
          This will permanently nullify this credential. Employers attempting to verify will see it
          as revoked.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost text-sm" disabled={busy}>
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true)
              try {
                await api.post("/institution/revoke", {
                  nullifier: credential.nullifier,
                  reasonCode,
                })
                toast.success("Credential revoked")
                onRevoked()
                onClose()
              } catch (err: any) {
                toast.error(err?.response?.data?.error ?? "Revocation failed")
              } finally {
                setBusy(false)
              }
            }}
            disabled={busy}
            className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-foreground transition-opacity hover:bg-error/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Revoking…" : "Confirm Revocation"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<Credential | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const { data } = await api.get(`/institution/batch/${params.id}`)
        setBatch(data)
      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? "Failed to load batch")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id, refreshKey])

  if (loading) {
    return (
      <DashboardLayout title="Batch Detail">
        <div className="text-muted flex items-center justify-center py-20 text-sm">Loading…</div>
      </DashboardLayout>
    )
  }

  if (!batch) {
    return (
      <DashboardLayout title="Batch Detail">
        <div className="text-muted py-20 text-center text-sm">Batch not found</div>
      </DashboardLayout>
    )
  }

  const Badge = ({ status }: { status: string }) => (
    <span className={statusColors[status] ?? "badge-muted"}>{status}</span>
  )

  return (
    <DashboardLayout title={`Batch — ${batch.id.slice(0, 8)}…`}>
      <button
        onClick={() => router.push("/institution/batches")}
        className="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-foreground"
      >
        ← Back to Batches
      </button>

      {/* Summary card */}
      <div className="border-surface-border bg-surface-card mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4">
        {[
          ["Status", <Badge key="s" status={batch.status} />],
          ["Students", String(batch.studentCount)],
          ["Year", String(batch.graduationYear)],
          ["Submitted", format(new Date(batch.createdAt), "dd MMM yyyy, HH:mm")],
        ].map(([label, value]) => (
          <div key={String(label)} className="px-4 py-3">
            <p className="text-xs text-muted">{String(label)}</p>
            <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
          </div>
        ))}
      </div>

      {batch.txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${batch.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent mb-6 inline-block text-xs hover:underline"
        >
          View on Basescan →
        </a>
      )}

      {/* Credential table */}
      <h3 className="text-foreground mb-3 text-sm font-semibold">
        Credentials ({batch.credentials.length})
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-surface-border border-b text-left">
              <th className="text-muted pb-3 font-medium">#</th>
              <th className="text-muted pb-3 font-medium">Commitment</th>
              <th className="text-muted pb-3 font-medium">Nullifier</th>
              <th className="text-muted pb-3 font-medium">Status</th>
              <th className="text-muted pb-3 font-medium">Year</th>
              <th className="text-muted pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batch.credentials.map((c, idx) => (
              <tr key={c.id} className="table-row">
                <td className="text-muted py-2.5">{idx + 1}</td>
                <td className="py-2.5 font-mono text-xs text-foreground">
                  {c.commitment.slice(0, 16)}…
                </td>
                <td className="py-2.5 font-mono text-xs text-foreground">
                  {c.nullifier.slice(0, 16)}…
                </td>
                <td className="py-2.5">
                  <Badge status={c.status} />
                </td>
                <td className="py-2.5 text-foreground">{c.graduationYear}</td>
                <td className="py-2.5">
                  {c.status === "ACTIVE" || c.status === "CONFIRMED" ? (
                    <button
                      onClick={() => setRevoking(c)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-error transition-colors hover:bg-error/10"
                    >
                      <Ban size={12} /> Revoke
                    </button>
                  ) : (
                    <span className="text-muted text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {batch.credentials.length === 0 && (
        <p className="text-muted py-8 text-center text-sm">No credentials in this batch.</p>
      )}

      {revoking && (
        <RevokeModal
          credential={revoking}
          onClose={() => setRevoking(null)}
          onRevoked={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </DashboardLayout>
  )
}
