"use client"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/lib/auth"
import { AuthSplit } from "@/components/ui/auth-split"
import { ArrowRight, Eye, EyeOff } from "@/lib/icons"
import { SafeLink as Link } from "@/components/safe-link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function AdminLogin() {
  const router = useRouter()
  const { login, user } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.role === "ADMIN") router.push("/admin/dashboard")
  }, [user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password, "admin")
      toast.success("Welcome back, Admin.")
      router.push("/admin/dashboard")
    } catch {
      toast.error("Invalid credentials.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplit role="admin" title="Admin Sign in" subtitle="Restricted access for platform administrators only." mode="login">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-muted mb-1.5 block text-xs font-medium uppercase tracking-wider">
            Email address
          </label>
          <input
            className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@veridaq.xyz"
            autoComplete="email"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-muted text-xs font-medium uppercase tracking-wider">
              Password
            </label>
            <Link
              href="/password/forgot"
              className="text-accent text-xs transition-colors hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              className="border-surface-border bg-void focus:border-accent w-full rounded-xl border px-4 py-2.5 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted/50"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
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
              Signing in...
            </span>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </AuthSplit>
  )
}
