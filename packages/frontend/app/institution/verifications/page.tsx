"use client"

import { DashboardLayout } from "@/components/institution/layout"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { toast } from "@/components/ui/toast"
import { useEffect, useState } from "react"
import { Check, X, Clock, CheckCircle2, XCircle, ChevronRight, Building2, Mail } from "@/lib/icons"

const CLAIM_MAP: Record<number, string> = {
  1: "Graduated",
  2: "Second Class Lower",
  3: "Second Class Upper",
  4: "First Class",
  5: "CGPA Above Threshold",
  6: "Programme Completion",
}

type VerificationItem = {
  id: string
  status: string
  result: string | null
  claimType: number
  threshold: number
  matricNumber: string
  courseName: string | null
  createdAt: string
  completedAt: string | null
  employer: { name: string; email: string } | null
  claimLabel: string | null
  claimDescription: string | null
  reviewType: string
}

export default function VerificationsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<VerificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [selected, setSelected] = useState<VerificationItem | null>(null)
  const [declineModal, setDeclineModal] = useState<{ id: string; open: boolean }>({ id: "", open: false })
  const [declineComment, setDeclineComment] = useState("")

  const fetchVerifications = () => {
    api.get("/institution/verifications")
      .then(({ data }) => setRequests(data?.items || []))
      .catch((err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to load verification requests"
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user) return
    fetchVerifications()
  }, [user])

  useEffect(() => {
    const hasActive = requests.some(
      (r) => r.status === "AWAITING_INSTITUTION" || r.status === "PROCESSING"
    )
    if (hasActive && !polling) {
      setPolling(true)
      const interval = setInterval(() => {
        fetchVerifications()
        if (selected) {
          api.get(`/institution/verifications/${selected.id}`)
            .then(({ data }) => setSelected(data))
            .catch(() => {})
        }
      }, 10000)
      return () => { clearInterval(interval); setPolling(false) }
    } else if (!hasActive && polling) {
      setPolling(false)
    }
  }, [requests, polling, selected])

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    try {
      await api.post(`/institution/verifications/${id}/approve`)
      toast.success("Verification approved — proof generation started")
      fetchVerifications()
      setSelected(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to approve")
    } finally {
      setProcessingId(null)
    }
  }

  const openDeclineModal = () => {
    if (!selected) return
    setDeclineComment("")
    setDeclineModal({ id: selected.id, open: true })
  }

  const confirmDecline = async () => {
    const id = declineModal.id
    if (!id) return
    setProcessingId(id)
    setDeclineModal({ id: "", open: false })
    try {
      await api.post(`/institution/verifications/${id}/decline`, { comment: declineComment || undefined })
      toast.success("Verification declined")
      fetchVerifications()
      setSelected(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to decline")
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AWAITING_INSTITUTION":
        return <span className="flex items-center gap-1 text-orange-400 bg-orange-400/10 px-2 py-1 text-xs border border-orange-400/20 rounded"><Clock className="w-3 h-3" /> Manual Review</span>
      case "PROCESSING":
        return <span className="flex items-center gap-1 text-blue-400 bg-blue-400/10 px-2 py-1 text-xs border border-blue-400/20 rounded"><Clock className="w-3 h-3" /> Generating Proof</span>
      case "COMPLETED":
        return <span className="flex items-center gap-1 text-accent bg-accent/10 px-2 py-1 text-xs border border-accent/20 rounded"><CheckCircle2 className="w-3 h-3" /> Completed</span>
      case "FAILED":
        return <span className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 text-xs border border-red-500/20 rounded"><XCircle className="w-3 h-3" /> Failed/Rejected</span>
      default:
        return <span className="text-muted text-xs border border-surface-border px-2 py-1 rounded">{status}</span>
    }
  }

  return (
    <DashboardLayout title="Verification Requests">
      <p className="text-muted text-sm mb-6 max-w-2xl">
        Monitor incoming verification requests from employers. Click any request to review full details before approving or declining.
      </p>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Table */}
        <div className={`${selected ? "lg:w-1/2" : "lg:w-full"} overflow-x-auto border border-surface-border rounded bg-surface-card`}>
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-void/50 text-xs uppercase text-muted border-b border-surface-border">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Employer</th>
                <th className="px-4 py-3 font-medium">Matric No.</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Claim</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {requests.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted text-sm">
                    No verification requests found.
                  </td>
                </tr>
              )}
              {requests.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`hover:bg-void/30 transition-colors cursor-pointer ${selected?.id === r.id ? "bg-void/40" : ""}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted text-xs">
                    {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{r.employer?.name || r.employer?.email || "—"}</div>
                  </td>
                  <td className="px-4 py-3 font-mono opacity-80 text-xs">{r.matricNumber}</td>
                  <td className="hidden px-4 py-3 md:table-cell text-muted text-xs">
                    {r.claimLabel ?? CLAIM_MAP[r.claimType] ?? `Type ${r.claimType}`}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(r.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className={`w-4 h-4 text-muted transition-transform ${selected?.id === r.id ? "rotate-90" : ""}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="text-muted py-8 text-center text-sm">Loading...</div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:w-1/2 border border-surface-border rounded bg-surface-card">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-foreground">Request Details</h2>
                <button onClick={() => setSelected(null)} className="text-muted hover:text-foreground text-xs border border-surface-border px-2 py-1 rounded transition-colors">Close</button>
              </div>

              {/* Status */}
              <div className="mb-5">
                {getStatusBadge(selected.status)}
              </div>

              {/* Employer Info */}
              <div className="mb-4">
                <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted mb-2">Employer</h3>
                <div className="bg-void/50 rounded border border-surface-border divide-y divide-surface-border">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Building2 className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="text-sm text-foreground">{selected.employer?.name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="text-sm text-foreground">{selected.employer?.email || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Claim Details */}
              <div className="mb-4">
                <h3 className="text-[10px] font-medium uppercase tracking-widest text-muted mb-2">Claim Details</h3>
                <div className="bg-void/50 rounded border border-surface-border divide-y divide-surface-border">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted">Matric Number</span>
                    <span className="text-xs font-mono text-foreground">{selected.matricNumber}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted">Claim Type</span>
                    <span className="text-xs text-foreground">{selected.claimLabel ?? CLAIM_MAP[selected.claimType] ?? `Type ${selected.claimType}`}</span>
                  </div>
                  {selected.courseName && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted">Course / Programme</span>
                      <span className="text-xs text-foreground font-medium">{selected.courseName}</span>
                    </div>
                  )}
                  {selected.claimDescription && (
                    <div className="px-3 py-2">
                      <span className="text-xs text-muted block mb-0.5">Description</span>
                      <span className="text-xs text-foreground/80">{selected.claimDescription}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted">Review Type</span>
                    <span className="text-xs text-foreground">{selected.reviewType === "MANUAL" ? "Manual Review" : "Automatic"}</span>
                  </div>
                  {selected.threshold > 0 && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-muted">Threshold</span>
                      <span className="text-xs text-foreground">{selected.threshold}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted">Requested</span>
                    <span className="text-xs text-foreground">
                      {new Date(selected.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selected.status === "AWAITING_INSTITUTION" && (
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => handleApprove(selected.id)}
                    disabled={processingId === selected.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-void bg-accent hover:bg-accent/90 rounded transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> {processingId === selected.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={openDeclineModal}
                    disabled={processingId === selected.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 rounded transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Decline comment modal */}
      {declineModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="border-surface-border bg-surface-card w-full max-w-md rounded-xl border p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Decline Verification</h3>
            <p className="text-muted mt-1 text-sm">This record will be marked as not found.</p>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Reason (institution only — not shared externally)
              </label>
              <textarea
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                placeholder="Optional internal note about why this was declined..."
                className="bg-void border-surface-border focus:border-accent h-24 w-full resize-none rounded-lg border px-3 py-2 text-sm text-foreground outline-none transition-colors"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeclineModal({ id: "", open: false })}
                className="border-surface-border rounded-lg border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={confirmDecline}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-foreground transition-opacity hover:bg-red-700"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
