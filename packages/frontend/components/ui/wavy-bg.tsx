"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type WavyBgProps = {
  className?: string
  children?: React.ReactNode
}

type Line = {
  id: number
  y: number
  amplitude: number
  frequency: number
  phase: number
  opacity: number
}

export function WavyBg({ className, children }: WavyBgProps) {
  const lines = useMemo<Line[]>(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      y: 10 + i * 16,
      amplitude: 4 + Math.random() * 8,
      frequency: 0.8 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.04 + Math.random() * 0.06,
    }))
  }, [])

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <svg
        className="pointer-events-none absolute inset-0 -z-0 h-full w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="wavy-bg-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {lines.map((line) => (
          <motion.path
            key={line.id}
            fill="none"
            stroke="url(#wavy-bg-gradient)"
            strokeWidth="0.5"
            opacity={line.opacity}
            d={`M0,${line.y} Q25,${line.y - 4} 50,${line.y + 2} T100,${line.y}`}
            animate={{
              d: [
                `M-100,${line.y} Q-50,${line.y - line.amplitude} 0,${line.y + line.amplitude * 0.5} T100,${line.y - line.amplitude} T200,${line.y}`,
                `M-100,${line.y} Q-50,${line.y + line.amplitude} 0,${line.y - line.amplitude * 0.5} T100,${line.y + line.amplitude} T200,${line.y}`,
                `M-100,${line.y} Q-50,${line.y - line.amplitude} 0,${line.y + line.amplitude * 0.5} T100,${line.y - line.amplitude} T200,${line.y}`,
              ],
            }}
            transition={{
              duration: 6 + line.id,
              repeat: Infinity,
              ease: "easeInOut",
              delay: line.phase,
            }}
          />
        ))}
      </svg>
      {children}
    </div>
  )
}
