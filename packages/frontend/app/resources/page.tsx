"use client"
import { BookOpen, ChevronRight, CodeSquare, Database, Github, Layers } from "lucide-react"
import Link from "next/link"
import { AppHeader } from "@/components/ui/app-header"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { FloatingShapes } from "@/components/parallax/floating-shapes"
import { ScrollReveal } from "@/components/parallax/scroll-reveal"

export default function TechnicalResourcesPage() {
  const stacks = [
    {
      category: "Blockchain Layer",
      tech: "Base Sepolia (OP Stack)",
      desc: "EVM-equivalent L2 by Coinbase. Low gas costs, fast finality, and native BN254 precompiles for efficient proof verification.",
    },
    {
      category: "Smart Contracts",
      tech: "Solidity 0.8.28 + Foundry",
      desc: "Six contracts: InstitutionRegistry, CredentialRegistry, RevocationRegistry, SubscriptionManager, PaymasterVault, Groth16Verifier. Fuzz-tested via Foundry.",
    },
    {
      category: "ZKP Compilation",
      tech: "Circom 2.0.8 + SnarkJS",
      desc: "Groth16 proof system. Circuit compiles to R1CS with ~45,000 constraints. Proof generation takes ~0.7 seconds on a modern CPU.",
    },
    {
      category: "Backend Engine",
      tech: "Fastify 5 + Node.js 22",
      desc: "TypeScript API server with Zod validation, Prisma 6 ORM, BullMQ queue workers, and viem 2 for blockchain interaction.",
    },
  ]

  return (
    <div className="min-h-screen bg-void pb-16">
      <AppHeader />
      <ParallaxBg opacity={0.25} />
      <FloatingShapes count={10} />
      <div className="container mx-auto max-w-5xl px-4 md:px-6 pt-24">
        <div className="mb-8 flex items-center gap-2 font-mono text-sm text-muted-subtle">
          <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-accent uppercase">Technical Resources</span>
        </div>

        <h1 className="mb-6 text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">
          Technical Resources
        </h1>

        <p className="border-surface-border mb-12 max-w-2xl border-b pb-6 font-mono text-sm text-muted-subtle">
          Open-core architecture. Source code, whitepapers, protocol specs, and network scanners.
        </p>

        <ScrollReveal direction="up" delay={0}>
          <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Link
              href="/blueprint"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <Layers className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 font-bold text-foreground transition-colors">
                  Protocol Blueprint
                </h3>
                <p className="text-sm text-muted">
                  Full architectural reference — smart contracts, circuits, API topology, proof lifecycle, and security model.
                </p>
              </div>
            </Link>

            <Link
              href="/docs"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <BookOpen className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 font-bold text-foreground transition-colors">
                  Official Documentation
                </h3>
                <p className="text-sm text-muted">
                  Step-by-step setup guides, protocol outlines, API routes, and deployment instructions.
                </p>
              </div>
            </Link>

            <Link
              href="/zkp"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <Layers className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 font-bold text-foreground transition-colors">
                  ZKP Circom Definitions
                </h3>
                <p className="text-sm text-muted">
                  Deep-dive into the cryptographic commitments, Groth16 proof logic, private vs public signals, and nullifiers.
                </p>
              </div>
            </Link>

            <a
              href="#"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex cursor-not-allowed items-start gap-4 rounded-lg border p-6 opacity-70 transition-colors"
            >
              <div className="bg-void border-surface-border rounded border p-3">
                <Github className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="mb-1 flex items-center gap-2 font-bold text-foreground">
                  GitHub Contracts Repo{" "}
                  <span className="bg-surface-border rounded px-2 py-0.5 font-mono text-[10px] text-foreground">COMING SOON</span>
                </h3>
                <p className="text-sm text-muted">
                  Foundry-based Solidity repository covering subscriptions, credential registries, and the Paymaster vault.
                </p>
              </div>
            </a>

            <a
              href="https://sepolia.basescan.org/"
              target="_blank"
              rel="noreferrer"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <Database className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 flex items-center gap-2 font-bold text-foreground transition-colors">
                  Base Sepolia Scanner{" "}
                  <span className="bg-surface-border rounded px-2 py-0.5 font-mono text-[10px] text-foreground">EXTERNAL</span>
                </h3>
                <p className="text-sm text-muted">
                  Browse live verification transactions and contract interactions on the Base Sepolia testnet.
                </p>
              </div>
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <h2 className="border-surface-border mb-6 border-t pt-12 text-2xl font-bold uppercase tracking-widest text-foreground">
            Protocol Stack Architecture
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {stacks.map((stack, i) => (
              <div key={i} className="border-surface-border rounded border bg-surface-card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <CodeSquare className="text-accent h-4 w-4" />
                  <span className="font-mono text-xs text-muted-subtle">{stack.category}</span>
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{stack.tech}</h3>
                <p className="text-sm leading-relaxed text-muted">{stack.desc}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </div>
  )
}
