"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type ColourfulTextProps = {
  text: string
  colors?: string[]
  className?: string
}

const defaultColors = [
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#fb923c",
  "#f87171",
]

export function ColourfulText({
  text,
  colors = defaultColors,
  className,
}: ColourfulTextProps) {
  const words = text.split(" ")

  return (
    <span className={cn("inline flex-wrap", className)}>
      {words.map((word, i) => {
        const color = colors[i % colors.length]
        return (
          <motion.span
            key={i}
            className="inline-block"
            style={{ color }}
initial={{ opacity: 1, scale: 0.95, filter: "blur(0px)" }}
whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{
              delay: i * 0.08,
              duration: 0.5,
              ease: "easeOut",
            }}
          >
            {word}
            {i < words.length - 1 && "\u00A0"}
          </motion.span>
        )
      })}
    </span>
  )
}
