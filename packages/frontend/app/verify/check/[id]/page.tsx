"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { BASE_URL } from "@/lib/api"
import { AppHeader } from "@/components/ui/app-header"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { FloatingShapes } from "@/components/parallax/floating-shapes"
import { ChevronRight, ShieldCheck, ShieldAlert, ExternalLink, Clock, XCircle } from "@/lib/icons"
import { SafeLink as Link } from "@/components/safe-link"

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
  1: "Programme Completion (Graduated)",
  2: "Minimum Second Class Lower",
  3: "Minimum Second Class Upper",
  4: "First Class Honours",
  5: "CGPA Above Threshold",
  6: "Programme Specific Completion",
}

export default function VerifyCheckPage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<CheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
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
          setData(null)
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
      <ParallaxBg opacity={0.2} />
      <FloatingShapes count={6} />

      <div className="container mx-auto max-w-2xl px-4 md:px-6 pt-28 pb-16">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-muted-subtle">
          <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-accent">Verification Check</span>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="border-accent/30 h-8 w-8 animate-spin rounded-full border-2 border-t-accent" />
            <p className="mt-4 font-mono text-sm text-muted">Loading verification result...</p>
          </div>
        )}

        {error && !loading && (
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <XCircle className="h-8 w-8 text-warning" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-foreground">Verification Not Found</h1>
            <p className="font-mono text-sm text-muted">{error}</p>
            <Link
              href="/"
              className="mt-6 inline-block rounded bg-accent px-5 py-2 text-sm font-bold text-void transition-opacity hover:opacity-90"
            >
              Return Home
            </Link>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Result Hero */}
            <div className={`mb-6 rounded-lg border ${isVerified ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"} p-6 text-center`}>
              <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${isVerified ? "bg-success/10" : "bg-warning/10"}`}>
                {isVerified ? (
                  <ShieldCheck className="h-8 w-8 text-success" />
                ) : (
                  <ShieldAlert className="h-8 w-8 text-warning" />
                )}
              </div>
              <h1 className={`text-2xl font-black uppercase tracking-tight ${isVerified ? "text-success" : "text-warning"}`}>
                {isVerified ? "Credential Verified" : "Claim Not Satisfied"}
              </h1>
              <p className="mt-2 font-mono text-xs text-muted">
                {isVerified
                  ? "This credential was cryptographically verified using a Groth16 zero-knowledge proof"
                  : "The submitted credential does not satisfy the requested claim threshold"
                }
              </p>
            </div>

            {/* Details Card */}
            <div className="rounded-lg border border-surface-border bg-surface-card p-5">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-accent">Verification Details</h2>

              <div className="space-y-3">
                <div className="flex justify-between border-b border-surface-border/50 pb-2">
                  <span className="font-mono text-xs text-muted">Institution</span>
                  <span className="text-right text-xs font-semibold text-foreground">{data.institution ?? "Unknown"}</span>
                </div>
                <div className="flex justify-between border-b border-surface-border/50 pb-2">
                  <span className="font-mono text-xs text-muted">Claim Type</span>
                  <span className="text-right text-xs font-semibold text-foreground">{CLAIM_LABELS[data.claimType] ?? `Claim Type ${data.claimType}`}</span>
                </div>
                {data.threshold > 0 && (
                  <div className="flex justify-between border-b border-surface-border/50 pb-2">
                    <span className="font-mono text-xs text-muted">Threshold</span>
                    <span className="text-right text-xs font-semibold text-foreground">{data.threshold}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-surface-border/50 pb-2">
                  <span className="font-mono text-xs text-muted">Result</span>
                  <span className={`text-right text-xs font-bold ${isVerified ? "text-success" : "text-warning"}`}>
                    {data.result.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex justify-between border-b border-surface-border/50 pb-2">
                  <span className="font-mono text-xs text-muted">Completed</span>
                  <span className="text-right text-xs text-foreground">
                    {new Date(data.completedAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-muted">Verification ID</span>
                  <span className="max-w-[200px] truncate text-right font-mono text-xs text-foreground">{data.id}</span>
                </div>
              </div>

              {data.txHash && (
                <div className="mt-4 rounded bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-3 w-3 text-accent" />
                    <span className="font-mono text-[10px] text-muted">Transaction Hash</span>
                  </div>
                  <a
                    href={`https://sepolia.basescan.org/tx/${data.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all font-mono text-[11px] text-accent underline decoration-accent/30 transition-colors hover:decoration-accent"
                  >
                    {data.txHash}
                  </a>
                </div>
              )}
            </div>

            {/* Trust Badge */}
            <div className="mt-6 rounded-lg border border-surface-border bg-surface-card/50 p-4 text-center">
              <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-accent" />
              <p className="font-mono text-[11px] text-muted leading-relaxed">
                This verification is independently verifiable on the Base blockchain.
                No student personal data is stored on-chain.
              </p>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted-subtle">
                <Clock className="h-3 w-3" />
                <span>Zero-knowledge proof verified by VERIDAQ</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
