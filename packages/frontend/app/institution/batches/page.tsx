"use client"
import { BatchTable } from "@/components/institution/batch-table"
import { DashboardLayout } from "@/components/institution/layout"
import { UploadModal } from "@/components/institution/upload-modal"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { toast } from "@/components/ui/toast"
import { LoadFailure } from "@/components/ui/load-failure"
import { Download } from "@/lib/icons"
import { useEffect, useState } from "react"

export default function BatchesPage() {
  const { user } = useAuth()
  const [batches, setBatches] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ status: number | null; message: string } | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  async function load(page = 1) {
    try {
      setLoading(true)
      setError(null)
      const { data } = await api.get(`/institution/batch?page=${page}&limit=10`)
      setBatches(data)
    } catch (err: any) {
      // A failed load is not an empty batch list; keep the distinction visible.
      setBatches(null)
      setError({
        status: err?.response?.status ?? null,
        message: err?.response?.data?.error ?? "The batch list could not be loaded.",
      })
      toast.error(err?.response?.data?.error ?? "Failed to load batches")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      load()
    }
  }, [user])

  // Poll every 10s while any batch is still pending on chain. The flag is
  // derived, not stored: storing it made the effect cancel itself in a loop.
  const hasActiveBatch = (batches?.items ?? []).some(
    (b: any) => b.status === "PENDING" || b.status === "PROCESSING"
  )

  useEffect(() => {
    if (!hasActiveBatch) return
    const interval = setInterval(() => load(), 10000)
    return () => clearInterval(interval)
  }, [hasActiveBatch])

  async function downloadTemplate() {
    try {
      const response = await api.get("/institution/batch/template", {
        responseType: "blob",
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement("a")
      a.href = url
      a.download = "veridaq_template.xlsx"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to download template")
    }
  }

  return (
    <DashboardLayout title="Credential Batches">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-muted max-w-lg text-sm">
          Upload Excel files to register student credentials on-chain. Required columns: MATRIC
          NUMBER, STUDENT NAME, CGPA, CLASSIFICATION, COURSE NAME, GRADUATION YEAR.
        </p>
        <div className="flex gap-3">
          <button className="btn-ghost" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            Template
          </button>
          <button className="btn-primary" onClick={() => setShowUpload(true)}>
            Upload Batch
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted py-12 text-center text-sm">Loading…</div>
      ) : error ? (
        <LoadFailure status={error.status} message={error.message} onRetry={() => load()} />
      ) : (
        <BatchTable batches={batches?.items ?? []} onDismiss={load} />
      )}

      {showUpload && (
        <UploadModal
          onDismiss={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            load()
          }}
        />
      )}
    </DashboardLayout>
  )
}
