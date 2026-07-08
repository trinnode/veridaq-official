"use client"

import { cn } from "@/lib/utils"
import { useRef, useState } from "react"

type CardSpotlightProps = {
  children: React.ReactNode
  className?: string
  radius?: number
  color?: string
}

export function CardSpotlight({
  children,
  className,
  radius = 350,
  color = "rgb(var(--color-accent) / 0.15)",
}: CardSpotlightProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn("group relative overflow-hidden", className)}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${radius}px circle at ${mousePos.x}px ${mousePos.y}px, ${color}, transparent 80%)`,
        }}
      />
      {children}
    </div>
  )
}
