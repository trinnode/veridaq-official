"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type GradientTextProps = {
  children: React.ReactNode
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "p"
  className?: string
  colors?: string[]
}

const defaultColors = [
  "rgb(var(--color-accent))",
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "rgb(var(--color-accent))",
]

export function GradientText({
  children,
  as: Tag = "span",
  className,
  colors = defaultColors,
}: GradientTextProps) {
  const gradient = `linear-gradient(135deg, ${colors.join(", ")})`

  return (
    <Tag className={cn("relative inline-block", className)}>
      <motion.span
        className="bg-clip-text text-transparent"
        style={{
          backgroundImage: gradient,
          backgroundSize: "400% 400%",
        }}
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
      >
        {children}
      </motion.span>
    </Tag>
  )
}
