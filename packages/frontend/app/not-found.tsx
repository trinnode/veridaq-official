"use client"

import { Hexagon, Home, AlertTriangle } from "@/lib/icons"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="bg-void relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-grid-pattern bg-grid absolute inset-0 opacity-20" />
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-accent/3 blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-info/2 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-lg px-4 text-center">
        <div className="mb-2 flex justify-center">
          <div className="animate-glow-pulse bg-accent/10 mb-6 inline-flex rounded-2xl p-4">
            <Hexagon className="text-accent h-8 w-8" />
          </div>
        </div>

        <div className="mb-4 flex items-baseline justify-center gap-2">
          <span className="bg-gradient-to-r from-accent via-accent to-accent/60 bg-clip-text font-display text-[120px] font-black leading-none text-transparent md:text-[160px]">
            404
          </span>
        </div>

        <div className="mb-2 flex items-center justify-center gap-2 text-foreground">
          <AlertTriangle className="text-warning h-5 w-5" />
          <h1 className="font-display text-xl font-bold md:text-2xl">
            Oops! Page not found
          </h1>
        </div>

        <p className="text-muted mx-auto mb-8 max-w-md text-sm leading-relaxed md:text-base">
          The page you are looking for does not exist, has been moved, or is
          currently lost in the void. If you believe this is a mistake, please
          contact support.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="bg-accent text-void hover:bg-accent-dim inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all duration-150 active:scale-95"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="mailto:support@veridaq.xyz"
            className="text-muted hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors duration-150"
          >
            Contact Support
          </Link>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 -z-5 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="animate-float absolute border"
            style={{
              left: `${15 + i * 14}%`,
              top: `${20 + ((i * 17) % 60)}%`,
              width: 28 + i * 12,
              height: 28 + i * 12,
              borderColor: `rgb(var(--color-accent) / ${0.04 + i * 0.01})`,
              borderRadius: i % 3 === 0 ? "50%" : "0%",
              transform: i % 2 === 0 ? "rotate(45deg)" : "none",
              animationDelay: `${i * 1.5}s`,
              animationDuration: `${8 + i * 2}s`,
            }}
          />
        ))}
      </div>

      <div className="text-muted-subtle absolute bottom-6 text-center text-xs">
        &copy; {new Date().getFullYear()} VERIDAQ. All rights reserved.
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
          25% { transform: translateY(-20px) rotate(90deg); opacity: 0.6; }
          50% { transform: translateY(-10px) rotate(180deg); opacity: 0.4; }
          75% { transform: translateY(-30px) rotate(270deg); opacity: 0.7; }
        }
        .animate-float {
          animation: float var(--duration, 10s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
      `}</style>
    </div>
  )
}
