"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { LogoMark } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Menu, X } from "@/lib/icons"

export function AppHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    { href: "/", label: "Home" },
    { href: "/resources", label: "Resources" },
    { href: "/blueprint", label: "Blueprint" },
    { href: "/docs", label: "Docs" },
  ]

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 flex justify-center pt-3 sm:pt-4">
      <div
        className={`flex items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur-2xl transition-all duration-500 sm:px-3 sm:py-2 ${
          scrolled
            ? "border-surface-border bg-void/70 shadow-elevated"
            : "border-transparent bg-void/20"
        }`}
      >
        <Link href="/" className="flex items-center gap-2 pl-1 pr-3">
          <LogoMark className="h-6 w-6 rounded-md" />
          <span className="hidden text-xs font-bold tracking-widest sm:inline">
            VERIDAQ
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 sm:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted transition-all duration-200 hover:bg-surface-card hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 pl-1">
          <ThemeToggle />
          <button
            className="text-muted hover:text-foreground sm:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute left-4 right-4 top-16 rounded-2xl border border-surface-border bg-surface-card/95 p-3 shadow-elevated backdrop-blur-xl sm:hidden">
          <div className="flex flex-col gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
