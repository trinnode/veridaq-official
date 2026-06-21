"use client"
import { SafeLink as Link } from "@/components/safe-link"
import React, { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldCheck, Layers, FileCode2, ArrowLeft, Terminal, Database, Lock, X,
  ChevronRight, Activity, Workflow, Code, Server, Cpu, Users, Wallet,
  UserCheck, Route, ScrollText, CircuitBoard, Key, Globe, Zap, Fingerprint,
  Shield, EyeOff, DollarSign, TrendingUp, AlertTriangle,
  GanttChartSquare, Binary
} from "@/lib/icons"
import { AppHeader } from "@/components/ui/app-header"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { FloatingShapes } from "@/components/parallax/floating-shapes"

export default function DocumentationPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState("overview")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const tabs = [
    { id: "overview", label: "Executive Overview", icon: <ShieldCheck className="w-4 h-4" />, desc: "What Veridaq solves and how it works" },
    { id: "architecture", label: "Architecture and Flow", icon: <Workflow className="w-4 h-4" />, desc: "Frontend, backend, queue, and blockchain layers" },
    { id: "contracts", label: "Smart Contracts", icon: <FileCode2 className="w-4 h-4" />, desc: "Solidity contracts, deployment, and verification" },
    { id: "zkp", label: "Zero Knowledge Circuit", icon: <Cpu className="w-4 h-4" />, desc: "Circom circuit design and proof generation" },
    { id: "backend", label: "API and Backend", icon: <Server className="w-4 h-4" />, desc: "Routes, services, workers, and database" },
  ]

  const activeTabIndex = tabs.findIndex((t) => t.id === activeTab)
  const prevTab = activeTabIndex > 0 ? tabs[activeTabIndex - 1] : null
  const nextTab = activeTabIndex < tabs.length - 1 ? tabs[activeTabIndex + 1] : null

  const CodeBlock = ({ code, language = "typescript", filename = "", noBg = false }: { code: string; language?: string; filename?: string; noBg?: boolean }) => (
    <div className={`relative w-full max-w-full overflow-hidden rounded-md my-6 border border-surface-border ${noBg ? "" : "bg-surface"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 bg-surface-card border-b border-surface-border gap-2">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
          </div>
          {filename && <span className="text-xs font-mono text-muted break-words line-clamp-1">{filename}</span>}
        </div>
        <span className="text-[10px] sm:text-xs font-mono text-muted-subtle">{language}</span>
      </div>
      <div className="overflow-x-auto max-w-full hide-scrollbar w-full">
        <pre className="p-4 inline-block min-w-full text-xs md:text-sm font-mono text-muted leading-relaxed">
          {code}
        </pre>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="flex-1 w-full bg-void text-foreground flex flex-col font-sans selection:bg-accent/20 selection:text-inherit relative">
      <ParallaxBg opacity={0.25} />
      <FloatingShapes count={10} />
      <AppHeader />

      <div className="container mx-auto px-4 md:px-6 pt-20">
        <div className="flex items-center gap-2 py-3">
          <Link href="/" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors group text-sm font-medium">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </Link>
          <span className="text-muted-subtle text-xs">/</span>
          <span className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <Code className="w-4 h-4" /> Protocol Documentation
          </span>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-void border-l border-surface-border flex flex-col md:hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-card">
              <span className="font-bold tracking-widest text-xs text-accent uppercase">Chapters</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-muted hover:text-foreground bg-surface rounded-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); window.scrollTo(0, 0) } }
                  className={`w-full flex items-start gap-4 p-4 border transition-all text-left ${activeTab === tab.id
                      ? "bg-accent/10 border-accent text-foreground"
                      : "border-surface-border bg-surface-card text-muted hover:bg-surface"}`}
                >
                  <div className={`mt-0.5 ${activeTab === tab.id ? "text-accent" : "text-muted-subtle"}`}>{tab.icon}</div>
                  <div className="min-w-0">
                    <div className={`font-bold text-sm ${activeTab === tab.id ? "text-accent" : "text-foreground"}`}>{tab.label}</div>
                    <div className="text-xs text-muted-subtle mt-1 break-words leading-relaxed">{tab.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container w-full max-w-full mx-auto px-4 md:px-6 pt-28 md:pt-32 pb-24 flex flex-col md:flex-row gap-8 lg:gap-16">

        <aside className="hidden md:block w-72 shrink-0 relative">
          <div className="sticky top-32 space-y-1">
            <div className="text-[10px] font-bold text-muted-subtle uppercase tracking-widest mb-6 px-3">Chapters</div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); window.scrollTo(0, 0) } }
                className={`w-full flex flex-col px-4 py-3 border-l-2 transition-all text-left group ${activeTab === tab.id
                    ? "bg-accent/10 border-accent"
                    : "border-transparent text-muted hover:bg-surface-card"}`}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className={`${activeTab === tab.id ? "text-accent" : "text-muted-subtle"}`}>{tab.icon}</span>
                  <span className={`font-bold text-sm ${activeTab === tab.id ? "text-foreground" : ""}`}>{tab.label}</span>
                </div>
                <span className="text-[11px] text-muted-subtle mt-1.5 pl-7 leading-relaxed">{tab.desc}</span>
              </button>
            ))}

            <div className="mt-12 mb-4 px-4 text-[10px] font-bold text-muted-subtle uppercase tracking-widest">Related</div>
            <Link href="/blueprint" className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-accent hover:text-foreground transition-colors">
              <Layers className="w-4 h-4" /> Protocol Blueprint
            </Link>
            <Link href="/zkp" className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors">
              <Cpu className="w-4 h-4" /> ZKP Circuit Specs
            </Link>
            <Link href="/privacy" className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors">
              <Shield className="w-4 h-4" /> Privacy Policy
            </Link>
          </div>
        </aside>

        <main className="flex-1 w-full max-w-full md:max-w-5xl relative min-w-0">
          <AnimatePresence mode="wait">

          {/* ─── OVERVIEW ─── */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-12 w-full">
              <header className="border-b border-surface-border pb-8 w-full">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-sm bg-accent/10 text-accent text-xs font-mono mb-6 border border-accent/20">SECTION 01</div>
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-foreground tracking-tight break-words">Executive Overview.</h1>
                <p className="text-xl md:text-2xl text-muted font-light leading-relaxed">
                  Veridaq lets universities issue tamper proof credentials and lets employers verify them without
                  the university exposing a single student record. Everything is backed by zero knowledge proofs
                  on Base L2.
                </p>
              </header>

              <div className="space-y-6 w-full">
                <h2 className="text-2xl font-bold flex items-center gap-3"><ShieldCheck className="text-accent shrink-0" /> The Problem</h2>
                <div className="bg-surface-card border border-surface-border p-6 md:p-8 space-y-4 w-full">
                  <p className="text-muted leading-relaxed break-words">
                    In Nigeria and across Africa, verifying academic credentials costs employers millions
                    every year. A bank hiring a fresh graduate waits weeks for transcript verification.
                    Universities either build expensive API integrations that expose their entire student
                    database, or they process manual requests one at a time. Once data leaves the university,
                    they have no control over where it ends up.
                  </p>
                  <p className="text-muted leading-relaxed break-words">
                    The scale of the problem is staggering. The Nigerian university system graduates over
                    600,000 students annually across 170 universities. Each graduate applies to multiple
                    employers. Each employer verifies each candidate manually. The National Universities
                    Commission estimates that 30 percent of submitted credentials in Nigeria have some form
                    of alteration. This costs the financial sector alone an estimated 500 million naira per
                    year in verification overhead and fraud losses.
                  </p>
                  <p className="text-muted leading-relaxed break-words">
                    Blockchain solutions exist but they make things worse. Most put raw student names,
                    grades, and GPAs on a public ledger. Even encrypted credentials are only as safe as
                    the key management, and academic records need to stay verifiable for decades.
                    GDPR Article 17 requires that individuals can request deletion of their data, but
                    blockchain is immutable. This creates a fundamental conflict between privacy regulation
                    and blockchain transparency. Veridaq resolves this by never putting personal data on-chain
                    in the first place.
                  </p>
                </div>
              </div>

              <div className="space-y-6 w-full">
                <h2 className="text-2xl font-bold flex items-center gap-3"><TrendingUp className="text-accent shrink-0" /> Competitor Comparison</h2>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-surface-border">
                        <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Platform</th>
                        <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Privacy Model</th>
                        <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">On-Chain Data</th>
                        <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Verification</th>
                        <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Gas Model</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-surface-border/50">
                        <td className="p-3 text-accent font-bold">VERIDAQ</td>
                        <td className="p-3 text-accent">Zero-knowledge proofs</td>
                        <td className="p-3">Poseidon hash only (32 bytes)</td>
                        <td className="p-3">Groth16 on-chain</td>
                        <td className="p-3">Paymaster sponsors</td>
                      </tr>
                      <tr className="border-b border-surface-border/50">
                        <td className="p-3 text-muted">Blockcerts (MIT)</td>
                        <td className="p-3 text-muted">Signed PDF on blockchain</td>
                        <td className="p-3">Full certificate hash</td>
                        <td className="p-3">Off-chain signature verification</td>
                        <td className="p-3">User pays gas</td>
                      </tr>
                      <tr className="border-b border-surface-border/50">
                        <td className="p-3 text-muted">Dock.io</td>
                        <td className="p-3 text-muted">Verifiable credentials (VCs)</td>
                        <td className="p-3">DID + credential hash</td>
                        <td className="p-3">Off-chain VC verification</td>
                        <td className="p-3">Subscription</td>
                      </tr>
                      <tr className="border-b border-surface-border/50">
                        <td className="p-3 text-muted">Learning Machine (Evernym)</td>
                        <td className="p-3 text-muted">Hyperledger Indy VCs</td>
                        <td className="p-3">DID + schema + credential definition</td>
                        <td className="p-3">Off-chain VC verification</td>
                        <td className="p-3">Permissioned ledger</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-muted">Traditional paper</td>
                        <td className="p-3 text-muted">Full data exposure</td>
                        <td className="p-3">N/A</td>
                        <td className="p-3">Manual, weeks</td>
                        <td className="p-3">Per-request fees</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-muted text-sm leading-relaxed">
                  Veridaq is the only solution that combines zero-knowledge proofs, on-chain verification,
                  and a sponsorship gas model that removes the blockchain complexity from end users.
                  Competitors either expose data on-chain (Blockcerts), require users to hold cryptocurrency
                  (Dock), or rely on permissioned ledgers that recreate the centralization problem.
                </p>
              </div>

              <div className="space-y-6 w-full">
                <h2 className="text-2xl font-bold flex items-center gap-3"><Layers className="text-accent shrink-0" /> How Veridaq Works</h2>
                <p className="text-muted leading-relaxed">
                  The system has three phases that correspond to the three user roles.
                </p>
                <div className="grid md:grid-cols-3 gap-6 w-full">
                  <div className="p-6 border border-surface-border bg-surface w-full">
                    <div className="text-accent font-mono text-xs mb-3 border-b border-surface-border pb-2 inline-block">PHASE 1</div>
                    <h3 className="text-xl font-bold mb-3 text-foreground">Institution Uploads</h3>
                    <p className="text-muted text-sm leading-relaxed">
                      The registrar uploads an Excel file of graduating students. The backend hashes
                      each record through Poseidon with a random blinding factor. Only the hash goes
                      to the blockchain. The original data stays on the backend server encrypted with
                      AES 256 GCM.
                    </p>
                  </div>
                  <div className="p-6 border border-surface-border bg-surface w-full">
                    <div className="text-accent font-mono text-xs mb-3 border-b border-surface-border pb-2 inline-block">PHASE 2</div>
                    <h3 className="text-xl font-bold mb-3 text-foreground">Employer Requests</h3>
                    <p className="text-muted text-sm leading-relaxed">
                      An employer submits a matriculation number and a claim. Did this graduate achieve
                      a CGPA above 3.50? The backend retrieves the encrypted record, generates a
                      Groth16 proof in about 0.7 seconds, and submits it to the on chain verifier.
                    </p>
                  </div>
                  <div className="p-6 border border-surface-border bg-surface w-full">
                    <div className="text-accent font-mono text-xs mb-3 border-b border-surface-border pb-2 inline-block">PHASE 3</div>
                    <h3 className="text-xl font-bold mb-3 text-foreground">Verification Result</h3>
                    <p className="text-muted text-sm leading-relaxed">
                      The smart contract checks the proof against the stored commitment and returns
                      VERIFIED or NOT VERIFIED. The employer gets a boolean answer. The transaction
                      hash is the permanent audit record. No student data was ever revealed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 w-full">
                <h2 className="text-2xl font-bold flex items-center gap-3"><DollarSign className="text-accent shrink-0" /> Revenue Model</h2>
                <div className="bg-surface-card border border-surface-border p-6 md:p-8 w-full">
                  <p className="text-muted leading-relaxed mb-4">
                    Veridaq uses a revenue sharing model that aligns incentives across all participants.
                    When an employer consumes a verification credit, the proceeds are split three ways.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 border border-accent/20 bg-accent/5">
                      <div className="text-accent font-mono text-xs mb-1">PLATFORM</div>
                      <div className="text-2xl font-bold text-accent">70%</div>
                      <div className="text-muted text-xs mt-1">Covers infrastructure, gas costs, and development</div>
                    </div>
                    <div className="p-4 border border-surface-border bg-surface-card">
                      <div className="text-foreground font-mono text-xs mb-1">INSTITUTION</div>
                      <div className="text-2xl font-bold text-foreground">20%</div>
                      <div className="text-muted text-xs mt-1">Earned by the university that issued the credential</div>
                    </div>
                    <div className="p-4 border border-surface-border bg-surface-card">
                      <div className="text-foreground font-mono text-xs mb-1">GAS POOL</div>
                      <div className="text-2xl font-bold text-foreground">10%</div>
                      <div className="text-muted text-xs mt-1">Accumulated to subsidize on-chain gas costs</div>
                    </div>
                  </div>
                  <p className="text-muted text-sm leading-relaxed">
                    Batch upload pricing is based on file size: $20 for 1,001-5,000 records, $30 for 5,001-10,000,
                    $90 for 10,001-25,000, and $170 for 25,001-50,000. Verification credits are sold in packs
                    starting at $15 for 10 credits up to $550 for 500 credits.
                  </p>
                </div>
              </div>

              <div className="space-y-6 w-full">
                <h2 className="text-2xl font-bold flex items-center gap-3"><Fingerprint className="text-accent shrink-0" /> Privacy Guarantees</h2>
                <div className="bg-surface-card border border-surface-border p-6 md:p-8 space-y-4 w-full">
                  <p className="text-muted leading-relaxed break-words">
                    The system provides three guarantees by construction. First, no student name,
                    grade, or matriculation number ever appears on the public blockchain. The
                    commitment is a Poseidon hash with a random blinding factor. Given only the hash,
                    an attacker learns nothing about the underlying data.
                  </p>
                  <p className="text-muted leading-relaxed break-words">
                    Second, the backend cannot fabricate a VERIFIED result. The Groth16 verifier on
                    chain checks mathematical soundness of every proof. Without a valid witness the
                    proof fails.
                  </p>
                  <p className="text-muted leading-relaxed break-words">
                    Third, institutions can revoke any credential by nullifier. The verifier checks
                    the RevocationRegistry before accepting a proof. A revoked credential always
                    returns NOT VERIFIED regardless of the proof.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ARCHITECTURE ─── */}
          {activeTab === "architecture" && (
            <motion.div key="architecture" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-12 w-full max-w-full">
              <header className="border-b border-surface-border pb-8 w-full">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-sm bg-accent/10 text-accent text-xs font-mono mb-6 border border-accent/20">SECTION 02</div>
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-foreground tracking-tight break-words">System Architecture.</h1>
                <p className="text-lg text-muted font-light leading-relaxed">
                  Veridaq runs four distinct layers. The Next.js frontend serves three portal
                  applications. The Fastify backend handles all business logic, queue processing,
                  and blockchain interaction. PostgreSQL stores relational state and encrypted
                  credential data. Base L2 runs the smart contracts that verify proofs.
                </p>
              </header>

              <div className="space-y-6 w-full">
                <h2 className="text-2xl font-bold flex items-center gap-3"><EyeOff className="text-accent shrink-0" /> Security Boundaries</h2>
                <div className="bg-surface-card border border-surface-border p-6 md:p-8 w-full">
                  <p className="text-muted leading-relaxed mb-4">
                    The system has three security boundaries that must never be crossed.
                  </p>
                  <div className="space-y-4">
                    <div className="p-4 border border-surface-border bg-surface">
                      <h4 className="font-bold text-accent text-sm mb-2">Boundary 1: Backend to Blockchain</h4>
                      <p className="text-muted text-xs leading-relaxed">
                        Only Poseidon hash commitments and nullifiers cross this boundary. No raw student
                        data ever goes to the blockchain. The backend hashes the data before submission.
                        This boundary is enforced at the application layer by the BlockchainService.
                      </p>
                    </div>
                    <div className="p-4 border border-surface-border bg-surface">
                      <h4 className="font-bold text-accent text-sm mb-2">Boundary 2: Backend to Frontend</h4>
                      <p className="text-muted text-xs leading-relaxed">
                        The frontend never receives raw student data. The API returns verification results
                        (VERIFIED, NOT VERIFIED, PENDING) and transaction hashes. Student credentials are
                        only decrypted on the backend during proof generation and never transmitted over
                        the network in decrypted form.
                      </p>
                    </div>
                    <div className="p-4 border border-surface-border bg-surface">
                      <h4 className="font-bold text-accent text-sm mb-2">Boundary 3: Database to Application</h4>
                      <p className="text-muted text-xs leading-relaxed">
                        Student credential data is encrypted with AES-256-GCM before being stored in
                        PostgreSQL. The encryption key is held in environment variables and never written
                        to the database. Decryption happens only in memory during proof generation and
                        the plaintext is garbage collected immediately after.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-bold border-b border-surface-border pb-4 w-full">Layer by Layer</h2>

              <div className="space-y-8 w-full">
                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Globe className="text-accent" /> Frontend Layer</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Three Next.js 15 portals sharing a single codebase. The Institution portal handles
                    batch uploads, credential management, and verification history. The Employer portal
                    handles verification requests, credit purchases, and result history. The Admin
                    portal handles KYC approval, tier management, and platform monitoring.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    All three use TanStack Query for data fetching, a shared Axios client with
                    automatic token refresh, and shadcn/ui primitives styled with Tailwind CSS.
                    Authentication uses JWTs stored in httpOnly cookies. The access token lives
                    in memory only and gets refreshed silently when it expires.
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    The frontend communicates with the backend exclusively through REST API calls.
                    There is no direct blockchain interaction from the browser. All contract calls
                    go through the backend API, which signs and submits transactions using the
                    platform admin wallet.
                  </p>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Server className="text-accent" /> Backend Layer</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Fastify 5 with TypeScript. The server starts by loading a Zod validated
                    configuration object. Every environment variable is checked at startup. If
                    anything is missing or malformed, the server exits immediately with a clear
                    error message.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The server registers plugins in order: Prisma for database access, Redis for
                    queue management, JWT authentication, and CORS. After plugins come the route
                    modules. Each route file defines its endpoints using Fastify's schema based
                    validation. Request bodies are parsed with Zod before any business logic runs.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Services are instantiated per request. The service layer handles all business
                    logic. Workers run in separate threads and process BullMQ jobs for batch uploads
                    and proof generation. This prevents long running computations from blocking the
                    API server.
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    The backend runs on port 4000 in development. Swagger UI is available at
                    /docs for all registered routes. The server supports hot reloading through
                    tsx watch for rapid development iteration.
                  </p>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Database className="text-accent" /> Data Layer</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    PostgreSQL 16 with Prisma 6 as the ORM. The schema has models for institutions,
                    employers, admins, claim definitions, credential batches, verification requests,
                    payments, and audit logs. Student credential data is encrypted at rest with
                    AES 256 GCM. The encryption key comes from the environment and never touches
                    the database.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Redis 7 handles two workloads. BullMQ queues batch processing jobs so the API
                    server stays responsive during large uploads. Redis also caches frequently
                    accessed data like institution lists and claim definitions.
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    The Prisma schema is the single source of truth for the database structure.
                    Migrations are generated by Prisma and applied with prisma migrate deploy.
                    The seed script creates default accounts and sample data for development.
                  </p>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><CircuitBoard className="text-accent" /> Blockchain Layer</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Six Solidity contracts deployed on Base Sepolia. The InstitutionRegistry maps
                    institution IDs to wallet addresses. The CredentialRegistry stores batches of
                    commitment nullifier pairs. The RevocationRegistry is an append only list of
                    revoked nullifiers. The SubscriptionManager tracks FREE and PAID tiers. The
                    PaymasterVault implements ERC 4337 and sponsors gas for institution operations.
                    The Groth16Verifier is auto generated by SnarkJS from the Circom circuit.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    All blockchain interactions go through viem 2. The backend uses a single
                    platform admin wallet for contract calls. Institutions never touch the blockchain
                    directly. The PaymasterVault intercepts their UserOperations and covers gas
                    costs from their deposited balance.
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    Base Sepolia is used for development and testing. The contracts are deployed
                    using Foundry's forge script with broadcast and verification on BaseScan.
                    The deployment order matters because CredentialRegistry depends on
                    InstitutionRegistry and PaymasterVault depends on the EntryPoint address.
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-bold border-b border-surface-border pb-4 mt-12 w-full">Verification Flow</h2>

              <div className="relative border border-surface-border bg-surface-card p-6 md:p-8 mb-8 overflow-hidden w-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded border border-accent bg-accent/10 flex items-center justify-center text-accent font-bold shrink-0">1</div>
                  <h3 className="text-xl font-bold">Batch Upload and Commitment</h3>
                </div>
                <p className="text-sm text-muted leading-relaxed mb-6">
                  The registrar uploads an XLSX file through the Institution portal. The backend
                  parses the file, validates each row, and pushes the job to a BullMQ queue. The
                  worker processes each record by hashing the student data through Poseidon and
                  storing the encrypted record in PostgreSQL. Once all records are processed, the
                  worker calls registerBatch on the CredentialRegistry contract to submit all
                  commitments and nullifiers in a single transaction.
                </p>
                <CodeBlock
                  filename="Worker processes batch upload"
                  code={`for (const record of records) {
  const blindingFactor = randomBytes(32);
  const commitment = poseidon.hash([
    hashField(record.name),
    hashField(record.matricNumber),
    Math.floor(record.cgpa * 100),
    record.classification,
    hashField(record.courseCode),
    record.graduationYear,
    blindingFactor,
  ]);
  const nullifier = poseidon.hash([
    hashField(record.matricNumber),
    institutionKey,
  ]);
  encryptedRecords.push({ commitment, nullifier, encryptedData });
}
await blockchainService.registerBatch(institutionId, commitments, nullifiers);`}
                />
              </div>

              <div className="relative border border-surface-border bg-surface-card p-6 md:p-8 mb-8 overflow-hidden w-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded border border-accent bg-accent/10 flex items-center justify-center text-accent font-bold shrink-0">2</div>
                  <h3 className="text-xl font-bold">Verification Request</h3>
                </div>
                <p className="text-sm text-muted leading-relaxed mb-6">
                  The employer submits a verification request through the Employer portal. The request
                  includes the institution identifier, the candidate's matriculation number, the claim
                  type, and a threshold value. The backend validates the request, checks that the
                  employer has available credits or free verifications remaining, and creates a
                  verification request record.
                </p>
                <p className="text-sm text-muted leading-relaxed mb-6">
                  The backend then retrieves the encrypted credential record for that matriculation
                  number, decrypts it in memory, and passes the private inputs to the SnarkJS prover.
                  The prover generates a Groth16 proof that the credential satisfies the claimed
                  condition without revealing the underlying data.
                </p>
                <CodeBlock
                  filename="Proof generation sequence"
                  code={`// 1. Retrieve and decrypt the credential
const credential = await prisma.studentCredential.findUnique({
  where: { matricNumber_institutionId: {
    matricNumber, institutionId
  }}
});
const plaintext = decryptAes256Gcm(
  credential.encryptedData,
  config.ENCRYPTION_KEY
);

// 2. Compute private signals
const nameHash = poseidon.hash([toFieldElement(plaintext.name)]);
const cgpa = Math.floor(parseFloat(plaintext.cgpa) * 100);

// 3. Generate the proof
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  { nameHash, matricHash, cgpa, /* ... */ },
  wasmPath, zkeyPath
);`}
                />
              </div>

              <div className="relative border border-surface-border bg-surface-card p-6 md:p-8 overflow-hidden w-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded border border-accent bg-accent/10 flex items-center justify-center text-accent font-bold shrink-0">3</div>
                  <h3 className="text-xl font-bold">On Chain Verification</h3>
                </div>
                <p className="text-sm text-muted leading-relaxed mb-6">
                  The proof array and public signals are submitted to the ZKVerifier contract on
                  Base Sepolia. The contract uses BN254 pairing precompiles to check the proof.
                  If valid, it checks the RevocationRegistry to confirm the nullifier has not been
                  revoked. The result is stored on chain and the employer receives the verification
                  status. The entire on chain operation costs approximately 236,000 gas.
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-sm mt-4 w-full">
                  <Activity className="w-5 h-5 shrink-0" />
                  <span>The proof generation happens off chain. Only the verification executes on chain.
                  This keeps gas costs low and proof generation fast.</span>
                </div>
                <CodeBlock
                  filename="On-chain verification call via viem"
                  language="typescript"
                  code={`const tx = await client.writeContract({
  address: config.ZK_VERIFIER_ADDRESS,
  abi: zkVerifierAbi,
  functionName: 'verifyProof',
  args: [proof.pi_a, proof.pi_b, proof.pi_c, publicSignals],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
// receipt.status === 'success' means VERIFIED`}
                />
              </div>

              <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full mt-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Users className="text-accent" /> Institution-as-Employer Flow</h3>
                <p className="text-sm text-muted leading-relaxed mb-4">
                  Institutions can optionally enable employer access from their settings page. When
                  enabled, the institution gets a linked employer profile that allows them to verify
                  credentials from the Institution portal. This is useful for internal verification
                  departments, postgraduate admissions, or inter-university transfers.
                </p>
                <p className="text-sm text-muted leading-relaxed mb-4">
                  When an institution verifies their own students through this feature, they still
                  earn 20 percent of the verification credit revenue. This ensures the institution
                  is incentivized to use the platform internally even as it earns revenue from
                  external employer verifications.
                </p>
                <p className="text-sm text-muted leading-relaxed">
                  The feature is controlled by the Institution model's alsoEmployer boolean field.
                  When toggled on during registration or through settings, the backend automatically
                  creates or reveals an Employer record linked by institutionId. The employer access
                  toggle requires at least one admin to be configured.
                </p>
              </div>
            </motion.div>
          )}

          {/* ─── CONTRACTS ─── */}
          {activeTab === "contracts" && (
            <motion.div key="contracts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-12 w-full max-w-full">
              <header className="border-b border-surface-border pb-8">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-sm bg-accent/10 text-accent text-xs font-mono mb-6 border border-accent/20">SECTION 03</div>
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-foreground tracking-tight break-words">Smart Contracts.</h1>
                <p className="text-lg text-muted font-light leading-relaxed">
                  Six Solidity contracts compiled with Foundry at pragma 0.8.28. Each contract has a
                  specific responsibility and they are deployed in a specific order to satisfy
                  dependencies. All reverts use custom errors for lower gas costs compared to require
                  strings.
                </p>
              </header>

              <div className="space-y-8 w-full">
                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-6 h-6 text-accent" />
                    <div>
                      <h3 className="text-xl font-bold text-accent">InstitutionRegistry.sol</h3>
                      <span className="text-[10px] font-mono text-muted-subtle">packages/contracts/src/InstitutionRegistry.sol</span>
                    </div>
                  </div>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Maps institution identifiers to on chain profiles. Each institution gets a unique
                    bytes32 ID derived from its name. The contract stores the institution name and
                    admin wallet address. Only the platform owner can register new institutions.
                    Emits InstitutionRegistered when a new institution is added.
                  </p>
                  <div className="p-4 bg-surface border border-surface-border mb-4">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Key Functions</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p><span className="text-accent">registerInstitution</span>(bytes32 id, string name, address admin) external onlyOwner</p>
                      <p><span className="text-accent">getInstitution</span>(bytes32 id) external view returns (string, address, bool)</p>
                      <p><span className="text-accent">isRegistered</span>(bytes32 id) external view returns (bool)</p>
                      <p><span className="text-accent">updateAdmin</span>(bytes32 id, address newAdmin) external onlyOwner</p>
                      <p><span className="text-accent">deactivateInstitution</span>(bytes32 id) external onlyOwner</p>
                    </div>
                  </div>
                  <div className="p-4 bg-surface border border-surface-border">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Events</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p><span className="text-accent">InstitutionRegistered</span>(bytes32 indexed id, string name, address admin)</p>
                      <p><span className="text-accent">InstitutionDeactivated</span>(bytes32 indexed id)</p>
                    </div>
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <Database className="w-6 h-6 text-accent" />
                    <div>
                      <h3 className="text-xl font-bold text-accent">CredentialRegistry.sol</h3>
                      <span className="text-[10px] font-mono text-muted-subtle">packages/contracts/src/CredentialRegistry.sol</span>
                    </div>
                  </div>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Stores batches of credential commitments. Each batch contains an array of
                    commitment and nullifier pairs submitted by a registered institution. The
                    contract enforces that only registered institutions can submit batches and
                    that each nullifier is unique across the entire registry.
                  </p>
                  <div className="p-4 bg-surface border border-surface-border mb-4">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Key Functions</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p><span className="text-accent">registerBatch</span>(bytes32 institutionId, bytes32[] commitments, bytes32[] nullifiers) external</p>
                      <p><span className="text-accent">isCommitmentValid</span>(bytes32 commitment, bytes32 nullifier) external view returns (bool)</p>
                      <p><span className="text-accent">getBatchCount</span>(bytes32 institutionId) external view returns (uint256)</p>
                      <p><span className="text-accent">getCommitmentAt</span>(bytes32 institutionId, uint256 batchIndex, uint256 credIndex) external view</p>
                    </div>
                  </div>
                  <div className="p-4 bg-surface border border-surface-border">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Events</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p><span className="text-accent">BatchRegistered</span>(bytes32 indexed institutionId, uint256 batchIndex, uint256 count)</p>
                    </div>
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <Lock className="w-6 h-6 text-accent" />
                    <div>
                      <h3 className="text-xl font-bold text-accent">RevocationRegistry.sol</h3>
                      <span className="text-[10px] font-mono text-muted-subtle">packages/contracts/src/RevocationRegistry.sol</span>
                    </div>
                  </div>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    An append only list of revoked nullifiers. Institutions can revoke individual
                    credentials by submitting the nullifier. Once revoked, a credential can never
                    be verified again. The contract does not allow removing entries from the list.
                  </p>
                  <div className="p-4 bg-surface border border-surface-border mb-4">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Key Functions</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p><span className="text-accent">revoke</span>(bytes32 nullifier) external</p>
                      <p><span className="text-accent">revokeBatch</span>(bytes32[] nullifiers) external</p>
                      <p><span className="text-accent">isRevoked</span>(bytes32 nullifier) external view returns (bool)</p>
                    </div>
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <Wallet className="w-6 h-6 text-accent" />
                    <div>
                      <h3 className="text-xl font-bold text-accent">PaymasterVault.sol</h3>
                      <span className="text-[10px] font-mono text-muted-subtle">packages/contracts/src/PaymasterVault.sol</span>
                    </div>
                  </div>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Implements ERC 4337's IPaymaster interface. Each institution has a dedicated
                    ETH balance within the vault. When an institution submits a UserOperation,
                    the PaymasterVault's validatePaymasterUserOp function checks that the institution
                    has sufficient balance to cover the gas cost.
                  </p>
                  <div className="p-4 bg-surface border border-surface-border mb-4">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Key Functions</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p><span className="text-accent">deposit</span>(bytes32 institutionId) external payable</p>
                      <p><span className="text-accent">withdraw</span>(bytes32 institutionId, uint256 amount) external onlyAdmin</p>
                      <p><span className="text-accent">balanceOf</span>(bytes32 institutionId) external view returns (uint256)</p>
                      <p><span className="text-accent">validatePaymasterUserOp</span>(UserOperation calldata, ...) external returns (bytes memory)</p>
                      <p><span className="text-accent">postOperation</span>(UserOperation calldata, ...) external</p>
                    </div>
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <UserCheck className="w-6 h-6 text-accent" />
                    <div>
                      <h3 className="text-xl font-bold text-accent">SubscriptionManager.sol</h3>
                      <span className="text-[10px] font-mono text-muted-subtle">packages/contracts/src/SubscriptionManager.sol</span>
                    </div>
                  </div>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Manages institution subscription tiers. Institutions start on the FREE tier
                    which gives them three free verifications and limited batch upload capacity.
                    They can upgrade to PAID tier which unlocks unlimited verifications and
                    prioritizes their batch processing.
                  </p>
                  <div className="p-4 bg-surface border border-surface-border mb-4">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Key Functions</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p><span className="text-accent">setTier</span>(bytes32 institutionId, uint8 tier) external onlyOwner</p>
                      <p><span className="text-accent">getTier</span>(bytes32 institutionId) external view returns (uint8)</p>
                      <p><span className="text-accent">addCredits</span>(address employer, uint256 amount) external onlyOwner</p>
                      <p><span className="text-accent">consumeCredit</span>(address employer) external returns (uint256 remaining)</p>
                      <p><span className="text-accent">getCredits</span>(address employer) external view returns (uint256)</p>
                    </div>
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <Cpu className="w-6 h-6 text-accent" />
                    <div>
                      <h3 className="text-xl font-bold text-accent">Groth16Verifier.sol</h3>
                      <span className="text-[10px] font-mono text-muted-subtle">packages/contracts/src/ZKVerifier.sol</span>
                    </div>
                  </div>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    This contract is not hand written. It is generated by SnarkJS during the
                    circuit setup phase. Running pnpm circuit:setup compiles the Circom circuit,
                    runs the phase 2 trusted setup, and exports a Solidity file that contains
                    the verifyingKey and the verifyProof function.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The generated contract uses the BN254 elliptic curve precompiled contracts
                    at addresses 0x06, 0x07, and 0x08 on the EVM. These precompiles handle the
                    pairing checks that verify the Groth16 proof. Each verification costs
                    approximately 236,000 gas.
                  </p>
                  <div className="p-4 bg-surface border border-surface-border mb-4">
                    <h4 className="font-bold text-foreground text-xs mb-2 uppercase tracking-wider">Gas Costs per Operation</h4>
                    <div className="space-y-1 font-mono text-[11px] text-muted">
                      <p>Batch registration (100 records): ~180,000 gas</p>
                      <p>Single proof verification: ~236,000 gas</p>
                      <p>Institution registration: ~85,000 gas</p>
                      <p>Nullifier revocation: ~42,000 gas</p>
                      <p>Paymaster deposit: ~65,000 gas + transfer</p>
                    </div>
                  </div>
                  <CodeBlock
                    filename="Auto generated by SnarkJS"
                    language="solidity"
                    code={`contract Groth16Verifier {
  using Pairing for *;
  VerifyingKey internal constant vk = VerifyingKey(
    Pairing.G1Point(/* alpha */),
    Pairing.G2Point(/* beta */),
    Pairing.G2Point(/* gamma */),
    Pairing.G2Point(/* delta */),
    Pairing.G1Point[](/* gamma_abc */)
  );
  function verifyProof(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[4] calldata input
  ) external view returns (bool) {
    // BN254 pairing checks
  }
}`}
                  />
                </div>
              </div>

              {/* ─── GAS OPTIMIZATIONS ─── */}
              <div className="border border-surface-border p-6 md:p-8 bg-surface-card w-full mt-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Zap className="text-accent" /> Gas Optimization Techniques</h3>
                <p className="text-muted text-sm leading-relaxed mb-4">
                  The contracts use several gas optimization patterns to keep verification costs low on Base Sepolia.
                </p>
                <div className="space-y-3">
                  {[
                    { technique: "Custom errors instead of require strings", saving: "Saves ~50 gas per revert path. Solidity 0.8.4+ supports error types which are cheaper than string storage." },
                    { technique: "Calldata layout optimized for proof submission", saving: "Proof arrays use calldata instead of memory, saving ~3 gas per word. The verifyProof function reads directly from calldata." },
                    { technique: "Batch operations in a single transaction", saving: "registerBatch processes up to 200 commitments in one call by using dynamic arrays. This saves the base transaction cost (~21,000 gas) per batch." },
                    { technique: "Storage packing for institution profiles", saving: "Institution struct packs address (20 bytes) + bool (1 byte) into a single storage slot. Saves ~2,000 gas per read/write." },
                  ].map(({ technique, saving }) => (
                    <div key={technique} className="p-4 border border-surface-border bg-surface">
                      <h4 className="font-bold text-foreground text-sm mb-1">{technique}</h4>
                      <p className="text-muted text-xs">{saving}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-surface-border p-6 md:p-8 bg-surface-card w-full mt-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><AlertTriangle className="text-accent" /> Security Considerations</h3>
                <div className="space-y-3 text-muted text-sm">
                  <div className="p-4 border border-yellow-500/20 bg-yellow-500/5">
                    <h4 className="font-bold text-yellow-200 text-sm mb-1">Trusted Setup Risk</h4>
                    <p className="text-xs">The Groth16 proving system requires a trusted setup. If the phase 2 setup is compromised, an attacker could forge proofs. Veridaq uses a random beacon from the Unix timestamp to destroy toxic waste. In production, a multi-party ceremony should be used.</p>
                  </div>
                  <div className="p-4 border border-yellow-500/20 bg-yellow-500/5">
                    <h4 className="font-bold text-yellow-200 text-sm mb-1">Nullifier Reuse</h4>
                    <p className="text-xs">The CredentialRegistry enforces unique nullifiers at the contract level. However, if the backend generates the same nullifier for two different records due to a bug, the second registration would revert. The backend must ensure nullifier uniqueness before submitting batches.</p>
                  </div>
                  <div className="p-4 border border-yellow-500/20 bg-yellow-500/5">
                    <h4 className="font-bold text-yellow-200 text-sm mb-1">Paymaster Drain</h4>
                    <p className="text-xs">The PaymasterVault holds ETH for each institution. If the validatePaymasterUserOp function has a bug, an attacker could drain the vault by submitting UserOperations that pass validation but execute expensive operations. The postOperation hook deducts actual gas spent, but validation must still be thorough.</p>
                  </div>
                </div>
              </div>

              <div className="border border-surface-border p-6 md:p-8 bg-surface-card w-full mt-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Route className="text-accent" /> Deployment Order</h3>
                <p className="text-muted text-sm leading-relaxed mb-4">
                  The contracts must be deployed in a specific order because of constructor
                  dependencies.
                </p>
                <div className="space-y-2 font-mono text-xs text-muted">
                  <div className="flex items-center gap-3 p-2 border border-surface-border/50">
                    <span className="text-accent font-bold">1.</span>
                    <span>SubscriptionManager</span>
                    <span className="text-muted-subtle">No dependencies</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 border border-surface-border/50">
                    <span className="text-accent font-bold">2.</span>
                    <span>InstitutionRegistry</span>
                    <span className="text-muted-subtle">No dependencies</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 border border-surface-border/50">
                    <span className="text-accent font-bold">3.</span>
                    <span>CredentialRegistry</span>
                    <span className="text-muted-subtle">Depends on InstitutionRegistry</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 border border-surface-border/50">
                    <span className="text-accent font-bold">4.</span>
                    <span>RevocationRegistry</span>
                    <span className="text-muted-subtle">No dependencies</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 border border-surface-border/50">
                    <span className="text-accent font-bold">5.</span>
                    <span>Groth16Verifier</span>
                    <span className="text-muted-subtle">Generated after circuit setup</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 border border-surface-border/50">
                    <span className="text-accent font-bold">6.</span>
                    <span>PaymasterVault</span>
                    <span className="text-muted-subtle">Depends on EntryPoint address</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ZKP CIRCUIT ─── */}
          {activeTab === "zkp" && (
            <motion.div key="zkp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-12 w-full max-w-full">
              <header className="border-b border-surface-border pb-8">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-sm bg-accent/10 text-accent text-xs font-mono mb-6 border border-accent/20">SECTION 04</div>
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-foreground tracking-tight break-words">Zero Knowledge Circuit.</h1>
                <p className="text-lg text-muted font-light leading-relaxed">
                  The circuit is written in Circom 2.0.8 and compiles to an R1CS constraint system
                  with approximately 45,000 constraints. It uses the Groth16 proving system and
                  Poseidon hashing from circomlib. The circuit is the core cryptographic component
                  that makes Veridaq's privacy guarantees possible.
                </p>
              </header>

              <div className="space-y-8 w-full">
                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Key className="text-accent" /> Circuit Inputs</h3>
                  <p className="text-muted text-sm leading-relaxed mb-6">
                    The circuit accepts eight private inputs and four public inputs. The private
                    inputs are known only to the backend and are destroyed after proof generation.
                    The public inputs are visible on chain and are submitted as part of the
                    verification transaction.
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-4 border border-surface-border bg-surface">
                      <h4 className="font-bold text-accent mb-3 text-sm">Private Inputs (8)</h4>
                      <ul className="space-y-2 text-xs font-mono text-muted">
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>nameHash</span>
                          <span className="text-muted-subtle">Poseidon of student name</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>matricHash</span>
                          <span className="text-muted-subtle">Poseidon of matric number</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>cgpa</span>
                          <span className="text-muted-subtle">Integer scaled by 100</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>classification</span>
                          <span className="text-muted-subtle">Integer 0 to 4</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>courseHash</span>
                          <span className="text-muted-subtle">Poseidon of course code</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>graduationYear</span>
                          <span className="text-muted-subtle">Four digit year</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>blindingFactor</span>
                          <span className="text-accent">Random 256 bit scalar</span>
                        </li>
                        <li className="flex justify-between">
                          <span>institutionKey</span>
                          <span className="text-muted-subtle">Unique per institution</span>
                        </li>
                      </ul>
                    </div>
                    <div className="p-4 border border-surface-border bg-surface">
                      <h4 className="font-bold text-foreground mb-3 text-sm">Public Inputs (4)</h4>
                      <ul className="space-y-2 text-xs font-mono text-muted">
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span className="text-accent">commitment</span>
                          <span className="text-muted-subtle">Hash stored on chain</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span className="text-accent">nullifier</span>
                          <span className="text-muted-subtle">Prevents double use</span>
                        </li>
                        <li className="flex justify-between border-b border-surface-border/30 pb-1">
                          <span>claimType</span>
                          <span className="text-muted-subtle">Integer 1 to 6</span>
                        </li>
                        <li className="flex justify-between">
                          <span>threshold</span>
                          <span className="text-muted-subtle">Numeric boundary</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Zap className="text-accent" /> Constraint System</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The circuit enforces three categories of constraints. First, the commitment
                    must equal the Poseidon hash of all seven private inputs plus the blinding
                    factor. This proves that the backend possesses the original data that produced
                    the on chain commitment.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Second, the nullifier must equal the Poseidon hash of the matriculation number
                    and the institution key. This binds each credential to a specific institution
                    and prevents the same credential from being verified multiple times.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Third, the claim decoder must output 1, meaning the claimed condition is
                    satisfied. The claim type determines which decoder template is used. Type 5
                    checks CGPA against a threshold. Type 2 checks degree classification. Type 6
                    checks course specific completion.
                  </p>
                  <CodeBlock
                    filename="credential.circom"
                    language="circom"
                    code={`pragma circom 2.0.0;
include "poseidon.circom";

template CredentialVerifier() {
  // 8 private inputs
  signal input nameHash;
  signal input matricHash;
  signal input cgpa;
  signal input classification;
  signal input courseHash;
  signal input graduationYear;
  signal input blindingFactor;
  signal input institutionKey;

  // 4 public inputs
  signal input commitment;
  signal input nullifier;
  signal input claimType;
  signal input threshold;

  // Constraint 1: commitment binding
  component hasher = Poseidon(7);
  hasher.inputs[0] <== nameHash;
  hasher.inputs[1] <== matricHash;
  hasher.inputs[2] <== cgpa;
  hasher.inputs[3] <== classification;
  hasher.inputs[4] <== courseHash;
  hasher.inputs[5] <== graduationYear;
  hasher.inputs[6] <== blindingFactor;
  hasher.out === commitment;

  // Constraint 2: nullifier binding
  component nullifierHasher = Poseidon(2);
  nullifierHasher.inputs[0] <== matricHash;
  nullifierHasher.inputs[1] <== institutionKey;
  nullifierHasher.out === nullifier;

  // Constraint 3: claim satisfaction
  component claim = ClaimDecoder(claimType);
  claim.cgpa <== cgpa;
  claim.classification <== classification;
  claim.courseHash <== courseHash;
  claim.graduationYear <== graduationYear;
  claim.threshold <== threshold;
  claim.out === 1;
}`}
                  />
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><GanttChartSquare className="text-accent" /> Claim Types</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The circuit supports six claim types. Each type checks a different aspect of
                    the student's academic record. The employer selects which claim type to verify
                    when submitting a verification request.
                  </p>
                  <div className="space-y-2 font-mono text-xs text-muted">
                    {[
                      { type: 1, title: "Programme Completion", check: "graduationYear == threshold" },
                      { type: 2, title: "Minimum Lower Second Class", check: "classification >= 2" },
                      { type: 3, title: "Minimum Upper Second Class", check: "classification >= 3" },
                      { type: 4, title: "First Class Honours", check: "classification == 4" },
                      { type: 5, title: "CGPA Above Threshold", check: "cgpa >= threshold" },
                      { type: 6, title: "Course Specific Completion", check: "courseHash matches AND passing grade" },
                    ].map(({ type, title, check }) => (
                      <div key={type} className="flex items-center gap-3 p-2 border border-surface-border/50">
                        <span className="text-accent font-bold">{type}</span>
                        <span>{title}</span>
                        <span className="text-muted-subtle ml-auto">{check}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Binary className="text-accent" /> Constraint Breakdown</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The circuit's approximately 45,000 R1CS constraints are distributed across
                    several categories. Understanding the breakdown helps with debugging and
                    optimization.
                  </p>
                  <div className="space-y-2">
                    {[
                      { category: "Poseidon hash (commitment + nullifier)", constraints: "~3,200", percent: "7%" },
                      { category: "Claim decoder routing", constraints: "~500", percent: "1%" },
                      { category: "CGPA comparison (greater-than-or-equal)", constraints: "~4,000", percent: "9%" },
                      { category: "Classification comparison", constraints: "~2,000", percent: "4%" },
                      { category: "Course hash equality check", constraints: "~500", percent: "1%" },
                      { category: "Signal routing and template instantiation", constraints: "~34,800", percent: "78%" },
                    ].map(({ category, constraints, percent }) => (
                      <div key={category} className="flex items-center gap-3 p-2 border border-surface-border/50 text-xs font-mono text-muted">
                        <span className="flex-1">{category}</span>
                        <span className="text-accent">{constraints}</span>
                        <span className="text-muted-subtle w-10 text-right">{percent}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Activity className="text-accent" /> Performance</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The circuit compiles to approximately 45,000 R1CS constraints. Proof generation
                    using SnarkJS fullProve takes approximately 0.7 seconds on a modern CPU. The
                    proving key is approximately 45 MB. The verification key is approximately 2 KB.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    On chain verification costs approximately 236,000 gas on Base Sepolia. At
                    current gas prices, this is approximately 0.01 USD per verification. The
                    circuit uses Poseidon instead of keccak256 because Poseidon is approximately
                    100 times more efficient inside arithmetic circuits. Using keccak256 would
                    increase the constraint count to several million and make proof generation
                    impractical.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "R1CS Constraints", value: "~45,000" },
                      { label: "Proof Generation", value: "~0.7s" },
                      { label: "On-Chain Gas", value: "~236k" },
                      { label: "Proof Size", value: "~256 bytes" },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 border border-surface-border bg-surface text-center">
                        <div className="text-accent font-mono text-sm font-bold">{value}</div>
                        <div className="text-muted-subtle text-[10px] uppercase tracking-wider mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── BACKEND API ─── */}
          {activeTab === "backend" && (
            <motion.div key="backend" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-12 w-full max-w-full">
              <header className="border-b border-surface-border pb-8">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-sm bg-accent/10 text-accent text-xs font-mono mb-6 border border-accent/20">SECTION 05</div>
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-foreground tracking-tight break-words">API and Backend.</h1>
                <p className="text-lg text-muted font-light leading-relaxed">
                  The backend is built with Fastify 5 and TypeScript. It exposes approximately 60
                  routes across auth, institution, employer, verification, admin, and payment
                  modules. Every route validates its input with Zod before executing business logic.
                </p>
              </header>

              <div className="space-y-8 w-full">
                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><ShieldCheck className="text-accent" /> Authentication</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Authentication uses short lived access tokens and long lived refresh tokens. The
                    access token expires after 15 minutes and is stored in memory on the frontend.
                    The refresh token expires after 7 days and is stored in an httpOnly cookie that
                    JavaScript cannot read.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Login endpoints are rate limited to 5 attempts per IP address per 15 minutes.
                    Passwords are hashed with bcryptjs at cost factor 12. The auth service supports
                    three roles: admin, institution, and employer. Each role has its own login route
                    and JWT payload format.
                  </p>
                  <CodeBlock
                    filename="Auth plugin decorates Fastify instance"
                    code={`app.decorate('authenticate', async (request, reply) => {
  try {
    const token = request.cookies.accessToken
      ?? request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('Missing token');
    const payload = jwt.verify(token, config.JWT_SECRET);
    request.jwtPayload = payload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
});

app.decorate('requireInstitution', async (request, reply) => {
  await app.authenticate(request, reply);
  if (request.jwtPayload.role !== 'INSTITUTION') {
    return reply.status(403).send({ error: 'Institution access required' });
  }
});`}
                  />
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Route className="text-accent" /> Route Structure</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Routes are organized by domain. Each domain has its own file under src/routes.
                    All routes are registered in server.ts with a /api prefix. The complete route
                    table is shown below.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse mb-6">
                      <thead>
                        <tr className="border-b border-surface-border">
                          <th className="text-left p-2 text-muted-subtle font-bold uppercase tracking-wider">Method</th>
                          <th className="text-left p-2 text-muted-subtle font-bold uppercase tracking-wider">Route</th>
                          <th className="text-left p-2 text-muted-subtle font-bold uppercase tracking-wider">Auth</th>
                          <th className="text-left p-2 text-muted-subtle font-bold uppercase tracking-wider">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["POST", "/api/auth/institution/login", "None", "Institution login"],
                          ["POST", "/api/auth/employer/login", "None", "Employer login"],
                          ["POST", "/api/auth/admin/login", "None", "Admin login"],
                          ["POST", "/api/auth/refresh", "Cookie", "Refresh access token"],
                          ["POST", "/api/auth/logout", "All", "Clear session"],
                          ["GET", "/api/institution/profile", "INSTITUTION", "Get institution profile"],
                          ["PATCH", "/api/institution/profile", "INSTITUTION", "Update institution profile"],
                          ["POST", "/api/institution/batch/upload", "INSTITUTION", "Upload credential batch (multipart)"],
                          ["GET", "/api/institution/batch/status/:jobId", "INSTITUTION", "Poll batch processing status"],
                          ["GET", "/api/institution/batches", "INSTITUTION", "List batch history"],
                          ["GET", "/api/institution/claims", "INSTITUTION", "List credential claims"],
                          ["GET", "/api/institution/earnings", "INSTITUTION", "Get earnings summary"],
                          ["GET", "/api/institution/earnings/transactions", "INSTITUTION", "List earnings transactions"],
                          ["POST", "/api/institution/earnings/withdraw", "INSTITUTION", "Withdraw earnings"],
                          ["PATCH", "/api/institution/employer-access", "INSTITUTION", "Toggle employer access"],
                          ["GET", "/api/employer/profile", "EMPLOYER", "Get employer profile"],
                          ["GET", "/api/employer/credits", "EMPLOYER", "Get credit balance"],
                          ["GET", "/api/employer/history", "EMPLOYER", "List verification history"],
                          ["POST", "/api/verify/request", "EMPLOYER", "Submit verification request"],
                          ["GET", "/api/verify/request/:id", "EMPLOYER", "Get verification status"],
                          ["GET", "/api/verify/history", "EMPLOYER", "List verification requests"],
                          ["GET", "/api/admin/institutions", "ADMIN", "List all institutions"],
                          ["POST", "/api/admin/institution/:id/approve", "ADMIN", "Approve institution KYC"],
                          ["GET", "/api/admin/employers", "ADMIN", "List all employers"],
                          ["GET", "/api/admin/earnings", "ADMIN", "Platform earnings summary"],
                          ["GET", "/api/admin/earnings/gas-pool", "ADMIN", "Gas pool balance and history"],
                          ["GET", "/api/admin/earnings/institutions", "ADMIN", "Per-institution earnings"],
                          ["POST", "/api/payment/create", "EMPLOYER", "Create credit purchase intent"],
                          ["POST", "/api/payment/webhook", "None", "Payment provider webhook"],
                        ].map(([method, route, auth, desc]) => (
                          <tr key={route} className="border-b border-surface-border/30">
                            <td className={`p-2 font-bold ${method === "POST" ? "text-accent" : "text-foreground"}`}>{method}</td>
                            <td className="p-2 text-muted font-mono text-[11px]">{route}</td>
                            <td className="p-2 text-muted-subtle text-[10px]">{auth}</td>
                            <td className="p-2 text-muted text-[11px]">{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Activity className="text-accent" /> Batch Processing</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    Batch uploads are processed asynchronously through BullMQ. When an institution
                    uploads an XLSX file, the API server validates the file format, parses the
                    records, and pushes a job to the batch queue. The worker picks up the job,
                    processes each record, and updates the job status.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The worker hashes each student record through Poseidon, encrypts the raw data
                    with AES 256 GCM, stores the encrypted record in PostgreSQL, and collects the
                    commitments and nullifiers. Once all records are processed, the worker calls
                    the CredentialRegistry contract to submit the entire batch in a single
                    transaction.
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    The frontend polls the batch status endpoint until the job completes. If the
                    job fails, the error message is stored and displayed in the institution's batch
                    history table.
                  </p>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><ScrollText className="text-accent" /> Database Schema</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The Prisma schema defines models for institutions, employers, admins, claim
                    definitions, credential batches, student records, verification requests,
                    payments, and audit logs. Student records are encrypted at rest. The
                    encryption key is stored in the environment and never touches the database.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The institution model stores the encrypted institution key, the on chain ID,
                    the subscription tier, the KYC approval status, and the alsoEmployer flag.
                    The employer model tracks free verifications remaining, purchased credits,
                    the wallet address for ERC 4337 tracking, and the optional institutionId
                    link for institution-as-employer deployments.
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The verification request model tracks the full lifecycle of each verification
                    from PENDING through PROCESSING to VERIFIED or REJECTED. Each request stores
                    the proof, the public signals, the transaction hash, and the result metadata.
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    The earnings model tracks the revenue share: each verification credit consumed
                    generates an EarningTransaction linked to the institution, with the platform
                    share, institution share, and gas pool share recorded separately. Withdrawals
                    are tracked in the Withdrawal model with status (PENDING, COMPLETED, FAILED)
                    and method (CRYPTO, FIAT).
                  </p>
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><AlertTriangle className="text-accent" /> Error Handling</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">
                    The backend uses a consistent error handling pattern. All errors are returned
                    in a standard format: HTTP status code, error code, and human-readable message.
                    Zod validation errors include a details array with field-level messages.
                  </p>
                  <CodeBlock
                    filename="Standard error response format"
                    code={`// 400 — Validation Error
{ "error": "ValidationError",
  "message": "Request body validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Minimum 8 characters" }
  ]
}

// 401 — Authentication Error
{ "error": "Unauthorized", "message": "Invalid or expired token" }

// 403 — Authorization Error
{ "error": "Forbidden", "message": "Institution access required" }

// 404 — Not Found
{ "error": "NotFound", "message": "Credential record not found" }

// 429 — Rate Limited
{ "error": "RateLimited", "message": "Too many requests. Try again in 900 seconds" }

// 500 — Internal Error (never exposes stack traces in production)
{ "error": "InternalError", "message": "An unexpected error occurred" }`}
                  />
                </div>

                <div className="border border-surface-border bg-surface-card p-6 md:p-8 w-full">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Terminal className="text-accent" /> Server Startup</h3>
                  <CodeBlock
                    filename="server.ts"
                    code={`import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { config } from './config/index.js';
import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { authRoutes } from './routes/auth.js';
import { institutionRoutes } from './routes/institution.js';
import { verificationRoutes } from './routes/verification.js';
import { adminRoutes } from './routes/admin.js';
import { paymentRoutes } from './routes/payment.js';
import { earningsRoutes } from './routes/earnings.js';

const app = Fastify({ logger: {
  transport: { target: 'pino-pretty' },
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
}});

// Plugin registration order matters:
// 1. Database and cache first
// 2. Authentication plugin
// 3. Route modules
await app.register(prismaPlugin);
await app.register(redisPlugin);
await app.register(authPlugin);

// Route registration with /api prefix
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(institutionRoutes, { prefix: '/api/institution' });
await app.register(verificationRoutes, { prefix: '/api/verify' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(paymentRoutes, { prefix: '/api/payment' });
await app.register(earningsRoutes, { prefix: '/api/institution' });

// Health check (no auth required)
app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// Start listening
await app.listen({ port: config.PORT, host: '0.0.0.0' });
app.log.info(\`Server running on port \${config.PORT}\`);`}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div className="mt-16 pt-8 pb-12 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4 w-full" key="pagination-controls">
            {prevTab ? (
              <button
                onClick={() => { setActiveTab(prevTab?.id ?? ""); window.scrollTo({ top: 0, behavior: 'smooth' }) } }
                className="w-full sm:w-1/2 p-6 border border-surface-border bg-surface-card hover:border-accent hover:bg-accent/5 transition-all text-left flex flex-col group min-w-0"
              >
                <span className="text-[10px] text-muted-subtle mb-2 uppercase tracking-widest flex items-center gap-2 font-bold"><ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Previous</span>
                <span className="font-bold text-foreground text-lg truncate w-full">{prevTab?.label}</span>
                <span className="text-muted text-sm mt-1 truncate w-full">{prevTab?.desc}</span>
              </button>
            ) : <div className="hidden sm:block sm:w-1/2" />}

            {nextTab ? (
              <button
                onClick={() => { setActiveTab(nextTab?.id ?? ""); window.scrollTo({ top: 0, behavior: 'smooth' }) } }
                className="w-full sm:w-1/2 p-6 border border-surface-border bg-surface-card hover:border-accent hover:bg-accent/5 transition-all text-right flex flex-col items-end group min-w-0"
              >
                <span className="text-[10px] text-muted-subtle mb-2 uppercase tracking-widest flex items-center gap-2 font-bold">Next <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" /></span>
                <span className="font-bold text-foreground text-lg truncate w-full">{nextTab?.label}</span>
                <span className="text-muted text-sm mt-1 truncate w-full">{nextTab?.desc}</span>
              </button>
            ) : <div className="hidden sm:block sm:w-1/2" />}
          </div>

          </AnimatePresence>
        </main>
      </div>
   </div>
  )
}
