"use client"

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type TextHoverEffectProps = {
  children: string
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "p"
  className?: string
}

export function TextHoverEffect({
  children,
  as: Tag = "span",
  className,
}: TextHoverEffectProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const words = children.split(" ")

  return (
    <Tag ref={ref} className={cn("inline", className)}>
      {words.map((word, i) => {
        const isHovered = hoveredIndex === i
        return (
          <motion.span
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="relative inline-block cursor-default px-[2px]"
          >
            <span className="text-foreground">{word}</span>
            <motion.span
              className="absolute inset-0 bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #34d399, #60a5fa, #a78bfa, #34d399)",
                backgroundSize: "200% 200%",
              }}
              initial={{ opacity: 0, y: 4 }}
              animate={
                isHovered
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 4 }
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
              aria-hidden
            >
              {word}
            </motion.span>
            {i < words.length - 1 && <span className="text-foreground">{" "}</span>}
          </motion.span>
        )
      })}
    </Tag>
  )
}
