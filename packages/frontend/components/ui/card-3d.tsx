"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"
import { useRef } from "react"

type Card3DProps = {
  children: React.ReactNode
  className?: string
  maxRotX?: number
  maxRotY?: number
  glare?: boolean
  scale?: number
}

export function Card3D({
  children,
  className,
  maxRotX: mx = 12,
  maxRotY: my = 12,
  glare = true,
  scale = 1.02,
}: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const smoothX = useSpring(mouseX, { stiffness: 150, damping: 15 })
  const smoothY = useSpring(mouseY, { stiffness: 150, damping: 15 })

  const rotateX = useTransform(smoothY, [0, 1], [mx, -mx])
  const rotateY = useTransform(smoothX, [0, 1], [-my, my])

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  function handleMouseLeave() {
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

  const isActive = useTransform(() => mouseX.get() !== 0.5 || mouseY.get() !== 0.5)

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: "preserve-3d",
        rotateX,
        rotateY,
        scale: useTransform(() => (isActive.get() ? scale : 1)),
      }}
      className={cn("relative cursor-default perspective-[1000px]", className)}
    >
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 60%)",
          }}
        />
      )}
      <div className="relative z-0" style={{ transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </motion.div>
  )
}
