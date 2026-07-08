"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useState } from "react"

type FocusCardProps = {
  title: string
  description: string
  icon?: React.ReactNode
  className?: string
  index: number
}

export function FocusCard({ title, description, icon, className, index }: FocusCardProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const isHovered = hovered === index

  return (
    <motion.div
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "border-surface-border bg-surface-card relative rounded-xl border p-6 transition-all duration-300",
        isHovered
          ? "border-accent/30 shadow-glow-sm scale-[1.02] z-10"
          : hovered !== null
            ? "opacity-40 blur-[1px] scale-[0.98]"
            : "opacity-100",
        className
      )}
    >
      {icon && <div className="text-accent mb-4">{icon}</div>}
      <h3 className="font-display mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </motion.div>
  )
}

type FocusCardsGridProps = {
  items: { title: string; description: string; icon?: React.ReactNode }[]
  className?: string
}

export function FocusCardsGrid({ items, className }: FocusCardsGridProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, i) => (
        <FocusCard key={i} {...item} index={i} />
      ))}
    </div>
  )
}
