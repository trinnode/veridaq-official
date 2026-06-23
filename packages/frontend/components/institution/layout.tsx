"use client"
import { OrbitalLoader } from "@/components/ui/orbital-loader"
import { useAuth } from "@/lib/auth"
import { LogOut, Menu, X, ChevronRight, Building2 } from "@/lib/icons"
import { usePathname, useRouter } from "next/navigation"
import { SafeLink } from "@/components/safe-link"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { useEffect, useState } from "react"
import { LogoMark } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { PortalBg } from "@/components/parallax/floating-shapes"

const baseNav = [
  { href: "/institution/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/institution/batches", label: "Batches", icon: "layers" },
  { href: "/institution/claims", label: "Claims", icon: "file-check" },
  { href: "/institution/verifications", label: "Verifications", icon: "shield-check" },
  { href: "/institution/billing", label: "Billing", icon: "wallet" },
]

const employerNav = [
  { href: "/institution/verify", label: "Verify", icon: "shield-check" },
  { href: "/institution/earnings", label: "Earnings", icon: "wallet" },
  { href: "/institution/settings", label: "Settings", icon: "settings" },
]

export function DashboardLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { logout, user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/institution/login")
    }
  }, [loading, user, router])

  function handleLogout() {
    logout().catch(() => {})
    window.location.href = "/institution/login"
  }

  // Safety: fall through after 8s even if auth is stuck
  const [authTimeout, setAuthTimeout] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAuthTimeout(true), 8000)
    return () => clearTimeout(t)
  }, [])

  if (loading && !authTimeout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-void text-sm tracking-widest text-muted">
        <OrbitalLoader label="VERIFYING" />
        <span className="animate-pulse">Verifying session...</span>
      </div>
    )
  }

  if (!user) {
    router.push("/institution/login")
    return null
  }

  return (
    <ErrorBoundary portal="institution">
    <div className="flex min-h-screen flex-col bg-void">
      <PortalBg />
      {/* Header */}
      <header className="border-surface-border bg-void/80 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="text-muted hover:text-foreground lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <SafeLink href="/" className="flex items-center gap-2">
              <LogoMark className="h-5 w-5" />
              <span className="text-xs font-bold tracking-widest text-accent">VERIDAQ</span>
            </SafeLink>
            <nav className="hidden items-center gap-1 lg:flex">
              {baseNav.map(({ href, label }) => (
                <SafeLink
                  key={href}
                  href={href}
                   className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                     pathname === href
                       ? "bg-accent/10 text-accent"
                       : "text-muted hover:bg-surface hover:text-foreground"
                   }`}
                >
                  {label}
                </SafeLink>
              ))}
              {user?.alsoEmployer && (
                <>
                  <span className="text-muted mx-1 text-xs">|</span>
                  {employerNav.map(({ href, label }) => (
                    <SafeLink
                      key={href}
                      href={href}
                       className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                         pathname === href
                           ? "bg-accent/10 text-accent"
                           : "text-muted hover:bg-surface hover:text-foreground"
                       }`}
                     >
                       {label}
                     </SafeLink>
                   ))}
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                <Building2 className="h-3.5 w-3.5 text-accent" />
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-foreground">{user.name}</div>
                <div className="text-[10px] text-muted">{user.role}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted hover:text-error flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-error/5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="absolute left-4 right-4 top-16 z-30 lg:hidden">
            <div className="rounded-2xl border border-surface-border bg-surface-card/95 p-3 shadow-elevated backdrop-blur-xl">
              <div className="flex flex-col gap-1">
                {baseNav.map(({ href, label }) => (
                  <SafeLink
                    key={href}
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      pathname === href
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    {label}
                  </SafeLink>
                ))}
                {user?.alsoEmployer && (
                  <>
                    <div className="border-surface-border my-1 border-t" />
                    {employerNav.map(({ href, label }) => (
                      <SafeLink
                        key={href}
                        href={href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                          pathname === href
                            ? "bg-accent/10 text-accent"
                            : "text-muted hover:bg-surface hover:text-foreground"
                        }`}
                      >
                        {label}
                      </SafeLink>
                    ))}
                  </>
                )}
                <div className="border-surface-border my-1 border-t" />
                <button
                  onClick={() => {
                    setIsMenuOpen(false)
                    handleLogout()
                  }}
                  className="text-muted hover:text-error flex items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-error/5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Breadcrumb */}
      <div className="border-surface-border border-b bg-surface/30">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 text-xs text-muted md:px-6">
          <SafeLink href="/" className="hover:text-foreground transition-colors">Home</SafeLink>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Institution</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{title}</span>
        </div>
      </div>

      {/* Main */}
      <main className="pointer-events-auto mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
          <h1 className="mb-6 text-xl font-semibold text-foreground">{title}</h1>
          {children}
      </main>
    </div>
    </ErrorBoundary>
  )
}
