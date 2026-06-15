"use client"
import {
  BookOpen, ChevronRight, CodeSquare, Database, Github, Layers, Shield, Cpu, FileCode2,
  Workflow, Terminal, Lock, Zap, BookMarked, ExternalLink, FileText, Search, HelpCircle,
  Globe, Wifi, Wallet, Hash, Network, Key, UserCheck, ScrollText, Library
} from "lucide-react"
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
      desc: "EVM-equivalent L2 by Coinbase. Low gas costs, fast finality (2 second block time), and native BN254 precompiles at addresses 0x06, 0x07, and 0x08 for efficient Groth16 proof verification. Chain ID: 84532.",
    },
    {
      category: "Smart Contracts",
      tech: "Solidity 0.8.28 + Foundry",
      desc: "Six contracts: InstitutionRegistry, CredentialRegistry, RevocationRegistry, SubscriptionManager, PaymasterVault, Groth16Verifier. Fuzz-tested via Foundry. All use custom errors instead of require strings for lower gas costs.",
    },
    {
      category: "ZKP Compilation",
      tech: "Circom 2.0.8 + SnarkJS 0.7",
      desc: "Groth16 proof system. Circuit compiles to R1CS with approximately 45,000 constraints. Proof generation takes ~0.7 seconds on a modern CPU. Proving key is ~45 MB. Verification key is ~2 KB.",
    },
    {
      category: "Backend Engine",
      tech: "Fastify 5 + Node.js 22",
      desc: "TypeScript 5.8 with strict mode. Zod-validated environment and request bodies. Prisma 6 ORM with PostgreSQL 16. BullMQ 5 with Redis 7 for async job processing. viem 2 for blockchain interaction.",
    },
    {
      category: "Account Abstraction",
      tech: "ERC-4337 v0.6 EntryPoint",
      desc: "PaymasterVault implements IPaymaster interface. Institutions submit UserOperations without holding ETH. The Paymaster sponsors gas and deducts from the institution's deposited balance. EntryPoint address: 0x0000000071727De22E5E9d8bA f0eD5fA35Ee7b8.",
    },
    {
      category: "Commitment Hash",
      tech: "Poseidon (circomlibjs)",
      desc: "ZKP-friendly hash function designed for arithmetic circuits. Approximately 100 constraints per permutation compared to ~30,000 for SHA-256. Uses 3-round sponge construction with BN254 field elements.",
    },
    {
      category: "Frontend Framework",
      tech: "Next.js 15 + React 19",
      desc: "App Router with server and client components. TanStack Query for data fetching and cache management. shadcn/ui primitives with Tailwind CSS 3.4. Framer Motion 11 for page transitions. Three portals sharing one codebase.",
    },
    {
      category: "DevOps",
      tech: "Docker Compose + pnpm Workspaces",
      desc: "Single root package.json with pnpm workspaces. Docker Compose for local PostgreSQL 16 and Redis 7. Production deploys use Neon for PostgreSQL and Upstash for Redis. Monorepo structure with shared TypeScript config.",
    },
  ]

  const faqItems = [
    {
      q: "How does Veridaq differ from traditional blockchain credential platforms?",
      a: "Most blockchain credential platforms put the credential data itself on-chain, sometimes encrypted but often in plaintext. Veridaq never puts student data on-chain. Only a Poseidon hash commitment (32 bytes) goes to the ledger. The raw data stays on the institution's backend server, encrypted with AES-256-GCM, and is only decrypted in memory during proof generation. This means Veridaq is GDPR-compliant by architecture, not by policy.",
    },
    {
      q: "What happens if the institution's backend goes offline?",
      a: "Existing on-chain commitments remain valid. However, no new proofs can be generated because the encrypted private data is stored on the institution's backend. The employer sees NOT VERIFIED for any new request. The institution can restore service by bringing their backend back online with the same encryption key and database.",
    },
    {
      q: "Can an employer verify a credential without the institution's cooperation?",
      a: "No. The proof generation requires the encrypted student data that only the institution's backend holds. The employer cannot generate a proof on their own. This is intentional: it prevents unauthorized verification and gives the institution control over who can access their data.",
    },
    {
      q: "How much does it cost to verify one credential?",
      a: "The on-chain verification costs approximately 236,000 gas on Base Sepolia. At current gas prices (approximately 0.1 gwei) and ETH at $1,669, this is about $0.01 per verification. Employers buy credit packs starting at $15 for 10 verifications. The platform covers on-chain gas costs from its revenue share.",
    },
    {
      q: "What happens if a student's degree is revoked?",
      a: "The institution submits the credential's nullifier to the RevocationRegistry contract. Once revoked, the credential can never be verified again, regardless of proof validity. The RevocationRegistry is append-only and entries cannot be removed.",
    },
    {
      q: "Why Base Sepolia and not Ethereum Mainnet?",
      a: "Base Sepolia is an EVM-equivalent L2 with significantly lower gas costs than Ethereum Mainnet. It also has native BN254 precompiles for efficient Groth16 verification. The L2 inherits Ethereum's security through OP Stack fraud proofs. For production, Veridaq would deploy to Base Mainnet.",
    },
    {
      q: "How are proofs generated? Can the backend fabricate a valid proof?",
      a: "The backend runs SnarkJS fullProve which takes the private inputs and the circuit WASM to produce a Groth16 proof. The backend cannot fabricate a valid proof without a valid witness that satisfies all circuit constraints. The on-chain verifier checks the proof's mathematical soundness using BN254 pairing precompiles. If the backend does not possess the correct private data, the proof will be rejected.",
    },
    {
      q: "What claim types are supported?",
      a: "Six claim types: Programme Completion, Minimum Lower Second Class (classification >= 2), Minimum Upper Second Class (classification >= 3), First Class Honours (classification == 4), CGPA Above Threshold, and Course Specific Completion. Employers select the claim type when submitting a verification request.",
    },
    {
      q: "Is there a mobile app?",
      a: "Not yet. The frontend is a responsive web application built with Next.js 15 that works on mobile browsers. A React Native mobile app is in the roadmap for future development.",
    },
    {
      q: "Can Veridaq be deployed to a different blockchain?",
      a: "Yes. The contracts are standard Solidity and can be deployed to any EVM-compatible chain that supports the BN254 precompiles. The backend configuration has a CHAIN_ID variable. To switch chains, update the RPC URL and chain ID in .env, re-deploy the contracts, and update the addresses.",
    },
  ]

  const glossary = [
    { term: "BN254", def: "An elliptic curve used by Ethereum for precompiled pairing checks. Also known as BN256 or alt_bn128. Supports efficient Groth16 proof verification at addresses 0x06, 0x07, and 0x08." },
    { term: "Blinding Factor", def: "A random 256-bit scalar added to the Poseidon hash input. Ensures that two identical student records produce different commitments. Prevents brute-force matching of on-chain commitments against known student data." },
    { term: "BullMQ", def: "A Redis-backed job queue library for Node.js. Veridaq uses it to process batch uploads and proof generation asynchronously, keeping the API server responsive." },
    { term: "Circom", def: "A domain-specific language for writing arithmetic circuits that compile to R1CS constraint systems. Veridaq's credential circuit is written in Circom 2.0.8." },
    { term: "Commitment (Hash)", def: "A one-way cryptographic value submitted on-chain. The commitment binds the prover to specific data without revealing it. Veridaq uses Poseidon hash commitments." },
    { term: "ERC-4337", def: "The Ethereum account abstraction standard that allows smart contract wallets (accounts) to initiate transactions. Veridaq uses it so institutions can submit batches without holding ETH." },
    { term: "Groth16", def: "A zero-knowledge proving system introduced by Jens Groth in 2016. Produces constant-size proofs (3 group elements) with constant-time verification. Requires a trusted setup." },
    { term: "Nullifier", def: "A unique public value derived from the credential data. Prevents the same credential from being verified more than once. Also used for revocation." },
    { term: "Paymaster", def: "An ERC-4337 entity that sponsors gas fees for UserOperations. Veridaq's PaymasterVault maintains per-institution ETH balances and deducts gas costs after execution." },
    { term: "Poseidon", def: "A ZKP-friendly hash function designed by Grassi, Khovratovich, and others. Highly efficient inside arithmetic circuits. Veridaq uses it for all credential commitments." },
    { term: "R1CS", def: "Rank-1 Constraint System. The intermediate representation that Circom compiles to. SnarkJS converts R1CS to a quadratic arithmetic program (QAP) for Groth16." },
    { term: "SnarkJS", def: "A JavaScript library for generating and verifying zk-SNARK proofs. Veridaq uses it for off-chain proof generation and on-chain verification key export." },
    { term: "UserOperation", def: "An ERC-4337 data structure representing a transaction to be executed by an account. Contains sender, calldata, gas limits, and signature." },
    { term: "viem", def: "A TypeScript library for Ethereum blockchain interaction. Veridaq uses viem 2 for all contract calls and transaction management." },
    { term: "Witness", def: "The set of all circuit signals (inputs and intermediate values) that satisfy the constraints. The prover computes the witness before generating the proof." },
  ]

  const readingList = [
    { title: "Groth16: On the Size of Pairing-Based Non-Interactive Arguments", author: "Jens Groth (2016)", url: "https://eprint.iacr.org/2016/260" },
    { title: "Poseidon: A New Hash Function for Zero-Knowledge Proof Systems", author: "Grassi, Khovratovich, Rechberger, Roy, Schofnegger (2021)", url: "https://eprint.iacr.org/2019/458" },
    { title: "Circom 2: A Circuit Compiler for Zero-Knowledge Proofs", author: "iden3 (2023)", url: "https://docs.circom.io/" },
    { title: "ERC-4337: Account Abstraction Using Alt Mempool", author: "Buterin, et al. (2023)", url: "https://eips.ethereum.org/EIPS/eip-4337" },
    { title: "Base: A Secure, Low-Cost Ethereum L2", author: "Coinbase (2024)", url: "https://docs.base.org/" },
    { title: "Hermez: Powers of Tau Ceremony", author: "Hermez Network (2022)", url: "https://hermez.io/" },
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
          Open-core architecture. Source code, whitepapers, protocol specs, network scanners, glossary, and frequently asked questions.
        </p>

        {/* ═══════════════ RESOURCE CARDS ═══════════════ */}
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
                  Full architectural reference covering smart contracts, circuits, API topology, proof lifecycle, and the complete security model.
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
                  Step-by-step setup guides, protocol outlines, API routes, contract deployment, circuit compilation, and troubleshooting.
                </p>
              </div>
            </Link>

            <Link
              href="/zkp"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <Cpu className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 font-bold text-foreground transition-colors">
                  ZKP Circom Definitions
                </h3>
                <p className="text-sm text-muted">
                  Deep-dive into the cryptographic commitments, Groth16 proof logic, private vs public signals, nullifiers, claim types, and trusted setup ceremony.
                </p>
              </div>
            </Link>

            <Link
              href="/privacy"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <Shield className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 font-bold text-foreground transition-colors">
                  Privacy Policy
                </h3>
                <p className="text-sm text-muted">
                  Full privacy policy covering encryption architecture, key management, GDPR rights, data retention, incident response, and third-party data processors.
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
                  Foundry-based Solidity repository covering institution registry, credential registry, revocation, subscriptions, and the Paymaster vault.
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
                  Browse live verification transactions, contract interactions, and proof submissions on the Base Sepolia testnet.
                </p>
              </div>
            </a>

            <a
              href="https://docs.circom.io/"
              target="_blank"
              rel="noreferrer"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <FileCode2 className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 flex items-center gap-2 font-bold text-foreground transition-colors">
                  Circom Documentation{" "}
                  <span className="bg-surface-border rounded px-2 py-0.5 font-mono text-[10px] text-foreground">EXTERNAL</span>
                </h3>
                <p className="text-sm text-muted">
                  Official Circom 2 documentation covering the language, compiler, template libraries, and best practices for circuit development.
                </p>
              </div>
            </a>

            <a
              href="https://book.getfoundry.sh/"
              target="_blank"
              rel="noreferrer"
              className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-6 transition-colors"
            >
              <div className="bg-void border-surface-border group-hover:bg-accent/10 rounded border p-3 transition-colors">
                <Terminal className="group-hover:text-accent h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="group-hover:text-accent mb-1 flex items-center gap-2 font-bold text-foreground transition-colors">
                  Foundry Book{" "}
                  <span className="bg-surface-border rounded px-2 py-0.5 font-mono text-[10px] text-foreground">EXTERNAL</span>
                </h3>
                <p className="text-sm text-muted">
                  Official Foundry documentation. Forge, Cast, Anvil, and Chisel — the full Solidity development toolchain used by Veridaq.
                </p>
              </div>
            </a>
          </div>
        </ScrollReveal>

        {/* ═══════════════ PROTOCOL STACK ═══════════════ */}
        <ScrollReveal direction="up" delay={0.1}>
          <h2 className="border-surface-border mb-6 border-t pt-12 text-2xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
            <Workflow className="text-accent h-6 w-6" /> Protocol Stack Architecture
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

        {/* ═══════════════ GLOSSARY ═══════════════ */}
        <ScrollReveal direction="up" delay={0.15}>
          <h2 className="border-surface-border mb-6 border-t pt-12 text-2xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
            <BookMarked className="text-accent h-6 w-6" /> Glossary of Terms
          </h2>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            Key technical terms used throughout the Veridaq documentation and codebase.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {glossary.map(({ term, def }) => (
              <div key={term} className="border-surface-border rounded border bg-surface-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="text-accent h-3.5 w-3.5 shrink-0" />
                  <h4 className="font-bold text-foreground font-mono text-sm">{term}</h4>
                </div>
                <p className="text-muted text-xs leading-relaxed">{def}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* ═══════════════ FAQ ═══════════════ */}
        <ScrollReveal direction="up" delay={0.2}>
          <h2 className="border-surface-border mb-6 border-t pt-12 text-2xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
            <HelpCircle className="text-accent h-6 w-6" /> Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqItems.map(({ q, a }) => (
              <div key={q} className="border-surface-border rounded border bg-surface-card p-5">
                <h3 className="font-bold text-foreground text-sm mb-2 flex items-start gap-2">
                  <ChevronRight className="text-accent h-4 w-4 shrink-0 mt-0.5" />
                  {q}
                </h3>
                <p className="text-muted text-xs leading-relaxed pl-6">{a}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* ═══════════════ READING LIST ═══════════════ */}
        <ScrollReveal direction="up" delay={0.25}>
          <h2 className="border-surface-border mb-6 border-t pt-12 text-2xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
            <Library className="text-accent h-6 w-6" /> Further Reading
          </h2>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            Academic papers and official documentation that informed the design of Veridaq.
          </p>
          <div className="space-y-3">
            {readingList.map(({ title, author, url }) => (
              <a
                key={title}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="border-surface-border bg-surface-card hover:border-accent/50 group flex items-start gap-4 rounded-lg border p-4 transition-colors"
              >
                <FileText className="text-accent h-4 w-4 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-bold text-foreground text-sm group-hover:text-accent transition-colors break-words">{title}</h4>
                  <p className="text-muted-subtle text-xs mt-1">{author}</p>
                </div>
                <ExternalLink className="text-muted-subtle h-4 w-4 shrink-0 mt-0.5" />
              </a>
            ))}
          </div>
        </ScrollReveal>

        {/* ═══════════════ TOOLS ═══════════════ */}
        <ScrollReveal direction="up" delay={0.3}>
          <h2 className="border-surface-border mb-6 border-t pt-12 text-2xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
            <Zap className="text-accent h-6 w-6" /> Developer Tools and Utilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "Cast", desc: "Foundry's CLI for interacting with EVM contracts. Use it to query contract state and send transactions from the command line.", cmd: "cast call $ZK_VERIFIER \"owner()(address)\" --rpc-url $RPC_URL" },
              { title: "SnarkJS", desc: "JavaScript library for generating and verifying Groth16 proofs. Also exports Solidity verifier contracts.", cmd: "snarkjs groth16 fullprove input.json circuit.wasm circuit.zkey proof.json public.json" },
              { title: "Circom", desc: "Circuit compiler that converts Circom DSL to R1CS constraint systems and WASM witness generators.", cmd: "circom credential.circom --r1cs --wasm --output build/" },
              { title: "viem", desc: "TypeScript blockchain client. Used by the backend for all contract calls and transaction management.", cmd: "const tx = await client.writeContract({ address, abi, functionName, args })" },
            ].map(({ title, desc, cmd }) => (
              <div key={title} className="border-surface-border rounded border bg-surface-card p-5">
                <h3 className="font-bold text-foreground text-sm mb-1">{title}</h3>
                <p className="text-muted text-xs mb-3 leading-relaxed">{desc}</p>
                <pre className="font-mono text-[10px] text-accent bg-surface p-2 rounded border border-surface-border overflow-x-auto">{cmd}</pre>
              </div>
            ))}
          </div>
        </ScrollReveal>

      </div>
    </div>
  )
}
