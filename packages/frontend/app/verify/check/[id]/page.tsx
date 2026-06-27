"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { BASE_URL } from "@/lib/api"
import { AppHeader } from "@/components/ui/app-header"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { ExternalLink, Clock } from "@/lib/icons"

type CheckResult = {
  id: string
  status: string
  result: string
  institution: string | null
  claimType: number
  threshold: number
  txHash: string | null
  completedAt: string
}

const CLAIM_LABELS: Record<number, string> = {
  1: "Graduated",
  2: "Minimum Second Class Lower",
  3: "Minimum Second Class Upper",
  4: "First Class Honours",
  5: "CGPA Above Threshold",
  6: "Programme Completion",
}

export default function VerifyCheckPage() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const [data, setData] = useState<CheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!id || fetchedRef.current) return
    fetchedRef.current = true

    const controller = new AbortController()

    async function fetchResult() {
      try {
        const res = await fetch(`${BASE_URL}/api/verify/check/${id}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          if (res.status === 404) throw new Error("Verification record not found")
          throw new Error("Unable to load verification result")
        }
        const json = await res.json()
        if (json.status && !json.result) {
          setError("This verification is still being processed. Check back later.")
          return
        }
        setData(json)
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load verification")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchResult()
    return () => controller.abort()
  }, [id])

  if (!id) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <p className="font-mono text-sm text-muted">No verification ID provided.</p>
      </div>
    )
  }

  const isVerified = data?.result === "VERIFIED"

  return (
    <div className="min-h-screen bg-void">
      <AppHeader />
      <ParallaxBg opacity={0.15} />

      <div className="container mx-auto max-w-xl px-4 md:px-6 pt-24 pb-16">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="border-foreground/10 h-7 w-7 animate-spin rounded-full border-2 border-t-foreground/40" />
            <p className="mt-4 font-mono text-xs text-muted">Loading verification result...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="mx-auto max-w-sm py-20 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-muted/20">
              <span className="font-mono text-lg text-muted">!</span>
            </div>
            <h1 className="mb-1 text-base font-semibold text-foreground">Not Found</h1>
            <p className="font-mono text-xs text-muted">{error}</p>
            <a
              href="/"
              className="mt-6 inline-block rounded border border-foreground/10 px-5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              Return Home
            </a>
          </div>
        )}

        {/* Result */}
        {data && !loading && (
          <>

            {/* Status Badge */}
            <div className="mb-2 flex items-center justify-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${isVerified ? "bg-green-500" : "bg-muted"}`} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-subtle">
                {isVerified ? "Verified" : "Not Satisfied"}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-center text-lg font-semibold text-foreground">
              {isVerified ? "Credential Verified" : "Claim Not Satisfied"}
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-center font-mono text-[11px] leading-relaxed text-muted">
              {isVerified
                ? "This credential was cryptographically verified using a zero-knowledge proof on the Base blockchain."
                : "The submitted credential does not satisfy the requested claim."
              }
            </p>

            {/* Details */}
            <div className="mx-auto mt-6 max-w-sm rounded border border-foreground/10 bg-void/50">
              <div className="divide-y divide-foreground/5">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-mono text-[11px] text-muted">Institution</span>
                  <span className="text-right text-[11px] text-foreground">{data.institution ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-mono text-[11px] text-muted">Claim</span>
                  <span className="text-right text-[11px] text-foreground">{CLAIM_LABELS[data.claimType] ?? `Claim Type ${data.claimType}`}</span>
                </div>
                {isVerified && data.threshold > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-mono text-[11px] text-muted">Threshold</span>
                    <span className="text-right text-[11px] text-foreground">{data.threshold}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-mono text-[11px] text-muted">Completed</span>
                  <span className="text-right text-[11px] text-foreground">
                    {new Date(data.completedAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                {isVerified && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-mono text-[11px] text-muted">ID</span>
                    <span className="max-w-[160px] truncate text-right font-mono text-[11px] text-foreground">{data.id}</span>
                  </div>
                )}
              </div>

              {isVerified && data.txHash && (
                <div className="border-t border-foreground/5 px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3 text-muted" />
                    <span className="font-mono text-[10px] text-muted">Transaction</span>
                  </div>
                  <a
                    href={`https://sepolia.basescan.org/tx/${data.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block break-all font-mono text-[11px] text-foreground underline underline-offset-2 decoration-foreground/20 transition-colors hover:decoration-foreground/60"
                  >
                    {data.txHash}
                  </a>
                </div>
              )}
            </div>

            {/* Verification Seal */}
            <div className="mx-auto mt-6 max-w-sm rounded border border-foreground/5 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Clock className="h-3 w-3 text-muted" />
                <span className="font-mono text-[10px] text-muted">
                  Verified by VERIDAQ &middot; Groth16 ZKP &middot; Base
                </span>
              </div>
              <p className="mt-1 font-mono text-[9px] text-muted-subtle leading-relaxed">
                This verification is independently verifiable on-chain. No student data is stored on the blockchain.
              </p>
            </div>

          </>
        )}
      </div>
    </div>
  )
}
