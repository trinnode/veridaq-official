"use client"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { AppHeader } from "@/components/ui/app-header"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { FloatingShapes } from "@/components/parallax/floating-shapes"
import { ScrollReveal } from "@/components/parallax/scroll-reveal"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-void pb-16">
      <AppHeader />
      <ParallaxBg opacity={0.25} />
      <FloatingShapes count={10} />
      <div className="container mx-auto max-w-4xl px-4 md:px-6 pt-24">
        <div className="mb-8 flex items-center gap-2 font-mono text-sm text-muted-subtle">
          <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-accent uppercase">Privacy Policy</span>
        </div>

        <h1 className="mb-6 text-3xl font-black uppercase tracking-tight text-foreground md:text-4xl">
          Privacy Policy
        </h1>

        <p className="border-surface-border mb-12 border-b pb-6 font-mono text-sm text-muted-subtle">
          EFFECTIVE: 2026-03-23 | VERIDAQ_PRIV_V1.0
        </p>

        <div className="space-y-10 text-sm leading-relaxed md:text-base">
          <ScrollReveal direction="up" delay={0}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground">
                Core Principle: Privacy by Architecture
              </h2>
              <p className="text-muted leading-relaxed">
                Veridaq is built so that student personally identifiable information (PII) never
                appears on the blockchain in readable form. This is not a feature we added — it is
                a structural property of the system. Because data is hashed with Poseidon before
                submission, the public ledger contains only opaque bytes32 values that cannot be
                reversed.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.08}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground">
                Data We Collect
              </h2>
              <ul className="mt-4 space-y-3 pl-5 list-disc text-muted">
                <li>
                  <strong className="text-foreground">Institution data:</strong> Organization name,
                  administrator email, hashed password, public wallet address.
                </li>
                <li>
                  <strong className="text-foreground">Employer data:</strong> Organization name,
                  email, hashed password, verification history (counts only — no student data).
                </li>
                <li>
                  <strong className="text-foreground">Student data:</strong> Full name, matric number,
                  CGPA, classification, course codes, graduation year. This data exists only on the
                  backend server, encrypted at rest with AES-256-GCM. It is loaded into memory for
                  milliseconds during proof generation, then discarded. It never reaches the
                  blockchain.
                </li>
              </ul>
            </section>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.15}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground">
                How Data Is Committed to the Chain
              </h2>
              <p className="text-muted leading-relaxed">
                The institution backend computes a Poseidon hash of the student record plus a random
                blinding factor. This hash — a fixed-size field element — is submitted to
                CredentialRegistry.sol on Base Sepolia. The original data never leaves the backend.
                Because the hash is one-way and the blinding factor is secret, no one can recover
                the original data from the on-chain value.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.2}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground">
                Cookies and Analytics
              </h2>
              <p className="text-muted leading-relaxed">
                Veridaq uses httpOnly secure cookies for JWT session management. No cross-site
                trackers. No analytics piped to third-party advertising networks. The refresh token
                is stored in a cookie that is inaccessible to JavaScript, preventing XSS-based
                session theft.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.25}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground">
                Retention and Deletion
              </h2>
              <p className="text-muted leading-relaxed">
                Institutions can request deletion of their backend data through the support endpoint.
                However, the Poseidon hashes submitted to the L2 ledger are permanent — the
                blockchain is immutable by design. Because these hashes contain no PII, their
                permanence poses no privacy risk. They are, mathematically speaking, unintelligible
                without the original inputs and blinding factor.
              </p>
            </section>
          </ScrollReveal>
        </div>
      </div>
    </div>
  )
}
