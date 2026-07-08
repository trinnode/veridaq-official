"use client"

import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"

interface GlobeProps {
  className?: string
  particleCount?: number
  baseRadius?: number
  globeColor?: string
  particleColor?: string
  glowColor?: string
  autoRotate?: boolean
  rotateSpeed?: number
}

type SceneHandle = {
  scene: unknown
  camera: unknown
  renderer: { dispose: () => void; domElement: HTMLElement }
  sphere: unknown
  particles: unknown
  arcs: unknown[]
  frameId: number
  rotation: number
  mouseX: number
  mouseY: number
}

export function Globe({
  className,
  particleCount = 600,
  baseRadius = 2,
  globeColor = "#1a1a2e",
  particleColor = "#cd32a5",
  glowColor = "#cd32a5",
  autoRotate = true,
  rotateSpeed = 0.003,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SceneHandle | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    let cancelled = false

    async function init() {
      const mod = await import("three")

      if (cancelled || !containerRef.current) return
      const container = containerRef.current

      const width = container.clientWidth
      const height = container.clientHeight

      const scene = new mod.Scene()

      const camera = new mod.PerspectiveCamera(45, width / height, 0.1, 100)
      camera.position.set(0, 1.5, 7)

      const renderer = new mod.WebGLRenderer({
        alpha: true,
        antialias: true,
      })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      container.appendChild(renderer.domElement)

      const globeMat = new mod.MeshBasicMaterial({
        color: globeColor,
        transparent: true,
        opacity: 0.4,
        wireframe: false,
      })
      const sphereGeo = new mod.SphereGeometry(baseRadius, 48, 48)
      const sphere = new mod.Mesh(sphereGeo, globeMat)
      scene.add(sphere)

      const wireframeMat = new mod.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: 0.08,
        wireframe: true,
      })
      const wireframeSphere = new mod.Mesh(
        new mod.SphereGeometry(baseRadius * 1.001, 24, 24),
        wireframeMat
      )
      scene.add(wireframeSphere)

      const positions = new Float32Array(particleCount * 3)
      const sizes = new Float32Array(particleCount)

      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = baseRadius * (1 + (Math.random() - 0.5) * 0.04)

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        positions[i * 3 + 2] = r * Math.cos(phi)
        sizes[i] = 0.5 + Math.random() * 1.5
      }

      const particleGeo = new mod.BufferGeometry()
      particleGeo.setAttribute("position", new mod.BufferAttribute(positions, 3))
      particleGeo.setAttribute("size", new mod.BufferAttribute(sizes, 1))

      const particleMat = new mod.PointsMaterial({
        color: particleColor,
        size: 0.025,
        transparent: true,
        opacity: 0.8,
        blending: mod.AdditiveBlending,
        sizeAttenuation: true,
      })
      const particles = new mod.Points(particleGeo, particleMat)
      scene.add(particles)

      const arcCount = 30
      const arcs: unknown[] = []
      const arcMat = new mod.LineBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.15,
        blending: mod.AdditiveBlending,
      })

      for (let i = 0; i < arcCount; i++) {
        const theta1 = Math.random() * Math.PI * 2
        const phi1 = Math.acos(2 * Math.random() - 1)
        const theta2 = Math.random() * Math.PI * 2
        const phi2 = Math.acos(2 * Math.random() - 1)

        const p1 = {
          x: baseRadius * Math.sin(phi1) * Math.cos(theta1),
          y: baseRadius * Math.sin(phi1) * Math.sin(theta1),
          z: baseRadius * Math.cos(phi1),
        }
        const p2 = {
          x: baseRadius * Math.sin(phi2) * Math.cos(theta2),
          y: baseRadius * Math.sin(phi2) * Math.sin(theta2),
          z: baseRadius * Math.cos(phi2),
        }

        const mid = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
          z: (p1.z + p2.z) / 2,
        }
        const bulge = 0.3 + Math.random() * 0.4
        const extension = {
          x: mid.x * (1 + bulge),
          y: mid.y * (1 + bulge),
          z: mid.z * (1 + bulge),
        }

        const segments = 40
        const arcPositions = new Float32Array((segments + 1) * 3)

        for (let j = 0; j <= segments; j++) {
          const t = j / segments
          const a = 1 - t
          const b = t
          const c = 4 * t * (1 - t)

          arcPositions[j * 3] = a * p1.x + b * p2.x + c * extension.x
          arcPositions[j * 3 + 1] = a * p1.y + b * p2.y + c * extension.y
          arcPositions[j * 3 + 2] = a * p1.z + b * p2.z + c * extension.z
        }

        const arcGeo2 = new mod.BufferGeometry()
        arcGeo2.setAttribute("position", new mod.BufferAttribute(arcPositions, 3))
        const line = new mod.Line(arcGeo2, arcMat)
        scene.add(line)
        arcs.push(line)
      }

      const glowMat = new mod.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.06,
        side: mod.BackSide,
      })
      const glowSphere = new mod.Mesh(
        new mod.SphereGeometry(baseRadius * 1.15, 32, 32),
        glowMat
      )
      scene.add(glowSphere)

      let rotation = 0
      let mouseX = 0
      let mouseY = 0

      const handleMouse = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        mouseX = x * 0.5
        mouseY = -y * 0.3
      }

      container.addEventListener("mousemove", handleMouse)

      function animate() {
        if (cancelled) return
        rotation += rotateSpeed

        const targetRotX = mouseY
        const targetRotY = rotation + mouseX

        sphere.rotation.x += (targetRotX - sphere.rotation.x) * 0.05
        sphere.rotation.y += (targetRotY - sphere.rotation.y) * 0.05
        particles.rotation.copy(sphere.rotation)
        wireframeSphere.rotation.copy(sphere.rotation)
        glowSphere.rotation.copy(sphere.rotation)

        ;(arcs as unknown as { rotation: { x: number; y: number }; material: { opacity: number } }[]).forEach((arc, i) => {
          arc.rotation.x = sphere.rotation.x
          arc.rotation.y = sphere.rotation.y
          arc.material.opacity = 0.1 + Math.sin(Date.now() * 0.001 + i) * 0.05
        })

        if (autoRotate) {
          const speed = Math.abs(mouseX) + Math.abs(mouseY)
          if (speed < 0.1) {
            sphere.rotation.y += rotateSpeed
            particles.rotation.y += rotateSpeed
            wireframeSphere.rotation.y += rotateSpeed
            glowSphere.rotation.y += rotateSpeed
            ;(arcs as unknown as { rotation: { y: number } }[]).forEach((arc) => {
              arc.rotation.y += rotateSpeed
            })
          }
        }

        renderer.render(scene, camera)
        sceneRef.current!.frameId = requestAnimationFrame(animate)
      }

      sceneRef.current = {
        scene,
        camera,
        renderer,
        sphere: sphere as never,
        particles: particles as never,
        arcs,
        frameId: 0,
        rotation,
        mouseX,
        mouseY,
      } as unknown as SceneHandle

      animate()

      const handleResize = () => {
        if (!container) return
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }

      window.addEventListener("resize", handleResize)

      return () => {
        window.removeEventListener("resize", handleResize)
        container.removeEventListener("mousemove", handleMouse)
      }
    }

    const cleanup = init()

    return () => {
      cancelled = true
      cleanup?.then((fn) => fn?.())
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.frameId)
        ;(sceneRef.current.renderer as unknown as { dispose: () => void }).dispose()
        if (containerRef.current?.contains(sceneRef.current.renderer.domElement)) {
          containerRef.current.removeChild(sceneRef.current.renderer.domElement)
        }
      }
    }
  }, [particleCount, baseRadius, globeColor, particleColor, glowColor, autoRotate, rotateSpeed])

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
    />
  )
}
