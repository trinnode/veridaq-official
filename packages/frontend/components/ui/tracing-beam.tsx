"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

type TracingBeamProps = {
  children: React.ReactNode
  className?: string
}

export function TracingBeam({ children, className }: TracingBeamProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [lineHeight, setLineHeight] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  })

  useEffect(() => {
    const updateHeight = () => {
      if (contentRef.current) {
        setLineHeight(contentRef.current.scrollHeight)
      }
    }
    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])

  const height = useTransform(scrollYProgress, [0, 1], [0, lineHeight])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="absolute left-0 top-0 z-10 flex flex-col items-center">
        <motion.div
          className="w-[2px]"
          style={{
            height,
            background:
              "linear-gradient(180deg, transparent, var(--color-accent), transparent)",
          }}
        />
        <motion.div
          className="-mt-1 h-3 w-3 rounded-full"
          style={{
            backgroundColor: "var(--color-accent)",
            boxShadow: "0 0 12px var(--color-accent)",
            opacity: useTransform(scrollYProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0]),
          }}
        />
      </div>
      <div ref={contentRef} className="pl-8">
        {children}
      </div>
    </div>
  )
}
