"use client"

import { DashboardLayout } from "@/components/institution/layout"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { toast } from "@/components/ui/toast"
import { Loader2 } from "@/lib/icons"
import { useState } from "react"

export default function InstitutionSettingsPage() {
  const { user, loading } = useAuth()
  const [toggling, setToggling] = useState(false)
  const [alsoEmployer, setAlsoEmployer] = useState(user?.alsoEmployer ?? false)

  async function handleToggle() {
    setToggling(true)
    try {
      const { data } = await api.patch("/institution/employer-access", { enabled: !alsoEmployer })
      setAlsoEmployer(data.alsoEmployer)
      if (data.pendingAdminApproval) {
        toast.success("Employer access request sent — pending admin approval")
      } else {
        toast.success(data.alsoEmployer ? "Employer access activated" : "Employer access deactivated")
      }
    } catch {
      toast.error("Failed to update employer access")
    } finally {
      setToggling(false)
    }
  }

  const employerActive = user?.employerActive ?? false
  const pendingApproval = alsoEmployer && !employerActive

  if (loading || !user) return null

  return (
    <DashboardLayout title="Settings">
      <div className="bg-surface-card border-surface-border mx-auto max-w-xl rounded-xl border p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Employer Access</h2>
        <p className="text-muted mb-4 text-sm leading-relaxed">
          When enabled, your institution can also verify credentials from other institutions.
          This creates a linked employer profile tied to your institution account.
        </p>

        <div className="flex items-center justify-between rounded-lg border border-surface-border p-4">
          <div>
            <div className="text-sm font-medium text-foreground">Also act as an employer</div>
            <div className="text-xs" style={{ color: pendingApproval ? "#facc15" : undefined }}>
              {pendingApproval
                ? "Pending admin approval — your request has been sent"
                : alsoEmployer
                  ? "Enabled — you can verify credentials"
                  : "Disabled"}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              alsoEmployer ? "bg-accent" : "bg-surface-border"
            }`}
          >
            {toggling ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-void" />
            ) : (
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  alsoEmployer ? "translate-x-6" : "translate-x-1"
                }`}
              />
            )}
          </button>
        </div>

        {pendingApproval && (
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "#facc15" }}>
            Your employer access is pending platform admin approval. You will be notified
            once your request is reviewed.
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
