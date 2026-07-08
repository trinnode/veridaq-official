"use client"

import { useCallback, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type CompareProps = {
  first: React.ReactNode
  second: React.ReactNode
  className?: string
  initialPos?: number
}

export function Compare({ first, second, className, initialPos = 50 }: CompareProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sliderPos, setSliderPos] = useState(initialPos)
  const [dragging, setDragging] = useState(false)

  const updatePosition = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      setSliderPos((x / rect.width) * 100)
    },
    []
  )

  const onMouseDown = () => setDragging(true)
  const onMouseUp = () => setDragging(false)
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) updatePosition(e.clientX)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) updatePosition(e.touches[0].clientX)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none overflow-hidden rounded-lg",
        "bg-surface-card border border-surface-border",
        className
      )}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
      role="slider"
      tabIndex={0}
    >
      <div className="w-full">{first}</div>
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        {second}
      </div>
      <div
        className="absolute inset-y-0 z-10 w-[3px] cursor-ew-resize"
        style={{ left: `${sliderPos}%`, translate: "-50% 0" }}
      >
        <div className="bg-accent absolute inset-0 rounded-full shadow-lg shadow-accent/30" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-void border-accent flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-lg">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="text-accent"
            >
              <path
                d="M4 2L8 6L4 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 2L4 6L8 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
