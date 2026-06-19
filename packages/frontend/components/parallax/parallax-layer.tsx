"use client"

import { useScroll, useTransform, motion, type MotionValue } from "framer-motion"

export function ParallaxBg({
  className,
  opacity = 0.5,
}: {
  className?: string
  opacity?: number
}) {
  const { scrollYProgress } = useScroll()
  const bgY: MotionValue<number> = useTransform(scrollYProgress, [0, 1], [0, -200])
  const midY: MotionValue<number> = useTransform(scrollYProgress, [0, 1], [0, -100])
  const fgY: MotionValue<number> = useTransform(scrollYProgress, [0, 1], [0, -40])

  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className ?? ""}`} style={{ opacity }}>
      {/* Layer 1 — deep space gradient mesh */}
      <motion.div className="absolute inset-0" style={{ y: bgY }}>
        <div className="bg-void absolute inset-0" />
        <div className="absolute left-1/4 top-[10%] h-[700px] w-[700px] rounded-full bg-accent/6 blur-[180px]" />
        <div className="absolute right-1/4 bottom-[10%] h-[600px] w-[600px] rounded-full bg-info/5 blur-[160px]" />
        <div className="absolute left-[60%] top-[50%] h-[500px] w-[500px] rounded-full bg-error/5 blur-[140px]" />
        <div className="absolute left-[5%] bottom-[30%] h-[400px] w-[400px] rounded-full bg-accent-dim/4 blur-[120px]" />
        <div className="absolute right-[30%] top-[5%] h-[350px] w-[350px] rounded-full bg-warning/4 blur-[100px]" />
      </motion.div>

      {/* Layer 2 — midground orbs */}
      <motion.div className="absolute inset-0" style={{ y: midY }}>
        <div className="absolute left-[15%] top-[25%] h-[250px] w-[250px] rounded-full bg-accent/4 blur-[90px]" />
        <div className="absolute right-[20%] top-[55%] h-[300px] w-[300px] rounded-full bg-info/4 blur-[100px]" />
        <div className="absolute left-[45%] bottom-[15%] h-[200px] w-[200px] rounded-full bg-error/4 blur-[80px]" />
        <div className="absolute right-[40%] top-[35%] h-[180px] w-[180px] rounded-full bg-accent-dim/5 blur-[70px]" />
      </motion.div>

      {/* Layer 3 — foreground grid + subtle glow */}
      <motion.div className="absolute inset-0" style={{ y: fgY }}>
        <div className="bg-grid-pattern bg-grid absolute inset-0 opacity-[0.15]" />
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-accent/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-info/[0.04] blur-[100px]" />
        {/* Vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-void/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-void/20 via-transparent to-void/20" />
      </motion.div>
    </div>
  )
}


