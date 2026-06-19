"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "@/lib/icons"
import { useEffect, useState } from "react"

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${className}`}
        disabled
      >
        <div className="h-3.5 w-3.5" />
      </button>
    )
  }

  const cycle = () => {
    if (theme === "dark") setTheme("light")
    else if (theme === "light") setTheme("system")
    else setTheme("dark")
  }

  return (
    <button
      onClick={cycle}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 ${className}`}
      style={{
        backgroundColor: "var(--color-surface-card)",
        border: "1px solid var(--color-surface-border)",
        color: "var(--color-muted)",
      }}
      title={`Current theme: ${theme}. Click to cycle.`}
      aria-label={`Switch theme (currently ${theme})`}
    >
      {theme === "dark" && <Moon className="h-3.5 w-3.5" />}
      {theme === "light" && <Sun className="h-3.5 w-3.5" />}
      {theme === "system" && <Monitor className="h-3.5 w-3.5" />}
    </button>
  )
}
