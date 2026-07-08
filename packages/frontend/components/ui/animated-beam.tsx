"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type AnimatedBeamProps = {
  className?: string
}

export function AnimatedBeam({ className }: AnimatedBeamProps) {
  const pathId = useMemo(() => `beam-path-${Math.random().toString(36).slice(2)}`, [])
  const gradientId = useMemo(() => `beam-gradient-${Math.random().toString(36).slice(2)}`, [])

  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 -z-0 h-full w-full",
        className
      )}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <motion.path
        id={pathId}
        d="M0,50 Q25,20 50,50 T100,50 T150,50 T200,50"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: [0, 1, 0],
          opacity: [0, 0.6, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.circle
        r="2"
        fill="var(--color-accent)"
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0, 1, 0],
          offsetDistance: ["0%", "100%"],
          offsetPath: `path("M0,50 Q25,20 50,50 T100,50 T150,50 T200,50")`,
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </svg>
  )
}
