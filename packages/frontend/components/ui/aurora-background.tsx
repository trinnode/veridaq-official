"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type AuroraBackgroundProps = {
  className?: string
  children?: React.ReactNode
}

type Orb = {
  id: number
  x: number
  y: number
  width: number
  height: number
  color: string
  xMove: number[]
  yMove: number[]
  duration: number
  delay: number
}

const orbColors = [
  "rgb(var(--color-accent))",
  "#60a5fa",
  "#a78bfa",
  "#34d399",
  "#f472b6",
]

export function AuroraBackground({ className, children }: AuroraBackgroundProps) {
  const [orbs, setOrbs] = useState<Orb[]>([])

  useEffect(() => {
    setOrbs(
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 80,
        width: 200 + Math.random() * 400,
        height: 200 + Math.random() * 400,
        color: orbColors[i % orbColors.length]!,
        xMove: [0, 30, -20, 10, 0],
        yMove: [0, -30, 20, -10, 0],
        duration: 15 + Math.random() * 10,
        delay: i * 2,
      }))
    )
  }, [])

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
        <div className="absolute inset-0 bg-void" />
        {orbs.map((orb) => (
          <motion.div
            key={orb.id}
            className="absolute rounded-full"
            style={{
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: orb.width,
              height: orb.height,
              background: `radial-gradient(circle at 50% 50%, ${orb.color} 0%, transparent 70%)`,
              opacity: 0.12,
            }}
            animate={{
              x: orb.xMove,
              y: orb.yMove,
              scale: [1, 1.2, 0.9, 1.1, 1],
              opacity: [0.08, 0.18, 0.06, 0.15, 0.08],
            }}
            transition={{
              duration: orb.duration,
              delay: orb.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {children}
    </div>
  )
}
