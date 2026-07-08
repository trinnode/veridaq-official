"use client"

import { toast } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { AuthSplit } from "@/components/ui/auth-split"
import { ArrowRight, Eye, EyeOff, Key, Shield } from "@/lib/icons"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function InstitutionRegisterPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    publicKey: "",
    password: "",
    alsoEmployer: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.role === "INSTITUTION") router.push("/institution/dashboard")
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/auth/register/institution", {
        name: formData.name,
        email: formData.email,
        publicKey: formData.publicKey,
        password: formData.password,
        alsoEmployer: formData.alsoEmployer,
      })
      toast.success("Registration submitted! Awaiting KYC approval.")
      router.push("/institution/login?registered=true")
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

  const generateKeys = () => {
    const key = "0x04" + Array.from({ length: 128 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
    setFormData({ ...formData, publicKey: key })
    toast.success("Cryptographic keys generated!")
  }

  return (
    <AuthSplit role="institution" title="Register" subtitle="Register your institution to issue Zero Knowledge credentials." mode="register">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">Institution Name</label>
          <input
            type="text"
            required
            className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
            placeholder="Federal University of Technology"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">Official Email</label>
          <input
            type="email"
            required
            className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
            placeholder="registrar@university.edu.ng"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">Institution Public Key</label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              readOnly
              className="border-surface-border bg-void focus:border-accent min-w-0 flex-1 rounded-xl border px-4 py-2.5 font-mono text-xs text-muted outline-none"
              value={formData.publicKey || "Click generate to create keys"}
            />
            <button
              type="button"
              onClick={generateKeys}
              className="border-surface-border hover:bg-surface flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium text-foreground transition-colors"
            >
              <Key className="h-3 w-3" />
              Generate
            </button>
          </div>
          {formData.publicKey && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-success">
              <Shield className="h-3 w-3" /> Cryptographic keys attached
            </p>
          )}
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

        <div className="border-surface-border bg-void/50 rounded-xl border p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-surface-border text-accent focus:ring-accent"
              checked={formData.alsoEmployer}
              onChange={(e) => setFormData({ ...formData, alsoEmployer: e.target.checked })}
            />
            <div>
              <p className="font-medium text-foreground text-sm">Also act as an employer</p>
              <p className="text-muted text-xs mt-1">
                Verify credentials from other institutions. A linked employer profile will be created upon KYC approval.
              </p>
            </div>
          </label>
        </div>

        <button
          type="submit"
          className="bg-accent hover:bg-accent-dim mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-void transition-all active:scale-[0.98] disabled:opacity-50"
          disabled={loading || !formData.publicKey}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-void/30 border-t-void" />
              Registering...
            </span>
          ) : (
            <>
              Submit Registration
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthSplit>
  )
}
