"use client"

import { LogoMark } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { BackgroundLines } from "@/components/ui/background-lines"
import { Globe } from "@/components/ui/globe"
import { SafeLink as Link } from "@/components/safe-link"

type AuthSplitProps = {
  children: React.ReactNode
  role: "institution" | "employer" | "admin"
  title: string
  subtitle: string
  mode: "login" | "register"
}

const roleConfig = {
  institution: {
    icon: "🏛️",
    brand: "Institution Portal",
    tagline: "Manage credential batches, claims, and verifications for your institution.",
  },
  employer: {
    icon: "💼",
    brand: "Employer Portal",
    tagline: "Verify academic credentials instantly with zero knowledge proofs.",
  },
  admin: {
    icon: "⚙️",
    brand: "Admin Portal",
    tagline: "Manage institutions, verify requests, and monitor platform operations.",
  },
}

export function AuthSplit({ children, role, title, subtitle, mode }: AuthSplitProps) {
  const cfg = roleConfig[role]

  return (
    <div className="relative flex min-h-dvh bg-void">
      <BackgroundLines lineCount={14} opacity={0.03} />

      {/* Left Panel — Brand */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center p-8 lg:flex">
        <Globe
          particleCount={400}
          baseRadius={1.8}
          globeColor="#0a0a0f"
          particleColor="#cd32a5"
          glowColor="#cd32a5"
          className="opacity-30"
        />
        <div className="flex flex-col items-center text-center relative z-10">
          <Link href="/" className="mb-10 flex items-center gap-3">
            <LogoMark className="h-8 w-8 rounded-md" />
            <span className="text-sm font-bold tracking-widest text-foreground">VERIDAQ</span>
          </Link>
          <div className="mb-4 text-5xl">{cfg.icon}</div>
          <h1 className="font-display mb-4 text-4xl font-bold leading-tight text-foreground">
            {cfg.brand}
          </h1>
          <p className="text-muted max-w-sm text-base leading-relaxed">{cfg.tagline}</p>
          <div className="mt-16 text-[11px] text-muted/60">
            &copy; {new Date().getFullYear()} VERIDAQ. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex w-full flex-col lg:w-1/2">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 lg:px-8 lg:pt-6">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <LogoMark className="h-7 w-7 rounded-md" />
            <span className="text-xs font-bold tracking-widest">VERIDAQ</span>
          </Link>
          <div className="flex items-center gap-3 ml-auto">
            {mode === "login" ? (
              <Link
                href={`/${role}/register`}
                className="border-surface-border text-muted hover:text-foreground rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
              >
                Create Account
              </Link>
            ) : (
              <Link
                href={`/${role}/login`}
                className="border-surface-border text-muted hover:text-foreground rounded-lg border px-4 py-2 text-xs font-medium transition-colors"
              >
                Sign In
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="font-display mb-2 text-3xl font-bold text-foreground">{title}</h2>
              <p className="text-muted/80 text-sm">{subtitle}</p>
            </div>

            {/* Social Login — Coming Soon */}
            <div className="mb-6">
              <button
                disabled
                className="border-surface-border text-muted/40 flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
                <span className="text-muted-subtle ml-auto text-[10px]">Coming soon</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="border-surface-border w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-void text-muted px-3">{mode === "login" ? "or sign in with email" : "or register with email"}</span>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
