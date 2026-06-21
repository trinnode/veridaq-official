"use client"
import { OrbitalLoader } from "@/components/ui/orbital-loader"
import { useAuth } from "@/lib/auth"
import { LogOut, Menu, X, ChevronRight, Shield } from "@/lib/icons"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { LogoMark } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { PortalBg } from "@/components/parallax/floating-shapes"

const nav = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/institutions", label: "Institutions" },
  { href: "/admin/employers", label: "Employers" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/earnings", label: "Earnings" },
  { href: "/admin/audit", label: "Audit Log" },
]

/** Navigate using window.location so we don't depend on the Next.js router. */
function NavLink({ href, className, children, onClick: extraOnClick }: { href: string; className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <a href={href} className={className} onClick={(e) => { e.preventDefault(); extraOnClick?.(); window.location.href = href }}>
      {children}
    </a>
  )
}

export function AdminLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { logout, user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/login")
    }
  }, [loading, user, router])

  function handleLogout() {
    logout().catch(() => {})
    window.location.href = "/admin/login"
  }

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
    router.push("/admin/login")
    return null
  }

  return (
    <div className="flex min-h-screen flex-col bg-void">
      <PortalBg />
      <header className="border-surface-border bg-void/80 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="text-muted hover:text-foreground lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <NavLink href="/" className="flex items-center gap-2">
              <LogoMark className="h-5 w-5" />
              <span className="text-xs font-bold tracking-widest text-accent">VERIDAQ</span>
            </NavLink>
            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map(({ href, label }) => (
                <NavLink
                  key={href}
                  href={href}
                   className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                     pathname === href
                       ? "bg-accent/10 text-accent"
                       : "text-muted hover:bg-surface hover:text-foreground"
                   }`}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
                <Shield className="h-3.5 w-3.5 text-warning" />
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-foreground">{user.name}</div>
                <div className="text-[10px] text-muted">Administrator</div>
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

        {isMenuOpen && (
          <div className="absolute left-4 right-4 top-16 z-30 lg:hidden">
            <div className="rounded-2xl border border-surface-border bg-surface-card/95 p-3 shadow-elevated backdrop-blur-xl">
              <div className="flex flex-col gap-1">
                {nav.map(({ href, label }) => (
                  <NavLink
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
                  </NavLink>
                ))}
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

      <div className="border-surface-border border-b bg-surface/30">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 text-xs text-muted md:px-6">
          <NavLink href="/" className="hover:text-foreground transition-colors">Home</NavLink>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{title}</span>
        </div>
      </div>

      <main className="pointer-events-auto mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
          <h1 className="mb-6 font-display text-xl font-semibold tracking-wide text-foreground">{title}</h1>
          {children}
      </main>
    </div>
  )
}
