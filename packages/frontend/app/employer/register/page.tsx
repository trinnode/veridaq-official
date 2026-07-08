"use client"

import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { AuthSplit } from "@/components/ui/auth-split"
import { ArrowRight, Eye, EyeOff } from "@/lib/icons"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function EmployerRegisterPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: "",
    cacNumber: "",
    email: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.role === "EMPLOYER") router.push("/employer/dashboard")
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/auth/register/employer", formData)
      toast.success("Registration submitted! Awaiting KYC approval.")
      router.push("/employer/login?registered=true")
    } catch (err: unknown) {
      const resp =
        typeof err === "object" && err !== null
          ? (err as Record<string, unknown>)["response"] as Record<string, unknown> | undefined
          : undefined
      const data = resp?.["data"] as Record<string, unknown> | undefined
      toast.error(
        (typeof data?.["error"] === "string" ? data["error"] : null) ||
          "Registration failed. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplit role="employer" title="Register" subtitle="Create an employer account to verify academic credentials." mode="register">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">Company Name</label>
          <input
            type="text"
            required
            className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
            placeholder="First Bank Nigeria"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">CAC Number</label>
          <input
            type="text"
            required
            className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
            placeholder="RC123456"
            value={formData.cacNumber}
            onChange={(e) => setFormData({ ...formData, cacNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">Email</label>
          <input
            type="email"
            required
            className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
            placeholder="hr@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
              placeholder="Min 8 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="bg-accent hover:bg-accent-dim mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-void transition-all active:scale-[0.98] disabled:opacity-50"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-void/30 border-t-void" />
              Registering...
            </span>
          ) : (
            <>
              Create Account
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthSplit>
  )
}
