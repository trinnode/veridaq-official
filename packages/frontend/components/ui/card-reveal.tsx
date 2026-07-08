"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useState } from "react"

type CardRevealProps = {
  children: React.ReactNode
  revealContent?: React.ReactNode
  className?: string
  direction?: "up" | "down"
}

export function CardReveal({
  children,
  revealContent,
  className,
  direction = "up",
}: CardRevealProps) {
  const [isHovered, setIsHovered] = useState(false)
  const fromY = direction === "up" ? 16 : -16

  return (
    <div
      className={cn("group relative overflow-hidden", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {revealContent && (
        <motion.div
          className="absolute inset-x-0 bottom-0 flex items-end p-4"
          animate={isHovered ? { y: 0, opacity: 1 } : { y: fromY, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {revealContent}
        </motion.div>
      )}
    </div>
  )
}
