"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

type BackgroundLinesProps = {
  className?: string
  lineCount?: number
  color?: string
  opacity?: number
}

export function BackgroundLines({
  className,
  lineCount = 12,
  color = "rgb(var(--color-accent))",
  opacity = 0.03,
}: BackgroundLinesProps) {
  const lines = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => ({
      id: i,
      x1: `${(i / lineCount) * 100}%`,
      y1: "0%",
      x2: `${((i + 3) / lineCount) * 100}%`,
      y2: "100%",
      delay: i * 0.15,
      duration: 3 + Math.random() * 2,
    }))
  }, [lineCount])

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((line) => (
          <motion.line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={color}
            strokeWidth="0.3"
            strokeDasharray="0.5 2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: [0, 1, 0],
              opacity: [0, opacity, 0],
            }}
            transition={{
              duration: line.duration,
              delay: line.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
    </div>
  )
}
