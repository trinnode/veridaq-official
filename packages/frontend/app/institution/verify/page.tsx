"use client"

import { VerifyButton } from "@/components/employer/verify-button"
import { DashboardLayout } from "@/components/institution/layout"
import { useAuth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function InstitutionVerifyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user && !user.alsoEmployer) {
      router.push("/institution/dashboard")
    }
  }, [loading, user, router])

  if (loading || !user) return null
  if (!user.alsoEmployer) return null

  return (
    <DashboardLayout title="Verify Credential">
      <div className="mx-auto max-w-2xl">
        <p className="text-muted mb-6 text-sm">
          You are acting as an employer to verify a credential from another institution.
        </p>
        <div className="border-surface-border bg-surface-card rounded-xl border p-6">
          <VerifyButton onComplete={() => {}} />
        </div>
      </div>
    </DashboardLayout>
  )
}
