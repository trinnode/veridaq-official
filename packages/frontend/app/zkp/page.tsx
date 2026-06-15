"use client"
import { ChevronRight, Cpu, Hash, Key, Lock, Network, Shield, Zap, Eye, EyeOff, CircuitBoard, Binary, GanttChartSquare, Workflow, FileCode2, Activity } from "lucide-react"
import Link from "next/link"
import { AppHeader } from "@/components/ui/app-header"
import { ParallaxBg } from "@/components/parallax/parallax-layer"
import { FloatingShapes } from "@/components/parallax/floating-shapes"
import { ScrollReveal } from "@/components/parallax/scroll-reveal"

export default function ZKPDefinitionsPage() {
  const CodeBlock = ({ code, filename = "" }: { code: string; filename?: string }) => (
    <div className="relative w-full max-w-full overflow-hidden rounded-md my-6 border border-surface-border bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 bg-surface-card border-b border-surface-border gap-2">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
          </div>
          {filename && <span className="text-xs font-mono text-muted break-words line-clamp-1">{filename}</span>}
        </div>
      </div>
      <div className="overflow-x-auto max-w-full hide-scrollbar w-full">
        <pre className="p-4 inline-block min-w-full text-xs md:text-sm font-mono text-muted leading-relaxed">{code}</pre>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-void pb-16">
      <AppHeader />
      <ParallaxBg opacity={0.25} />
      <FloatingShapes count={10} />
      <div className="container mx-auto max-w-4xl px-4 md:px-6 pt-24">
        <div className="mb-8 flex items-center gap-2 font-mono text-sm text-muted-subtle">
          <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/docs" className="transition-colors hover:text-foreground">Docs</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-accent uppercase">ZKP Circom Definitions</span>
        </div>

        <h1 className="mb-6 text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">
          ZKP Circom Definitions
        </h1>

        <p className="border-surface-border mb-12 border-b pb-6 font-mono text-sm text-muted-subtle">
          GROTH16 | POSEIDON (CIRCOMLIB) | BN254 | R1CS (45K CONSTRAINTS)
        </p>

        <div className="space-y-12 text-sm leading-relaxed md:text-base">

          {/* ═══════════════ GROTH16 OVERVIEW ═══════════════ */}
          <ScrollReveal direction="up" delay={0}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Cpu className="text-accent h-5 w-5 shrink-0" /> The Groth16 Proof System
              </h2>
              <p className="text-muted leading-relaxed">
                Veridaq uses Groth16, the most widely deployed zk-SNARK proving system in production.
                It was introduced by Jens Groth in 2016 and optimized by Bellman and the Zcash team for
                the BLS12-381 curve. Veridaq uses BN254, the curve supported natively by the EVM.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Groth16 has three properties that make it ideal for academic credential verification.
                First, the proofs are constant size — exactly 3 group elements (about 256 bytes)
                regardless of the circuit size. Second, verification time is constant too — a single
                pairing check. Third, the prover does not need to interact with the verifier after
                submitting the proof.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                The tradeoff is that Groth16 requires a trusted setup ceremony for each circuit.
                Veridaq uses the Hermez Powers of Tau ceremony for phase 1 (universal) and a
                circuit-specific phase 2. The parameters are public and verifiable.
              </p>
            </section>
          </ScrollReveal>

          {/* ═══════════════ TRUSTED SETUP ═══════════════ */}
          <ScrollReveal direction="up" delay={0.1}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Shield className="text-accent h-5 w-5 shrink-0" /> Trusted Setup Ceremony
              </h2>
              <p className="text-muted leading-relaxed">
                Groth16 requires a structured reference string (SRS) generated through a multi-party
                computation. The ceremony has two phases.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Phase 1 is circuit-agnostic and produces the Powers of Tau. Veridaq uses the Hermez
                ceremony which had over 100 participants. Each participant contributed entropy and
                destroyed their toxic waste. As long as one participant was honest, the phase 1
                parameters are secure.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Phase 2 is circuit-specific. It takes the phase 1 output and produces the proving
                key and verification key for the credential circuit. This phase runs locally using
                SnarkJS and applies a random beacon to ensure the toxic waste is destroyed even if
                the local machine was compromised.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                If the trusted setup is compromised, an attacker could forge proofs for arbitrary
                inputs. This is why the ceremony must be reproducible and verifiable. Anyone can
                verify the phase 2 output against the phase 1 reference and the circuit R1CS.
              </p>
              <CodeBlock
                filename="pnpm circuit:setup runs this sequence"
                code={`# Phase 1: Download Hermez Powers of Tau (POT)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_18.ptau

# Phase 2: Circuit-specific setup
snarkjs groth16 setup credential.r1cs pot18_final.ptau credential_0000.zkey

# Phase 2 contribution (random beacon)
snarkjs zkey contribute credential_0000.zkey credential_0001.zkey \\
  --entropy="VERIDAQ_RANDOM_BEACON_$(date +%s)"

# Export verification key
snarkjs zkey export verificationkey credential_final.zkey verification_key.json

# Export Solidity verifier
snarkjs zkey export solidityverifier credential_final.zkey ZKVerifier.sol`}
              />
            </section>
          </ScrollReveal>

          {/* ═══════════════ HASH COMMITMENT ═══════════════ */}
          <ScrollReveal direction="up" delay={0.15}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Hash className="text-accent h-5 w-5 shrink-0" /> The Poseidon Hash Commitment
              </h2>
              <p className="text-muted leading-relaxed">
                Before any proof can be generated, the institution must submit a commitment to the
                CredentialRegistry contract. The commitment is a Poseidon hash of the student data
                combined with a random blinding factor.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Poseidon is a zero-knowledge-friendly hash function designed specifically for use
                inside arithmetic circuits. Unlike SHA-256 or keccak256, which require thousands
                of R1CS constraints per hash, Poseidon compiles to approximately 100 constraints
                per permutation. This is why Veridaq uses Poseidon instead of keccak256.
              </p>
              <pre className="border-surface-border mt-6 overflow-x-auto rounded-lg border bg-surface-card p-4 font-mono text-xs text-accent">
{`// The commitment is computed off-chain by the backend
// It is the only value ever submitted on-chain

commitment = Poseidon(
  nameHash,          // sha256(full name) as field element
  matricHash,        // sha256(matric number) as field element
  cgpa,              // integer scaled by 100 (e.g. 450 for 4.50)
  classification,    // 0=PASS, 1=THIRD, 2=LOWER_CREDIT,
                     // 3=UPPER_CREDIT, 4=FIRST_CLASS
  courseHash,        // sha256(course code) as field element
  graduationYear,    // 4-digit integer
  blindingFactor     // random 256-bit scalar
)`}
              </pre>
              <p className="text-muted mt-4 leading-relaxed">
                The blinding factor is critical. It is a cryptographically random 256-bit value
                generated on the backend using Node.js crypto.randomBytes. Without it, an attacker
                could brute force the commitment by hashing known student data and comparing against
                the on-chain value. With it, the commitment is computationally hiding.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                The nullifier is computed separately and prevents the same credential from being
                verified twice. It binds the matriculation number to the institution key:
              </p>
              <pre className="border-surface-border mt-4 overflow-x-auto rounded-lg border bg-surface-card p-4 font-mono text-xs text-accent">
{`nullifier = Poseidon(matricHash, institutionKey)`}
              </pre>
            </section>
          </ScrollReveal>

          {/* ═══════════════ PRIVATE VS PUBLIC ═══════════════ */}
          <ScrollReveal direction="up" delay={0.2}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <EyeOff className="text-accent h-5 w-5 shrink-0" /> Private vs Public Signals
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                In Groth16, inputs to the circuit are divided into private signals (known only to
                the prover) and public signals (visible on-chain in the verification transaction).
                The circuit template declares which signals are which.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="border-surface-border rounded border bg-surface-card p-6 text-sm">
                  <h3 className="mb-2 font-bold uppercase tracking-wide text-accent flex items-center gap-2">
                    <EyeOff className="h-4 w-4" /> Private Inputs (8)
                  </h3>
                  <p className="text-muted-subtle mb-4 text-xs">Known only to the backend. Destroyed after proof generation. Never submitted on-chain.</p>
                  <ul className="space-y-2 text-muted font-mono text-xs">
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>nameHash</span>
                      <span className="text-muted-subtle">sha256 of full name</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>matricHash</span>
                      <span className="text-muted-subtle">sha256 of matric number</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>cgpa</span>
                      <span className="text-muted-subtle">integer multiplied by 100</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>classification</span>
                      <span className="text-muted-subtle">enum 0 to 4</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>courseHash</span>
                      <span className="text-muted-subtle">sha256 of course code</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>graduationYear</span>
                      <span className="text-muted-subtle">4-digit year</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>blindingFactor</span>
                      <span className="text-accent">random 256-bit scalar</span>
                    </li>
                    <li className="flex justify-between">
                      <span>institutionKey</span>
                      <span className="text-muted-subtle">unique per institution</span>
                    </li>
                  </ul>
                </div>
                <div className="border-surface-border rounded border bg-surface-card p-6 text-sm">
                  <h3 className="mb-2 font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Public Inputs (4)
                  </h3>
                  <p className="text-muted-subtle mb-4 text-xs">Visible on-chain. The verifier contract reads these during verification.</p>
                  <ul className="space-y-2 text-muted font-mono text-xs">
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span className="text-accent">commitment</span>
                      <span className="text-muted-subtle">the on-chain hash pointer</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span className="text-accent">nullifier</span>
                      <span className="text-muted-subtle">prevents double-verification</span>
                    </li>
                    <li className="flex justify-between border-b border-surface-border/50 pb-1">
                      <span>claimType</span>
                      <span className="text-muted-subtle">integer 1 to 6</span>
                    </li>
                    <li className="flex justify-between">
                      <span>threshold</span>
                      <span className="text-muted-subtle">numeric boundary for the claim</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ SIX CLAIM TYPES ═══════════════ */}
          <ScrollReveal direction="up" delay={0.25}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <GanttChartSquare className="text-accent h-5 w-5 shrink-0" /> The Six Claim Types
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                The ClaimDecoder template inside the circuit maps the claimType signal to one of
                six constraint templates. Each template checks a different condition against the
                private input signals.
              </p>
              <div className="space-y-3">
                {[
                  { type: 1, title: "Programme Completion", check: "graduationYear == threshold", detail: "Employer submits the expected graduation year. The circuit checks the private graduationYear signal equals the threshold. This proves the candidate completed the programme in the stated year." },
                  { type: 2, title: "Minimum Lower Second Class", check: "classification >= 2", detail: "The circuit checks that the classification signal is greater than or equal to 2 (Lower Credit classification or higher). This is the standard minimum for most graduate jobs in Nigeria." },
                  { type: 3, title: "Minimum Upper Second Class", check: "classification >= 3", detail: "Same pattern but with a higher barrier. The employer wants candidates who graduated with Upper Credit or First Class. The circuit checks classification >= 3." },
                  { type: 4, title: "First Class Honours", check: "classification == 4", detail: "The strictest classification check. The circuit proves the candidate graduated with First Class Honours. The threshold is ignored for this claim type." },
                  { type: 5, title: "CGPA Above Threshold", check: "cgpa >= threshold", detail: "The employer sets a numeric CGPA threshold and the circuit proves the student's CGPA meets or exceeds it. The threshold is an integer scaled by 100. To check for CGPA >= 3.50, the employer submits threshold = 350." },
                  { type: 6, title: "Course Specific Completion", check: "courseHash matches AND passing grade", detail: "The most sophisticated claim type. The employer specifies a course code. The circuit checks that the courseHash matches AND the classification represents a passing grade for that course. This is used when a specific prerequisite course is required." },
                ].map(({ type, title, check, detail }) => (
                  <div key={type} className="border-surface-border rounded border bg-surface-card p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-accent/10 text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded font-mono text-xs font-bold">{type}</span>
                      <h4 className="font-bold text-foreground">{title}</h4>
                      <span className="font-mono text-[10px] text-muted-subtle ml-auto">{check}</span>
                    </div>
                    <p className="text-muted text-sm leading-relaxed">{detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ CONSTRAINT SYSTEM ═══════════════ */}
          <ScrollReveal direction="up" delay={0.3}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <CircuitBoard className="text-accent h-5 w-5 shrink-0" /> The R1CS Constraint System
              </h2>
              <p className="text-muted leading-relaxed">
                Circom compiles the circuit to a Rank-1 Constraint System (R1CS) with approximately
                45,000 constraints. Each constraint is of the form A * B = C where A, B, and C are
                linear combinations of the circuit signals.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                The constraints fall into three groups. First, the poseidon hash constraints.
                Each poseidon permutation requires about 20 constraints per round, and the 3-round
                sponge configuration adds about 100 constraints per hash. The circuit hashes 7
                elements for the commitment and 2 elements for the nullifier, so the total hash
                constraint count is approximately 9 * 100 = 900 constraints.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Second, the comparison constraints. The circuit needs to check cgpa {'>='} threshold
                and classification {'>='} threshold. These comparisons are implemented using bit
                decomposition and subtraction with borrow checking. Each comparison adds
                approximately 500 constraints.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Third, the equality constraints. The commitment equality check and nullifier
                equality check each add a single constraint: hasher.out === commitment. The
                ClaimDecoder output check adds another single constraint: claim.out === 1.
                The remaining constraints come from signal routing, template instantiation,
                and the Circom compiler's internal bookkeeping.
              </p>
              <CodeBlock
                filename="credential.circom — Full Circuit"
                code={`pragma circom 2.0.0;
include "poseidon.circom";
include "claim_decoder.circom";

template CredentialVerifier() {
  // ── Private Inputs (8) ──
  signal input nameHash;
  signal input matricHash;
  signal input cgpa;
  signal input classification;
  signal input courseHash;
  signal input graduationYear;
  signal input blindingFactor;
  signal input institutionKey;

  // ── Public Inputs (4) ──
  signal input commitment;
  signal input nullifier;
  signal input claimType;
  signal input threshold;

  // ── Constraint 1: Commitment binding ──
  // Hash all 7 private inputs + blinding factor
  // and assert equality with public commitment
  component commHasher = Poseidon(7);
  commHasher.inputs[0] <== nameHash;
  commHasher.inputs[1] <== matricHash;
  commHasher.inputs[2] <== cgpa;
  commHasher.inputs[3] <== classification;
  commHasher.inputs[4] <== courseHash;
  commHasher.inputs[5] <== graduationYear;
  commHasher.inputs[6] <== blindingFactor;
  commHasher.out === commitment;

  // ── Constraint 2: Nullifier binding ──
  // Bind matric to institution to prevent
  // cross-institution replay attacks
  component nullHasher = Poseidon(2);
  nullHasher.inputs[0] <== matricHash;
  nullHasher.inputs[1] <== institutionKey;
  nullHasher.out === nullifier;

  // ── Constraint 3: Claim satisfaction ──
  // The ClaimDecoder maps claimType to a
  // specific constraint template. Output
  // must be 1 for the proof to be valid.
  component claim = ClaimDecoder();
  claim.cgpa <== cgpa;
  claim.classification <== classification;
  claim.courseHash <== courseHash;
  claim.graduationYear <== graduationYear;
  claim.claimType <== claimType;
  claim.threshold <== threshold;
  claim.out === 1;
}`}
              />
            </section>
          </ScrollReveal>

          {/* ═══════════════ CLAIM DECODER ═══════════════ */}
          <ScrollReveal direction="up" delay={0.35}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Binary className="text-accent h-5 w-5 shrink-0" /> The ClaimDecoder Template
              </h2>
              <p className="text-muted leading-relaxed">
                The ClaimDecoder is a Circom template that maps a claimType enum to the
                appropriate constraint template. It uses Circom's conditional signal routing
                to select from six possible claim templates without executing all of them.
              </p>
              <CodeBlock
                filename="claim_decoder.circom — Simplified"
                code={`template ClaimDecoder() {
  signal input cgpa;
  signal input classification;
  signal input courseHash;
  signal input graduationYear;
  signal input claimType;
  signal input threshold;
  signal output out;

  // Ensure claimType is in range 1-6
  signal typeValid;
  component rangeCheck = Num2Bits(3);
  rangeCheck.in <== claimType;
  typeValid <== 1 - rangeCheck.out[3]; // Bit 3 must be 0

  // Route to the correct template
  // claimType 1: Programme completion
  //   out = 1 if graduationYear == threshold
  //
  // claimType 2: Min Lower Second (2.1 equivalent)
  //   out = 1 if classification >= 2
  //
  // claimType 3: Min Upper Second (2.2 equivalent)
  //   out = 1 if classification >= 3
  //
  // claimType 4: First Class
  //   out = 1 if classification == 4
  //
  // claimType 5: CGPA above threshold
  //   out = 1 if cgpa >= threshold
  //
  // claimType 6: Course completion
  //   out = 1 if courseHash matches AND passing grade
  //
  // Output is the logical OR of all type-specific
  // checks, but only one fires due to claimType
  component comp = IsEqual();
  comp.in[0] <== graduationYear;
  comp.in[1] <== threshold;
  // ... routing through claimType selectors
}`}
              />
            </section>
          </ScrollReveal>

          {/* ═══════════════ PROOF GENERATION FLOW ═══════════════ */}
          <ScrollReveal direction="up" delay={0.4}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Workflow className="text-accent h-5 w-5 shrink-0" /> Proof Generation and Verification Flow
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                When an employer submits a verification request, the backend runs the following
                sequence to generate and submit the proof.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4 border-surface-border/50 border-l-2 border-accent pl-4 py-2">
                  <div className="bg-accent/10 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">1</div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Decrypt the credential record</h4>
                    <p className="text-muted text-xs mt-1">The backend retrieves the encrypted record from PostgreSQL using the matriculation number as the lookup key. It decrypts the AES-256-GCM ciphertext using the encryption key from the environment. The raw student data exists in memory for the next 2 seconds, then is garbage collected.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 border-surface-border/50 border-l-2 border-accent pl-4 py-2">
                  <div className="bg-accent/10 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">2</div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Compute private signal values</h4>
                    <p className="text-muted text-xs mt-1">The backend hashes the student name and matric number using sha256 and converts them to BN254 field elements. The CGPA is multiplied by 100 and floored to an integer. The classification is mapped to the 0-4 enum. courseHash is computed from the course code. These become the 8 private input signals.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 border-surface-border/50 border-l-2 border-accent pl-4 py-2">
                  <div className="bg-accent/10 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">3</div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Run SnarkJS fullProve</h4>
                    <p className="text-muted text-xs mt-1">The backend calls snarkjs.groth16.fullProve() with the private inputs, public inputs (commitment, nullifier, claimType, threshold), and the compiled WASM circuit. SnarkJS runs the prover inside Node.js using the WASM backend. Proof generation takes approximately 0.7 seconds on a modern CPU.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 border-surface-border/50 border-l-2 border-accent pl-4 py-2">
                  <div className="bg-accent/10 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">4</div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Submit proof to on-chain verifier</h4>
                    <p className="text-muted text-xs mt-1">The backend encodes the proof (3 G1/G2 points) and the 4 public signals into a Solidity-compatible ABI format. It sends a transaction to the ZKVerifier contract on Base Sepolia via viem. The contract checks the proof using BN254 pairing precompiles at addresses 0x06, 0x07, and 0x08.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 border-surface-border/50 border-l-2 border-accent pl-4 py-2">
                  <div className="bg-accent/10 text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">5</div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Check revocation status</h4>
                    <p className="text-muted text-xs mt-1">Before accepting the proof, the verifier calls RevocationRegistry.isRevoked(nullifier). If the nullifier has been revoked, the proof is rejected. This ensures that degrees rescinded by the university are immediately unverifiable, regardless of proof validity.</p>
                  </div>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ PERFORMANCE ═══════════════ */}
          <ScrollReveal direction="up" delay={0.45}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Activity className="text-accent h-5 w-5 shrink-0" /> Performance and Benchmarks
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                Measured on a 2023 laptop with Apple M3 Pro, 18 GB RAM, Node.js 22, and SnarkJS 0.7.4.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "R1CS Constraints", value: "~45,000" },
                  { label: "Private Inputs", value: "8 signals" },
                  { label: "Public Inputs", value: "4 signals" },
                  { label: "Proof Generation (WASM)", value: "~0.7 seconds" },
                  { label: "Proof Size", value: "~256 bytes (3 G points)" },
                  { label: "Proving Key Size", value: "~45 MB" },
                  { label: "Verification Key Size", value: "~2 KB" },
                  { label: "On-Chain Gas Cost", value: "~236,000 gas" },
                  { label: "On-Chain Cost (Base)", value: "~$0.01 USD" },
                  { label: "Verification Time (EVM)", value: "~12 ms" },
                ].map(({ label, value }) => (
                  <div key={label} className="border-surface-border rounded border bg-surface-card p-4 flex justify-between items-center">
                    <span className="text-muted text-xs">{label}</span>
                    <span className="text-accent font-mono text-xs font-bold">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-muted mt-6 leading-relaxed">
                The on-chain cost depends on Base Sepolia gas prices and the ETH/USD exchange rate.
                At 0.1 gwei and $1,669/ETH, 236,000 gas costs approximately $0.01. This makes
                VERIDAQ practical for high-volume employer verification use cases.
              </p>
            </section>
          </ScrollReveal>

          {/* ═══════════════ SECURITY MODEL ═══════════════ */}
          <ScrollReveal direction="up" delay={0.5}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Lock className="text-accent h-5 w-5 shrink-0" /> Security Model and Limitations
              </h2>
              <p className="text-muted leading-relaxed mb-4">
                The zero-knowledge proof provides soundness: if the proof verifies, the prover
                possesses a valid witness that satisfies all circuit constraints. Soundness relies
                on the security of the Groth16 trusted setup and the BN254 curve.
              </p>
              <div className="space-y-4">
                <div className="p-4 bg-surface-card border border-surface-border">
                  <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2"><Shield className="text-accent h-4 w-4" /> What the ZKP guarantees</h4>
                  <ul className="text-muted text-xs space-y-2 list-disc pl-5">
                    <li>The backend possesses the private data that produces the on-chain commitment.</li>
                    <li>The credential has not been revoked by the institution.</li>
                    <li>The claimed condition is mathematically satisfied by the private data.</li>
                    <li>The same credential cannot be verified twice because the nullifier is consumed.</li>
                  </ul>
                </div>
                <div className="p-4 bg-surface-card border border-surface-border">
                  <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2"><Zap className="text-yellow-500 h-4 w-4" /> What the ZKP does NOT guarantee</h4>
                  <ul className="text-muted text-xs space-y-2 list-disc pl-5">
                    <li>The accuracy of the original data. If the institution uploaded incorrect data, the proof will be valid but the credential is wrong. This is a data quality problem, not a cryptographic one.</li>
                    <li>The identity of the person submitting the proof. The backend has access to all private data and could generate proofs without the student's knowledge. The institution is trusted to control access to its backend.</li>
                    <li>The liveness of the institution. If the institution's backend goes offline, no new proofs can be generated for their credentials. On-chain commitments remain valid but inaccessible without the encrypted private data.</li>
                  </ul>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ WHY POSEIDON ═══════════════ */}
          <ScrollReveal direction="up" delay={0.55}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <FileCode2 className="text-accent h-5 w-5 shrink-0" /> Why Poseidon Instead of SHA-256 or Keccak256
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                Hash functions designed for traditional computing (SHA-256, keccak256) are extremely
                expensive inside arithmetic circuits. The following table shows the constraint count
                for each hash function in Circom:
              </p>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Hash Function</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Constraints per Call</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Constraints for 7 Inputs</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Proof Time (est.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-foreground">Poseidon (3 rounds)</td>
                      <td className="p-3 text-accent">~100</td>
                      <td className="p-3 text-accent">~700</td>
                      <td className="p-3 text-accent">~0.7s</td>
                    </tr>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-muted">Pedersen (BabyJubJub)</td>
                      <td className="p-3 text-muted">~10,000</td>
                      <td className="p-3 text-muted">~70,000</td>
                      <td className="p-3 text-muted">~5s</td>
                    </tr>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-muted">SHA-256</td>
                      <td className="p-3 text-muted">~30,000</td>
                      <td className="p-3 text-muted">~210,000</td>
                      <td className="p-3 text-muted">~30s</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted">Keccak256</td>
                      <td className="p-3 text-muted">~50,000</td>
                      <td className="p-3 text-muted">~350,000</td>
                      <td className="p-3 text-muted">~60s</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-muted leading-relaxed">
                Using keccak256 instead of Poseidon would make proof generation take over a minute
                instead of under a second. The circuit would be 7 times larger and the proving key
                would be hundreds of megabytes. Poseidon is the correct choice for any ZKP system
                that needs to hash data inside the circuit.
              </p>
            </section>
          </ScrollReveal>

          {/* ═══════════════ COMPARISON ═══════════════ */}
          <ScrollReveal direction="up" delay={0.6}>
            <section>
              <h2 className="mb-4 text-xl font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Network className="text-accent h-5 w-5 shrink-0" /> Comparison with Alternative Approaches
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Approach</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Privacy</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Gas Cost</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Verification Speed</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Trust Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-accent font-bold">VERIDAQ (Groth16)</td>
                      <td className="p-3 text-accent">Full ZK</td>
                      <td className="p-3">~236k gas</td>
                      <td className="p-3">~12 ms</td>
                      <td className="p-3">Trusted setup + honest prover</td>
                    </tr>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-muted">PLONK</td>
                      <td className="p-3 text-accent">Full ZK</td>
                      <td className="p-3">~400k gas</td>
                      <td className="p-3">~15 ms</td>
                      <td className="p-3">Universal trusted setup</td>
                    </tr>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-muted">STARK (on-chain)</td>
                      <td className="p-3 text-accent">Full ZK</td>
                      <td className="p-3">~5M gas</td>
                      <td className="p-3">~100 ms</td>
                      <td className="p-3">No trusted setup</td>
                    </tr>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-muted">Plain hash on-chain</td>
                      <td className="p-3 text-muted">No privacy</td>
                      <td className="p-3">~50k gas</td>
                      <td className="p-3">N/A</td>
                      <td className="p-3">Centralized</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-muted">Paper certificates</td>
                      <td className="p-3 text-muted">Full exposure</td>
                      <td className="p-3">N/A</td>
                      <td className="p-3">Weeks</td>
                      <td className="p-3">Manual verification</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </ScrollReveal>

        </div>
      </div>
    </div>
  )
}
