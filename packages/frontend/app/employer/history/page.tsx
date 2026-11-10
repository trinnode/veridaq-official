"use client"
import { HistoryTable } from "@/components/employer/history-table"
import { EmployerLayout } from "@/components/employer/layout"
import { LoadFailure } from "@/components/ui/load-failure"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useEffect, useState } from "react"

type LoadError = { status: number | null; message: string }

export default function HistoryPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<LoadError | null>(null)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    api
      .get(`/verify/history?page=${page}&limit=20`)
      .then(({ data }) => setHistory(data))
      .catch((err) => {
        setHistory(null)
        setError({
          status: err?.response?.status ?? null,
          message: err?.response?.data?.error ?? "The verification history could not be loaded.",
        })
      })
      .finally(() => setLoading(false))
  }, [page, user, reloadKey])

  return (
    <EmployerLayout title="Verification History">
      {loading ? (
        <div className="text-muted py-12 text-center text-sm">Loading…</div>
      ) : error ? (
        <LoadFailure
          status={error.status}
          message={error.message}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <>
          <HistoryTable items={history?.items ?? []} />
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="btn-ghost text-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span className="text-muted py-2 text-sm">Page {page}</span>
            <button
              className="btn-ghost text-sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={history?.items.length < 20}
            >
              Next
            </button>
          </div>
        </>
      )}
    </EmployerLayout>
  )
}
