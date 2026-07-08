"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type GeminiEffectProps = {
  className?: string
  children?: React.ReactNode
}

type Path = {
  id: number
  d: string
  x: number
  y: number
  width: number
  height: number
}

const paths: Omit<Path, "id">[] = [
  { d: "M0 50 Q25 0 50 50 Q75 100 100 50", x: 0, y: 0, width: 100, height: 100 },
  { d: "M0 0 Q50 100 100 0", x: 0, y: 0, width: 100, height: 100 },
  { d: "M50 0 Q0 50 50 100 Q100 50 50 0", x: 0, y: 0, width: 100, height: 100 },
  { d: "M0 100 Q25 0 50 100 Q75 0 100 100", x: 0, y: 0, width: 100, height: 100 },
  { d: "M0 0 C50 100 50 0 100 100", x: 0, y: 0, width: 100, height: 100 },
  { d: "M0 50 C30 0 70 100 100 50", x: 0, y: 0, width: 100, height: 100 },
]

export function GeminiEffect({ className, children }: GeminiEffectProps) {
  const [svgPaths, setSvgPaths] = useState<Path[]>([])

  useEffect(() => {
    setSvgPaths(
      Array.from({ length: 6 }, (_, i) => {
        const p = paths[i % paths.length]!
        return { id: i, d: p.d, x: p.x, y: p.y, width: p.width, height: p.height }
      })
    )
  }, [])

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
        {svgPaths.map((path) => (
          <motion.svg
            key={path.id}
            className="absolute"
            style={{
              left: `${10 + (path.id * 17) % 80}%`,
              top: `${15 + (path.id * 13) % 70}%`,
              width: `${60 + path.id * 20}px`,
              height: `${60 + path.id * 20}px`,
            }}
            viewBox="0 0 100 100"
            fill="none"
            initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
            animate={{
              opacity: [0.08, 0.25, 0.08],
              scale: [0.6, 1, 0.6],
              rotate: [-30, 30, -30],
              x: [0, 15, -10, 0],
              y: [0, -10, 15, 0],
            }}
            transition={{
              duration: 12 + path.id * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: path.id * 0.8,
            }}
          >
            <motion.path
              d={path.d}
              stroke="var(--color-accent)"
              strokeWidth="1"
              strokeLinecap="round"
              opacity={0.3}
            />
            <motion.path
              d={path.d}
              stroke="var(--color-accent)"
              strokeWidth="0.5"
              strokeLinecap="round"
              opacity={0.15}
              style={{ translate: "2px 2px" }}
            />
          </motion.svg>
        ))}
      </div>
      {children}
    </div>
  )
}
