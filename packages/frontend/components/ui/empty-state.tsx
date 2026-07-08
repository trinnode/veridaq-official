"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        "bg-surface-card border border-surface-border rounded-xl",
        className
      )}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.div
        className="text-muted flex h-16 w-16 items-center justify-center rounded-full bg-white/5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
      >
        {icon}
      </motion.div>
      <div className="max-w-xs space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-muted text-sm leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  )
}
