"use client"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { AppHeader } from "@/components/ui/app-header"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { FloatingShapes } from "@/components/parallax/floating-shapes"
import { ScrollReveal } from "@/components/parallax/scroll-reveal"

export default function ZKPDefinitionsPage() {
  return (
    <div className="min-h-screen bg-void pb-16">
      <AppHeader />
      <ParallaxBg opacity={0.25} />
      <FloatingShapes count={10} />
      <div className="container mx-auto max-w-4xl px-4 md:px-6 pt-24">
        <div className="mb-8 flex items-center gap-2 font-mono text-sm text-muted-subtle">
          <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-accent uppercase">ZKP Circom Definitions</span>
        </div>

        <h1 className="mb-6 text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">
          ZKP Circom Definitions
        </h1>

        <p className="border-surface-border mb-12 border-b pb-6 font-mono text-sm text-muted-subtle">
          GROTH16 | POSEIDON (CIRCOMLIB) | BN254
        </p>

        <div className="space-y-12 text-sm leading-relaxed md:text-base">
          <ScrollReveal direction="up" delay={0}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground">
                Architecture of the Veridaq Circuit
              </h2>
              <p className="text-muted leading-relaxed">
                Veridaq uses Groth16 zk-SNARKs — the most widely deployed zero-knowledge proof system.
                The circuit is written in Circom 2.0.8 and compiled to an R1CS constraint system.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                The <code className="text-accent">credential.circom</code> file defines two key operations:
                a Poseidon hash commitment that locks the student data, and a claim decoder that checks
                whether the committed data satisfies the employer's query. Both must pass for the proof
                to be valid.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.1}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground">
                The Hash Commitment
              </h2>
              <p className="text-muted leading-relaxed">
                Before any proof is generated, the institution submits a Poseidon hash of the student's
                data to the CredentialRegistry on Base Sepolia. The hash takes seven inputs:
              </p>
              <pre className="border-surface-border mt-6 overflow-x-auto rounded-lg border bg-surface-card p-4 font-mono text-xs text-accent">
                {`Commitment = Poseidon(
  nameHash,
  matricHash,
  cgpa,
  classification,
  courseHash,
  graduationYear,
  blindingFactor
);`}
              </pre>
              <p className="text-muted mt-4 leading-relaxed">
                The <code className="text-foreground">blindingFactor</code> is a cryptographically
                random 256-bit scalar generated on the backend. Even if someone knows the student's
                name and CGPA, they cannot match it against the on-chain commitment without this
                factor. This is what makes the commitment hiding.
              </p>
            </section>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.15}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground">
                Private vs Public Signals
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="border-surface-border rounded border bg-surface-card p-6 text-sm">
                  <h3 className="mb-2 font-bold uppercase tracking-wide text-accent">Private Inputs</h3>
                  <p className="text-muted-subtle mb-4 text-xs">Known only to the backend. Destroyed after proof generation.</p>
                  <ul className="space-y-2 text-muted font-mono text-xs">
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>nameHash</span><span className="text-muted-subtle">sha256 of full name</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>matricHash</span><span className="text-muted-subtle">sha256 of matric number</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>cgpa</span><span className="text-muted-subtle">integer × 100</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>classification</span><span className="text-muted-subtle">0-4 enum</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>courseHash</span><span className="text-muted-subtle">sha256 of course code</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>graduationYear</span><span className="text-muted-subtle">4-digit year</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>blindingFactor</span><span className="text-accent">random 256-bit</span></li>
                    <li className="flex justify-between"><span>institutionKey</span><span className="text-muted-subtle">unique per institution</span></li>
                  </ul>
                </div>
                <div className="border-surface-border rounded border bg-surface-card p-6 text-sm">
                  <h3 className="mb-2 font-bold uppercase tracking-wide text-foreground">Public Inputs</h3>
                  <p className="text-muted-subtle mb-4 text-xs">Visible on-chain. The verifier contract reads these.</p>
                  <ul className="space-y-2 text-muted font-mono text-xs">
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span className="text-accent">commitment</span><span className="text-muted-subtle">on-chain hash pointer</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span className="text-accent">nullifier</span><span className="text-muted-subtle">prevents double-use</span></li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1"><span>claimType</span><span className="text-muted-subtle">1-6 enum</span></li>
                    <li className="flex justify-between"><span>threshold</span><span className="text-muted-subtle">numeric boundary</span></li>
                  </ul>
                </div>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.2}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground">
                The Claim Constraint System
              </h2>
              <p className="text-muted leading-relaxed">
                When an employer submits a verification request, SnarkJS runs the proving algorithm
                with the private inputs from the backend and the public inputs from the request.
                The Circom circuit enforces constraints that check:
              </p>
              <ul className="text-muted mt-4 space-y-2 pl-5 list-disc">
                <li>The commitment matches the Poseidon hash of all private inputs</li>
                <li>The nullifier is correctly derived from the matric number and institution key</li>
                <li>The claimed CGPA meets or exceeds the threshold</li>
                <li>The degree classification matches the claim type</li>
              </ul>
              <p className="text-muted mt-4 leading-relaxed">
                If all constraints pass, the proof is valid. The on-chain verifier checks the
                proof against the public inputs in a single BN254 pairing operation
                (~236,000 gas). The result is permanent.
              </p>
            </section>
          </ScrollReveal>
        </div>
      </div>
    </div>
  )
}
