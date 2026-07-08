"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type CardLiftProps = {
  children: React.ReactNode
  className?: string
  liftY?: number
}

export function CardLift({
  children,
  className,
  liftY = -6,
}: CardLiftProps) {
  return (
    <motion.div
      className={cn("relative", className)}
      whileHover={{ y: liftY }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
