"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type SparklesProps = {
  sparkleCount?: number
  colors?: string[]
  className?: string
}

const defaultColors = [
  "var(--color-accent)",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
]

type Sparkle = {
  id: number
  x: number
  y: number
  size: number
  color: string
  delay: number
  duration: number
}

export function Sparkles({
  sparkleCount = 20,
  colors = defaultColors,
  className,
}: SparklesProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([])

  const generate = useMemo(
    () => () => {
      return Array.from({ length: sparkleCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 3,
      }))
    },
    [sparkleCount, colors]
  )

  useEffect(() => {
    setSparkles(generate())
  }, [generate])

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {sparkles.map((s) => (
        <motion.span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}
