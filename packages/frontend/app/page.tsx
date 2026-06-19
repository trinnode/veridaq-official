"use client"

import { FloatingShapes } from "@/components/parallax/floating-shapes"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { ScrollReveal } from "@/components/parallax/scroll-reveal"
import { SwapCard } from "@/components/parallax/swap-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { LogoMark } from "@/components/ui/logo"
import { useAuth } from "@/lib/auth"
import { useScrollSpy } from "@/lib/use-scroll-spy"
import { AnimatePresence, motion } from "framer-motion"
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Fingerprint,
  Globe,
  Hexagon,
  Key,
  Layers,
  Lock,
  Menu,
  Network,
  Puzzle,
  Shield,
  ShieldCheck,
  Terminal,
  UserCheck,
  Users,
  Workflow,
  X,
  Zap,
} from "@/lib/icons"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

function scrollToId(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault()
  const el = document.getElementById(id)
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: y, behavior: "smooth" })
  }
}

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#portals", label: "Portals" },
  { href: "#cryptography", label: "Cryptography" },
  { href: "#protocol", label: "Protocol" },
  { href: "#extension", label: "Extension" },
  { href: "#compliance", label: "Compliance" },
]

export default function LandingPage() {
  const { user } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  void mousePos
  const heroRef = useRef<HTMLDivElement>(null)
  const activeSection = useScrollSpy(
    ["hero", "features", "portals", "cryptography", "protocol", "extension", "compliance"],
    {
      initialSection: "hero",
    }
  )

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      })
    }
    window.addEventListener("mousemove", handleMouse, { passive: true })
    return () => window.removeEventListener("mousemove", handleMouse)
  }, [])

  return (
    <div className="selection:bg-accent/20 relative min-h-screen overflow-x-hidden font-sans selection:text-inherit">
      <ParallaxBg />
      <FloatingShapes count={20} />

      {/* ─── Pill Navbar ─── */}
      <nav className="fixed left-0 right-0 top-0 z-50 flex justify-center pt-3 sm:pt-4">
        <div
          className={`flex items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur-2xl transition-all duration-500 sm:px-3 sm:py-2 ${
            scrolled
              ? "border-surface-border bg-void/70 shadow-elevated"
              : "border-transparent bg-void/20"
          }`}
        >
          <Link href="/" className="flex items-center gap-2 pl-1 pr-2">
            <LogoMark className="h-6 w-6 rounded-md" />
            <span className="hidden text-xs font-bold tracking-widest sm:inline">
              VERIDAQ
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 lg:flex">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => scrollToId(e, href.replace("#", ""))}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                  activeSection === href.replace("#", "")
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-card hover:text-foreground"
                }`}
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1 pl-1">
            <ThemeToggle />
            {user ? (
              <Link
                href={`/${user.role.toLowerCase()}/dashboard`}
                className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-void transition-all hover:bg-accent-dim"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/employer/login"
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:bg-surface-card hover:text-foreground"
                >
                  Employer
                </Link>
                <Link
                  href="/institution/login"
                  className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-void transition-all hover:bg-accent-dim"
                >
                  Institution
                </Link>
              </>
            )}
            <button
              className="text-muted hover:text-foreground p-1.5 lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute left-4 right-4 top-16 rounded-2xl border border-surface-border bg-surface-card/95 p-3 shadow-elevated backdrop-blur-xl lg:hidden"
            >
              <div className="flex flex-col gap-1">
                {navLinks.map(({ href, label }) => (
                  <a
                    key={href}
                    onClick={(e) => {
                      scrollToId(e, href.replace("#", ""))
                      setIsMenuOpen(false)
                    }}
                    href={href}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
                  >
                    {label}
                  </a>
                ))}
                <div className="border-surface-border my-1 border-t" />
                {user ? (
                  <Link
                    href={`/${user.role.toLowerCase()}/dashboard`}
                    className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-void"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/employer/login"
                      className="rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-void"
                    >
                      Employer Login
                    </Link>
                    <Link
                      href="/institution/login"
                      className="rounded-xl border border-surface-border px-4 py-2.5 text-center text-sm font-medium text-muted"
                    >
                      Institution Login
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="space-y-32 pb-20 pt-20 md:space-y-48 md:pb-32">
        {/* ════════════════════════ HERO ════════════════════════ */}
        <section
          ref={heroRef}
          id="hero"
          className="container relative mx-auto px-4 pt-8 md:px-6 md:pt-16"
        >
          <div className="mx-auto max-w-5xl text-center">
            <ScrollReveal direction="scale" delay={0}>
              <div className="bg-accent/5 border-accent/10 text-accent mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="bg-accent absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-accent relative inline-flex h-1.5 w-1.5 rounded-full" />
                </span>
                Live on Base Sepolia
              </div>
            </ScrollReveal>

            <ScrollReveal direction="zoom-in" delay={0.15}>
              <h1 className="font-display mb-6 text-5xl font-bold leading-[1.08] tracking-tight md:mb-8 md:text-7xl lg:text-8xl">
                <span className="text-gradient-glow">Censor Resistant</span>
                <br />
                <span className="text-gradient-glow">Academic Truth.</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={0.35}>
              <p className="text-muted mx-auto mb-10 max-w-2xl text-lg leading-relaxed md:mb-12 md:text-xl">
                Universities issue tamper proof credentials. Employers verify them without the
                university exposing a single student record. Zero knowledge proofs on Base L2.
              </p>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={0.5}>
              <div className="relative z-20 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="#extension" className="btn-primary text-sm">
                  <Download className="h-4 w-4" /> Get Extension
                </Link>
                <Link href="/docs" className="btn-secondary text-sm">
                  <Terminal className="h-4 w-4" /> Documentation
                </Link>
                <Link href="/blueprint" className="btn-ghost text-sm">
                  <Hexagon className="h-4 w-4" /> Blueprint
                </Link>
              </div>
            </ScrollReveal>

            {/* Stats Row */}
            <ScrollReveal direction="up" delay={0.6}>
              <div className="border-surface-border relative mt-16 grid grid-cols-2 gap-4 border-t pt-8 md:mt-24 md:grid-cols-4 md:gap-8">
                {[
                  { value: "0.7s", label: "Proof Generation" },
                  { value: "~$0.01", label: "Base Gas Fee" },
                  { value: "100%", label: "On-Chain Verified" },
                  { value: "0", label: "PII Exposed" },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center">
                    <span className="font-display text-foreground mb-1 text-2xl font-bold md:text-3xl">
                      {value}
                    </span>
                    <span className="text-muted text-[10px] font-semibold uppercase tracking-wider md:text-xs">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ════════════════════════ FEATURES (Bento Grid) ════════════════════════ */}
        <section id="features" className="container relative mx-auto px-4 md:px-6">
          <ScrollReveal direction="up" delay={0}>
            <div className="mb-10 text-center md:mb-16">
              <span className="text-accent font-display mb-2 block text-xs font-semibold uppercase tracking-[0.2em]">
                Core Capabilities
              </span>
              <h2 className="font-display mb-4 text-3xl font-bold md:text-5xl">
                <Layers className="text-accent mr-3 inline h-8 w-8 md:h-10 md:w-10" />
                Platform Architecture
              </h2>
              <p className="text-muted mx-auto max-w-2xl text-base md:text-lg">
                Four layers that make credential verification private, permanent, and trustworthy.
              </p>
            </div>
          </ScrollReveal>

          {/* Bento Grid */}
          <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <ScrollReveal direction="scale" delay={0}>
              <div className="border-surface-border from-surface-card to-void hover:border-accent/30 hover:shadow-glow-sm group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all duration-500 [perspective:500px] hover:[transform:rotateX(1deg)] md:col-span-2">
                <div className="bg-accent/5 group-hopver:bg-accent/10 pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full blur-3xl transition-all duration-700 group-hover:scale-150" />
                <div className="relative z-10">
                  <div className="bg-accent/10 text-accent mb-4 inline-flex rounded-xl p-3">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-display mb-2 text-xl font-semibold">Institution Intake</h3>
                  <p className="text-muted max-w-md text-sm leading-relaxed">
                    Universities upload an XLSX of graduating students. Each record is encrypted
                    with AES-256-GCM and hashed with Poseidon before anything leaves the server.
                    No raw data ever touches the public network.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="scale" delay={0.1}>
              <div className="border-surface-border from-surface-card to-void hover:border-accent/30 hover:shadow-glow-sm group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all duration-500 [perspective:500px] hover:[transform:rotateX(1deg)]">
                <div className="bg-accent/5 pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="bg-accent/10 text-accent mb-4 inline-flex rounded-xl p-3">
                    <Cpu className="h-6 w-6" />
                  </div>
                  <h3 className="font-display mb-2 text-xl font-semibold">State Processing</h3>
                  <p className="text-muted text-sm leading-relaxed">
                    Names, matric numbers, and grades get converted to 256-bit field elements the
                    zero-knowledge circuit can work with. All processing stays local — nothing is
                    sent externally.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="scale" delay={0.15}>
              <div className="border-surface-border from-surface-card to-void hover:border-accent/30 hover:shadow-glow-sm group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all duration-500 [perspective:500px] hover:[transform:rotateX(1deg)]">
                <div className="bg-accent/5 pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="bg-accent/10 text-accent mb-4 inline-flex rounded-xl p-3">
                    <Network className="h-6 w-6" />
                  </div>
                  <h3 className="font-display mb-2 text-xl font-semibold">ZK Commitment</h3>
                  <p className="text-muted text-sm leading-relaxed">
                    A Circom circuit computes Poseidon hashes of the student data. These hashes
                    get submitted to Base Sepolia via an ERC-4337 Paymaster — the institution
                    never needs to hold or manage ETH.
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="scale" delay={0.2}>
              <div className="border-surface-border from-surface-card to-void hover:border-accent/30 hover:shadow-glow-sm group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all duration-500 [perspective:500px] hover:[transform:rotateX(1deg)] md:col-span-2">
                <div className="bg-accent/5 pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="bg-accent/10 text-accent mb-4 inline-flex rounded-xl p-3">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="font-display mb-2 text-xl font-semibold">
                    Immutable Verification
                  </h3>
                  <p className="text-muted max-w-md text-sm leading-relaxed">
                    Employers submit a claim and get back VERIFIED or NOT VERIFIED. No student data
                    is revealed in the process. The proof executes on-chain using BN254 curve
                    precompiles — gas-efficient and permanent.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ════════════════════════ PORTALS ════════════════════════ */}
        <section id="portals" className="container relative mx-auto px-4 md:px-6">
          <ScrollReveal direction="up" delay={0}>
            <div className="mb-10 text-center md:mb-16">
              <span className="text-accent font-display mb-2 block text-xs font-semibold uppercase tracking-[0.2em]">
                Three Portals
              </span>
              <h2 className="font-display mb-4 text-3xl font-bold md:text-5xl">
                <Users className="text-accent mr-3 inline h-8 w-8 md:h-10 md:w-10" />
                Who Uses Veridaq
              </h2>
              <p className="text-muted mx-auto max-w-2xl text-base md:text-lg">
                Each role has its own portal with specific workflows and permissions.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-6 md:grid-cols-3">
            <ScrollReveal direction="up" delay={0}>
              <div className="border-surface-border bg-surface-card rounded-lg border p-6">
                <div className="bg-accent/10 text-accent mb-4 inline-flex rounded-xl p-3">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="font-display mb-3 text-xl font-bold">Institution Portal</h3>
                <ul className="text-muted space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Upload student credential batches in XLSX format</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Manage claim definitions and credential lifecycle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>View earnings dashboard and withdraw revenue share</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Toggle employer access to verify your own students</span>
                  </li>
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={0.1}>
              <div className="border-surface-border bg-surface-card rounded-lg border p-6">
                <div className="bg-accent/10 text-accent mb-4 inline-flex rounded-xl p-3">
                  <UserCheck className="h-6 w-6" />
                </div>
                <h3 className="font-display mb-3 text-xl font-bold">Employer Portal</h3>
                <ul className="text-muted space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Submit verification requests with claim type and threshold</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Purchase credit packs from 10 to 500 verifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>View verification history with transaction hash audit trail</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Use Chrome extension for quick verify from any webpage</span>
                  </li>
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={0.2}>
              <div className="border-surface-border bg-surface-card rounded-lg border p-6">
                <div className="bg-accent/10 text-accent mb-4 inline-flex rounded-xl p-3">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="font-display mb-3 text-xl font-bold">Admin Portal</h3>
                <ul className="text-muted space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Approve institution KYC and manage subscriptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>View platform revenue and gas pool balances</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Monitor per institution earnings and transactions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="text-accent mt-0.5 h-4 w-4 shrink-0" />
                    <span>Manage platform wide settings and deactivate accounts</span>
                  </li>
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ════════════════════════ CRYPTOGRAPHY ════════════════════════ */}
        <section id="cryptography" className="container relative mx-auto px-4 md:px-6">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <ScrollReveal direction="left" delay={0}>
                <span className="text-accent font-display mb-2 block text-xs font-semibold uppercase tracking-[0.2em]">
                Zero Knowledge
              </span>
              <h2 className="font-display mb-6 text-3xl font-bold md:text-4xl">
                Cryptographic Circuits
              </h2>
              <p className="text-muted mb-4 text-base md:text-lg">
                The core of the system is a Circom 2 circuit. It takes private inputs like the
                student hashed name, matric number, and CGPA, and public inputs like the claim type
                and threshold. It produces a Groth16 proof that the claim is true without
                revealing any of the private inputs.
              </p>
              <p className="text-muted mb-8 text-base md:text-lg">
                The proof verifies on chain in milliseconds. The employer gets a boolean answer.
                The student data stays on the backend server and nowhere else.
              </p>

              <div className="space-y-5">
                {[
                  {
                    icon: <Zap className="h-4 w-4" />,
                    title: "Secure Trusted Setup",
                    desc: "Phase 2 ceremony using Hermez Powers of Tau. The parameters are public and verifiable with no toxic waste.",
                  },
                  {
                    icon: <Globe className="h-4 w-4" />,
                    title: "L2 Precompiled Verification",
                    desc: "Proofs verify on Base Sepolia using BN254 precompiles. About 236,000 gas per verification, cheap enough for everyday use.",
                  },
                  {
                    icon: <Key className="h-4 w-4" />,
                    title: "Poseidon Hashing",
                    desc: "A ZKP friendly hash designed for arithmetic circuits. Keccak256 would make the circuit impractically large. Poseidon keeps it fast and small.",
                  },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="group flex items-start gap-4">
                    <div className="bg-accent/10 text-accent group-hover:bg-accent/20 mt-0.5 rounded-md p-1.5 transition-all duration-300 group-hover:scale-110">
                      {icon}
                    </div>
                    <div>
                      <h4 className="text-foreground font-semibold">{title}</h4>
                      <p className="text-muted text-sm">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={0.1}>
              <div className="border-surface-border bg-surface shadow-elevated hover:shadow-glow-sm group relative w-full overflow-x-auto border p-4 font-mono text-sm transition-shadow duration-300 md:p-6">
                <div className="border-surface-border mb-4 flex min-w-max items-center gap-2 border-b pb-4 md:mb-6">
                  <div className="bg-error/60 h-2.5 w-2.5 rounded-full" />
                  <div className="bg-warning/60 h-2.5 w-2.5 rounded-full" />
                  <div className="bg-success/60 h-2.5 w-2.5 rounded-full" />
                  <span className="text-muted ml-3 text-xs">
                    packages/circuits/credential.circom
                  </span>
                </div>
                <pre className="text-muted min-w-max text-xs leading-relaxed sm:text-sm">
                  {`pragma circom 2.0.0;
include "poseidon.circom";

template CredentialVerifier() {
    signal input nameHash;
    signal input matricHash;
    signal input cgpa;
    signal input classification;
    signal input courseHash;
    signal input graduationYear;
    signal input blindingFactor;
    signal input institutionKey;

    signal input commitment;
    signal input nullifier;
    signal input claimType;
    signal input threshold;

    component commitmentHasher = Poseidon(7);
    commitmentHasher.inputs[0] <== nameHash;
    commitmentHasher.inputs[1] <== matricHash;
    commitmentHasher.inputs[2] <== cgpa;
    commitmentHasher.inputs[3] <== classification;
    commitmentHasher.inputs[4] <== courseHash;
    commitmentHasher.inputs[5] <== graduationYear;
    commitmentHasher.inputs[6] <== blindingFactor;
    commitment === commitmentHasher.out;

    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== matricHash;
    nullifierHasher.inputs[1] <== institutionKey;
    nullifier === nullifierHasher.out;

    component claim = ClaimDecoder(claimType);
    claim.cgpa <== cgpa;
    claim.classification <== classification;
    claim.courseHash <== courseHash;
    claim.graduationYear <== graduationYear;
    claim.threshold <== threshold;
    claim.out === 1;
}`}
                </pre>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ════════════════════════ PROTOCOL ════════════════════════ */}
        <section id="protocol" className="container relative mx-auto px-4 md:px-6">
          <ScrollReveal direction="up" delay={0}>
            <div className="mb-10 text-center md:mb-16">
              <span className="text-accent font-display mb-2 block text-xs font-semibold uppercase tracking-[0.2em]">
                How It Works
              </span>
              <h2 className="font-display mb-4 text-3xl font-bold md:text-5xl">
                <Workflow className="text-accent mr-3 inline h-8 w-8 md:h-10 md:w-10" />
                Protocol Operations
              </h2>
              <p className="text-muted mx-auto max-w-2xl text-base md:text-lg">
                From batch upload to on-chain verification — how data moves through the system.
              </p>
            </div>
          </ScrollReveal>

          <div className="relative">
            {/* Timeline line */}
            <div className="from-accent/30 via-accent/10 absolute left-8 top-0 hidden h-full w-px bg-gradient-to-b to-transparent md:block" />

            {[
              {
                step: "01",
                icon: <FileJson className="h-5 w-5" />,
                title: "Hash Injection",
                desc: "Student records get hashed through Poseidon with a random blinding factor. The result is a fixed-size field element that cannot be reversed.",
              },
              {
                step: "02",
                icon: <Database className="h-5 w-5" />,
                title: "L2 Commitment",
                desc: "The hashes are submitted to Base Sepolia via an ERC-4337 Paymaster. The institution pays no gas — the platform sponsors the transaction.",
              },
              {
                step: "03",
                icon: <Cpu className="h-5 w-5" />,
                title: "ZK Proof Generation",
                desc: "An employer submits a claim. The backend generates a Groth16 proof in ~0.7 seconds using a compiled WASM circuit. The proof says 'this claim is true' without revealing why.",
              },
              {
                step: "04",
                icon: <Shield className="h-5 w-5" />,
                title: "Immutable Verification",
                desc: "The proof is verified on-chain via BN254 pairing precompiles. The result — VERIFIED or NOT VERIFIED — is permanent and public. The underlying data remains private.",
              },
            ].map(({ step, icon, title, desc }, i) => (
              <ScrollReveal key={step} direction="up" delay={i * 0.1}>
                <div className="group relative mb-8 pl-0 md:pl-16">
                  <div className="bg-surface-card border-accent/20 group-hover:border-accent group-hover:shadow-glow-sm absolute left-0 top-0 hidden h-10 w-10 items-center justify-center rounded-full border transition-all duration-500 md:flex">
                    <span className="text-accent font-display text-xs font-bold">{step}</span>
                  </div>
                  <div className="card-interactive group relative overflow-hidden transition-all duration-500 [perspective:400px] hover:[transform:rotateX(1deg)]">
                    <div className="text-foreground/[0.03] absolute right-4 top-4 select-none text-[80px] font-black leading-none md:text-[100px]">
                      {step}
                    </div>
                    <div className="relative z-10 flex items-start gap-4">
                      <div className="bg-accent/10 text-accent group-hover:bg-accent/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 md:hidden">
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-display mb-2 flex items-center gap-3 text-xl font-semibold md:text-2xl">
                          <span className="bg-accent/20 text-accent hidden h-8 w-8 items-center justify-center rounded-lg text-xs font-bold md:flex">
                            {step}
                          </span>
                          {title}
                        </h3>
                        <p className="text-muted text-sm leading-relaxed md:pr-12">{desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-8 grid gap-6 md:mt-12 lg:grid-cols-2">
            <ScrollReveal direction="left" delay={0}>
              <div className="card-elevated hover:shadow-glow-md group relative overflow-hidden transition-all duration-500">
                <div className="bg-accent/5 pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <h3 className="font-display mb-4 text-xl font-bold md:text-2xl">
                    Cryptographic Finality
                  </h3>
                  <p className="text-muted mb-6 text-sm leading-relaxed md:text-base">
                    The on chain verifier checks the Groth16 proof against the stored commitment
                    and the employer claim. If the math works, the result sticks. No one can
                    alter it, not the institution, not the employer, not us.
                  </p>
                  <ul className="text-muted space-y-3 text-sm">
                    {[
                      "Verification executes deterministically on Base L2",
                      "Non interactive, the employer never touches the student data",
                      "Poseidon hashing guarantees the commitment cannot be reversed",
                      "ERC 4337 Paymaster covers all gas, no wallet management needed",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <div className="bg-accent/10 text-accent rounded p-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={0.1}>
              <div className="border-surface-border bg-surface hover:shadow-glow-sm group relative w-full overflow-x-auto border p-4 font-mono text-sm transition-shadow duration-300 md:p-6">
                <div className="border-surface-border text-muted mb-4 flex min-w-max justify-between border-b pb-3 text-xs">
                  <span className="flex items-center gap-2">
                    <Lock className="h-3 w-3" /> Solidity // ZKVerifier.sol
                  </span>
                  <span className="text-accent">~236k Gas</span>
                </div>
                <pre className="text-muted min-w-max overflow-visible text-xs leading-relaxed sm:text-sm">
                  {`function verifyProof(
  uint256[2] calldata _pA,
  uint256[2][2] calldata _pB,
  uint256[2] calldata _pC,
  uint256[4] calldata _pubSignals
) public view returns (bool) {
  require(
    verifier.verifyProof(
      _pA, _pB, _pC, _pubSignals
    ),
    "Invalid ZK proof"
  );
  emit VerificationLogged(
    _pubSignals[0]  // commitment
  );
  return true;
}`}
                </pre>
              </div>
            </ScrollReveal>
          </div>

          {/* Revenue Model Summary */}
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <ScrollReveal direction="up" delay={0}>
              <div className="border-surface-border bg-surface-card rounded-lg border p-5">
                <div className="text-accent font-mono text-xs mb-2">REVENUE SPLIT</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-accent">70</span>
                  <span className="text-muted text-sm">/ 20 / 10</span>
                </div>
                <p className="text-muted text-xs leading-relaxed">
                  Platform takes 70 percent. Institution earns 20 percent. Gas pool gets 10 percent.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={0.1}>
              <div className="border-surface-border bg-surface-card rounded-lg border p-5">
                <div className="text-accent font-mono text-xs mb-2">CREDIT PACKS</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-foreground">$15</span>
                  <span className="text-muted text-sm">to $550</span>
                </div>
                <p className="text-muted text-xs leading-relaxed">
                  Buy verification credits in packs from 10 to 500. Volume discounts apply.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={0.2}>
              <div className="border-surface-border bg-surface-card rounded-lg border p-5">
                <div className="text-accent font-mono text-xs mb-2">SELF VERIFICATION</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-foreground">20%</span>
                  <span className="text-muted text-sm">always earned</span>
                </div>
                <p className="text-muted text-xs leading-relaxed">
                  Institutions earn their 20 percent share even when verifying their own students through the institution as employer feature.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ════════════════════════ EXTENSION ════════════════════════ */}
        <section id="extension" className="container relative mx-auto px-4 md:px-6">
          <ScrollReveal direction="up" delay={0}>
            <div className="mb-10 text-center md:mb-16">
              <span className="text-accent font-display mb-2 block text-xs font-semibold uppercase tracking-[0.2em]">
                Browser Tooling
              </span>
              <h2 className="font-display mb-4 text-3xl font-bold md:text-5xl">
                <Puzzle className="text-accent mr-3 inline h-8 w-8 md:h-10 md:w-10" />
                Chrome Extension
              </h2>
              <p className="text-muted mx-auto max-w-2xl text-base md:text-lg">
                Verify credentials and upload batches directly from your browser. No need to open
                the full portal for routine tasks. Institutions with employer access can also
                verify through the extension.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <ScrollReveal direction="left" delay={0}>
              <div className="space-y-6">
                {[
                  {
                    icon: <Eye className="h-5 w-5" />,
                    title: "Quick Verify",
                    desc: "Submit verification requests directly from any webpage. Input institution ID, matric number, and claim type.",
                  },
                  {
                    icon: <Download className="h-5 w-5" />,
                    title: "Batch Upload",
                    desc: "Upload student credential batches (.xlsx) directly from the extension panel without opening the full portal.",
                  },
                  {
                    icon: <Shield className="h-5 w-5" />,
                    title: "Session Sync",
                    desc: "Seamlessly shares your web app session via httpOnly cookies. One login, everywhere.",
                  },
                  {
                    icon: <EyeOff className="h-5 w-5" />,
                    title: "Zero Data Exposure",
                    desc: "All cryptographic operations happen server-side. The extension never sees raw student data.",
                  },
                ].map(({ icon, title, desc }, i) => (
                  <ScrollReveal key={title} direction="left" delay={i * 0.05}>
                    <div className="group flex items-start gap-4">
                      <div className="bg-accent/10 text-accent group-hover:bg-accent/20 mt-0.5 rounded-lg p-2.5 transition-all duration-300 group-hover:scale-110">
                        {icon}
                      </div>
                      <div>
                        <h3 className="text-foreground mb-1 font-semibold">{title}</h3>
                        <p className="text-muted text-sm">{desc}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
                <div className="pt-4">
                  <a
                    href="/extension/VERIDAQ-Companion.zip"
                    download
                    className="btn-primary text-sm"
                  >
                    <Download className="h-4 w-4" /> Download Extension (Chrome){" "}
                    <ChevronRight className="h-3 w-3" />
                  </a>
                  <p className="text-muted mt-3 text-xs">
                    Manifest V3 &middot; Chrome 88+ &middot; No external permissions required
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={0.1}>
              <SwapCard />
            </ScrollReveal>
          </div>
        </section>

        {/* ════════════════════════ COMPLIANCE ════════════════════════ */}
        <section
          id="compliance"
          className="border-surface-border bg-surface/30 relative border-t px-4 py-24 text-center md:py-32"
        >
          <div className="via-accent/[0.02] parallax-bg absolute inset-0 bg-gradient-to-b from-transparent to-transparent" />
          <div className="container relative z-10 mx-auto max-w-5xl">
            <ScrollReveal direction="up" delay={0}>
              <div className="bg-accent/10 border-accent/20 hover:shadow-glow-sm mb-8 inline-flex h-16 w-16 rotate-12 items-center justify-center rounded-2xl border transition-all duration-500 hover:rotate-0 hover:scale-110">
                <Lock className="text-accent h-8 w-8" />
              </div>
              <h2 className="font-display mb-8 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Compliance by Mathematics.
              </h2>
              <p className="text-muted mx-auto mb-12 hidden max-w-3xl text-lg leading-relaxed md:mb-16 md:block">
                If student data never exists on the ledger in readable form, it cannot be leaked,
                subpoenaed, or sold. GDPR and CCPA compliance is a structural consequence — not a
                checkbox.
              </p>
              <p className="text-muted mb-10 text-base leading-relaxed md:hidden">
                If the data does not exist on-chain, it cannot be breached. Compliance is built
                into the architecture, not bolted on after the fact.
              </p>

              <div className="mb-12 grid gap-6 md:grid-cols-2">
                {[
                  {
                    title: "No PII on Chain, Ever",
                    body: "The blockchain stores only Poseidon hash commitments — 32-byte field elements that cannot be reversed. No student name, matric number, CGPA, or classification ever appears on the public ledger. This is not a configuration option. It is a structural property of the system that cannot be disabled.",
                  },
                  {
                    title: "Encryption by Default",
                    body: "Student credential data is encrypted with AES-256-GCM before being stored in PostgreSQL. The encryption key lives in the environment and never touches the database. Data is decrypted only in memory for milliseconds during proof generation, then garbage collected.",
                  },
                  {
                    title: "Right to Erasure Compatible",
                    body: "Because on-chain commitments contain no personal data, institutions can delete the encrypted backend records without violating blockchain immutability. The orphaned commitments are meaningless bytes without access to the original data and blinding factor.",
                  },
                  {
                    title: "Auditable by Design",
                    body: "Every verification produces a transaction hash on Base Sepolia. Any party can verify that a proof was checked and accepted by the on-chain verifier. The audit trail is permanent, public, and contains zero personal data.",
                  },
                ].map(({ title, body }, i) => (
                  <div key={title} className="border-surface-border bg-surface-card rounded-lg border p-5 text-left">
                    <h3 className="font-bold text-foreground text-sm mb-2">{title}</h3>
                    <p className="text-muted text-xs leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                {[
                  { title: "GDPR", desc: "No PII processed" },
                  { title: "SOC2", desc: "Hardened perimeter" },
                  { title: "ISO 27001", desc: "Security first" },
                  { title: "FERPA", desc: "Student privacy" },
                ].map(({ title, desc }, i) => (
                  <ScrollReveal key={title} direction="zoom-in" delay={i * 0.08}>
                    <div className="card-interactive group flex flex-col items-center gap-3 py-6 md:py-8">
                      <Fingerprint className="text-accent/60 group-hover:text-accent h-6 w-6 transition-all duration-300 group-hover:scale-110 md:h-8 md:w-8" />
                      <div className="flex flex-col gap-1 text-center">
                        <span className="text-sm font-bold tracking-wide md:text-base">
                          {title}
                        </span>
                        <span className="text-muted text-[10px] md:text-xs">{desc}</span>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
    </div>
  )
}
