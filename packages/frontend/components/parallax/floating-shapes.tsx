"use client"

import { useEffect, useState } from "react"

interface Shape {
  id: number
  type: "circle" | "hex" | "triangle" | "diamond" | "ring"
  size: number
  x: number
  y: number
  duration: number
  delay: number
  color: string
  initialOpacity: number
  rotation: number
}

function generateShapes(count: number): Shape[] {
  const types: Shape["type"][] = ["circle", "hex", "triangle", "diamond", "ring"]
  const colors = ["accent", "info", "error", "accent-dim", "warning"]
  const shapes: Shape[] = []
  for (let i = 0; i < count; i++) {
    shapes.push({
      id: i,
      type: types[i % types.length]!,
      size: 16 + Math.random() * 48,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 8 + Math.random() * 14,
      delay: Math.random() * -12,
      color: colors[i % colors.length]!,
      initialOpacity: 0.04 + Math.random() * 0.06,
      rotation: Math.random() * 360,
    })
  }
  return shapes
}

export function FloatingShapes({ count = 18 }: { count?: number }) {
  const [shapes, setShapes] = useState<Shape[]>([])

  useEffect(() => {
    setShapes(generateShapes(count))
  }, [count])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {shapes.map((shape) => (
        <div
          key={shape.id}
          className="animate-float-shape absolute"
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
            width: shape.size,
            height: shape.size,
            opacity: shape.initialOpacity,
            animationDuration: `${shape.duration}s`,
            animationDelay: `${shape.delay}s`,
            transform: `rotate(${shape.rotation}deg)`,
          }}
        >
          {shape.type === "circle" && (
            <div
              className="h-full w-full rounded-full"
              style={{
                border: `1px solid rgb(var(--color-${shape.color}) / 0.2)`,
                background: `radial-gradient(circle, rgb(var(--color-${shape.color}) / 0.08), transparent)`,
              }}
            />
          )}
          {shape.type === "ring" && (
            <div
              className="h-full w-full rounded-full"
              style={{
                border: `1.5px solid rgb(var(--color-${shape.color}) / 0.15)`,
                background: "transparent",
              }}
            />
          )}
          {shape.type === "hex" && (
            <div
              className="h-full w-full"
              style={{
                background: `rgb(var(--color-${shape.color}) / 0.07)`,
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}
            />
          )}
          {shape.type === "triangle" && (
            <div
              className="h-full w-full"
              style={{
                background: `rgb(var(--color-${shape.color}) / 0.07)`,
                clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
              }}
            />
          )}
          {shape.type === "diamond" && (
            <div
              className="h-full w-full"
              style={{
                border: `1px solid rgb(var(--color-${shape.color}) / 0.15)`,
                transform: "rotate(45deg)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function PortalBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-void absolute inset-0" />
      <div className="absolute -left-[10%] top-[10%] h-[500px] w-[500px] rounded-full bg-accent/5 blur-[150px]" />
      <div className="absolute -right-[10%] bottom-[20%] h-[450px] w-[450px] rounded-full bg-info/4 blur-[130px]" />
      <div className="absolute left-[30%] bottom-[10%] h-[300px] w-[300px] rounded-full bg-accent-dim/4 blur-[100px]" />
      <div className="absolute right-[40%] top-[40%] h-[200px] w-[200px] rounded-full bg-error/4 blur-[80px]" />
      <div className="bg-grid-pattern bg-grid absolute inset-0 opacity-[0.12]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-void/30" />
    </div>
  )
}
