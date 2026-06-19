"use client"
import { ChevronRight, Lock, Shield, Key, Database, Eye, EyeOff, FileCode2, Trash2, Cookie, Mail, Fingerprint, Server, Cpu, Network } from "@/lib/icons"
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
          EFFECTIVE: 2026-03-23 | VERIDAQ_PRIV_V1.0 | APPLIES TO ALL PORTALS AND API ACCESS
        </p>

        <div className="space-y-10 text-sm leading-relaxed md:text-base">

          {/* ═══════════════ CORE PRINCIPLE ═══════════════ */}
          <ScrollReveal direction="up" delay={0}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Shield className="text-accent h-5 w-5 shrink-0" /> Core Principle: Privacy by Architecture
              </h2>
              <p className="text-muted leading-relaxed">
                Veridaq is built so that student personally identifiable information (PII) never
                appears on the blockchain in readable form. This is not a feature we added after
                the fact. It is a structural property of the system that cannot be disabled.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Because data is hashed with Poseidon before submission, the public ledger contains
                only opaque bytes32 values that cannot be reversed. The raw student data exists in
                exactly one place: the institution's backend server, encrypted at rest with
                AES-256-GCM, decrypted for milliseconds during proof generation, then discarded.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                This architecture means Veridaq can comply with GDPR Article 17 (right to erasure)
                even though the blockchain is immutable. The on-chain commitments contain no PII,
                so their permanence poses no privacy risk. If the institution deletes the encrypted
                data on their backend, the commitments become orphaned hashes with no meaning.
              </p>
            </section>
          </ScrollReveal>

          {/* ═══════════════ DATA COLLECTED ═══════════════ */}
          <ScrollReveal direction="up" delay={0.08}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Database className="text-accent h-5 w-5 shrink-0" /> Data We Collect and Store
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                Veridaq collects different categories of data depending on the user role. Each
                category has different retention policies and security requirements.
              </p>

              <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2"><Building2Icon /> Institution Data</h3>
              <ul className="space-y-2 text-muted pl-5 list-disc mb-6">
                <li>Organization name and physical address</li>
                <li>Administrator full name, work email, and hashed password (bcrypt, cost factor 12)</li>
                <li>Public wallet address on Base Sepolia</li>
                <li>Subscription tier (FREE or PAID) and billing history</li>
                <li>Institution-specific encryption key for credential data (NEVER stored in database)</li>
              </ul>

              <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2"><BuildingIcon /> Employer Data</h3>
              <ul className="space-y-2 text-muted pl-5 list-disc mb-6">
                <li>Organization name, email, and hashed password (bcrypt, cost factor 12)</li>
                <li>Verification credit balance and purchase history</li>
                <li>Verification history: counts, timestamps, and institution IDs only</li>
                <li>NEVER student names, matric numbers, CGPAs, or any credential data</li>
              </ul>

              <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2"><UserIcon /> Admin Data</h3>
              <ul className="space-y-2 text-muted pl-5 list-disc mb-6">
                <li>Email and hashed password (bcrypt, cost factor 12)</li>
                <li>Platform-level audit logs</li>
              </ul>

              <h3 className="font-bold text-foreground mb-3 text-sm flex items-center gap-2"><FileCode2 className="h-4 w-4" /> Student Credential Data</h3>
              <ul className="space-y-2 text-muted pl-5 list-disc">
                <li>Full name (legal name as registered with the institution)</li>
                <li>Matriculation / registration number</li>
                <li>CGPA (cumulative grade point average)</li>
                <li>Degree classification (PASS, THIRD, LOWER, UPPER, FIRST)</li>
                <li>Course codes for all registered programmes</li>
                <li>Graduation year</li>
                <li className="text-accent font-semibold mt-2">This data NEVER reaches the blockchain. It is encrypted at rest on the backend server with AES-256-GCM. It is decrypted in memory for milliseconds during proof generation, then discarded.</li>
              </ul>
            </section>
          </ScrollReveal>

          {/* ═══════════════ ENCRYPTION DETAILS ═══════════════ */}
          <ScrollReveal direction="up" delay={0.15}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Lock className="text-accent h-5 w-5 shrink-0" /> Encryption Architecture
              </h2>
              <p className="text-muted leading-relaxed mb-4">
                Student credential data is protected by two layers of encryption: at rest on the
                backend server and in transit between services.
              </p>

              <div className="p-5 bg-surface-card border border-surface-border mb-4">
                <h3 className="font-bold text-foreground mb-3 text-sm">AES-256-GCM (At Rest)</h3>
                <p className="text-muted text-sm leading-relaxed mb-3">
                  Each student record is encrypted with AES-256 in Galois/Counter Mode before being
                  stored in the PostgreSQL database. GCM provides authenticated encryption, which
                  means the ciphertext cannot be tampered with without detection.
                </p>
                <div className="overflow-x-auto">
                  <pre className="text-xs font-mono text-muted bg-surface p-3 rounded border border-surface-border">{`Encryption process:

1. Generate a random 96-bit IV (initialization vector)
2. Encrypt the plaintext with AES-256-GCM using the
   encryption key from environment variable
3. Prepend the IV to the ciphertext
4. Store IV + ciphertext + auth tag in PostgreSQL TEXT column

Decryption reverses this: extract IV, decrypt, verify auth tag.
The encryption key is NEVER stored in the database.`}</pre>
                </div>
              </div>

              <div className="p-5 bg-surface-card border border-surface-border mb-4">
                <h3 className="font-bold text-foreground mb-3 text-sm">Key Management</h3>
                <p className="text-muted text-sm leading-relaxed mb-3">
                  The AES-256 encryption key is stored in the NODE_ENV or a secrets manager.
                  It is loaded into memory at server startup and never written to disk,
                  logged, or transmitted over the network. The backend server uses a single
                  encryption key shared across all institutions in the current version.
                </p>
                <p className="text-muted text-sm leading-relaxed">
                  Key rotation requires re-encrypting all existing credential records. This
                  is a planned feature for future versions. In the meantime, the encryption
                  key should be treated as a secret of the highest sensitivity.
                </p>
              </div>

              <div className="p-5 bg-surface-card border border-surface-border">
                <h3 className="font-bold text-foreground mb-3 text-sm">TLS 1.3 (In Transit)</h3>
                <p className="text-muted text-sm leading-relaxed">
                  All API traffic between the frontend and backend is encrypted with TLS 1.3
                  in production. The development environment uses HTTP for local testing, but
                  HTTPS is enforced in production with automatic redirect from port 80 to 443.
                  The JWT cookies are marked Secure in production and are only sent over
                  encrypted connections.
                </p>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ HOW DATA GOES ON CHAIN ═══════════════ */}
          <ScrollReveal direction="up" delay={0.2}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Network className="text-accent h-5 w-5 shrink-0" /> How Data Is Committed to the Blockchain
              </h2>
              <p className="text-muted leading-relaxed">
                The institution uploads student records through the backend API. The backend
                computes a Poseidon hash of the student record plus a random blinding factor.
                This hash is a fixed-size field element that is submitted to the
                CredentialRegistry contract on Base Sepolia. The original data never leaves
                the backend.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                Because the hash is one-way and the blinding factor is secret, no one can
                recover the original data from the on-chain value. The hash is collision-resistant
                and second-preimage resistant. Even if an attacker knows the student's name and
                CGPA, they cannot match it against the on-chain commitment without the blinding
                factor.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                The only algorithm that runs on-chain is the BN254 pairing check for Groth16
                proof verification. No student data is ever passed to the blockchain in readable
                form. Not in plaintext, not encrypted, not anywhere.
              </p>
            </section>
          </ScrollReveal>

          {/* ═══════════════ DATA FLOW DIAGRAM ═══════════════ */}
          <ScrollReveal direction="up" delay={0.25}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Eye className="text-accent h-5 w-5 shrink-0" /> Data Flow: What Goes Where
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-surface-card border border-surface-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="text-accent h-4 w-4" />
                    <h3 className="font-bold text-foreground text-sm">Backend Server</h3>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    <span className="text-accent font-semibold">Stores:</span> Full student records encrypted with AES-256-GCM. Institution profiles. Employer profiles. Verification history.
                  </p>
                  <p className="text-[11px] text-muted leading-relaxed mt-2">
                    <span className="text-yellow-500 font-semibold">Never stores:</span> Encryption keys in database. Raw passwords.
                  </p>
                </div>
                <div className="p-5 bg-surface-card border border-surface-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="text-accent h-4 w-4" />
                    <h3 className="font-bold text-foreground text-sm">PostgreSQL</h3>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    <span className="text-accent font-semibold">Stores:</span> AES-256-GCM encrypted ciphertext only. Hashed passwords. Metadata.
                  </p>
                  <p className="text-[11px] text-muted leading-relaxed mt-2">
                    <span className="text-yellow-500 font-semibold">Never stores:</span> Raw student data. Private keys. Plaintext credentials.
                  </p>
                </div>
                <div className="p-5 bg-surface-card border border-surface-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="text-accent h-4 w-4" />
                    <h3 className="font-bold text-foreground text-sm">Base Sepolia (L2)</h3>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    <span className="text-accent font-semibold">Stores:</span> Poseidon hash commitments (32 bytes). Nullifiers (32 bytes). Proof verification results.
                  </p>
                  <p className="text-[11px] text-muted leading-relaxed mt-2">
                    <span className="text-yellow-500 font-semibold">Never stores:</span> Student names, matric numbers, CGPAs, classifications, course codes, or any personal identifier.
                  </p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ COOKIES ═══════════════ */}
          <ScrollReveal direction="up" delay={0.3}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Cookie className="text-accent h-5 w-5 shrink-0" /> Cookies and Session Management
              </h2>
              <p className="text-muted leading-relaxed mb-4">
                Veridaq uses cookies exclusively for JWT session management. We do not use cookies
                for tracking, analytics, advertising, or any third-party service.
              </p>
              <div className="space-y-3 text-sm text-muted">
                <div className="p-4 bg-surface-card border border-surface-border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-foreground text-sm">Refresh Token</h4>
                    <span className="text-[10px] font-mono text-accent">httpOnly | Secure | SameSite=Strict</span>
                  </div>
                  <p className="text-xs">Stored in a cookie that JavaScript cannot read. Prevents XSS-based session theft. Expires after 7 days of inactivity.</p>
                </div>
                <div className="p-4 bg-surface-card border border-surface-border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-foreground text-sm">Access Token</h4>
                    <span className="text-[10px] font-mono text-accent">In-memory only</span>
                  </div>
                  <p className="text-xs">Never stored in a cookie or localStorage. Held in JavaScript memory and attached to API requests via Authorization header. Expires after 15 minutes.</p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ GDPR RIGHTS ═══════════════ */}
          <ScrollReveal direction="up" delay={0.35}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Fingerprint className="text-accent h-5 w-5 shrink-0" /> Your Rights Under GDPR
              </h2>
              <p className="text-muted leading-relaxed mb-4">
                If you are a data subject in the European Union or European Economic Area, you
                have the following rights under the General Data Protection Regulation.
              </p>
              <div className="space-y-3">
                {[
                  { right: "Right of Access (Art. 15)", desc: "You can request a copy of all personal data we hold about you. We will respond within 30 days." },
                  { right: "Right to Rectification (Art. 16)", desc: "If your data is inaccurate, you can request correction. For credential data, contact the issuing institution directly." },
                  { right: "Right to Erasure (Art. 17)", desc: "You can request deletion of your personal data from our backend. We will delete all records within 30 days. Note: on-chain Poseidon hashes cannot be deleted but contain no PII." },
                  { right: "Right to Restrict Processing (Art. 18)", desc: "You can request that we stop processing your data while a dispute is resolved." },
                  { right: "Right to Data Portability (Art. 20)", desc: "You can request your data in a machine-readable format (JSON)." },
                  { right: "Right to Object (Art. 21)", desc: "You can object to processing of your data for legitimate interests or direct marketing." },
                ].map(({ right, desc }) => (
                  <div key={right} className="p-4 bg-surface-card border border-surface-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">{right}</h4>
                    <p className="text-muted text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ RETENTION AND DELETION ═══════════════ */}
          <ScrollReveal direction="up" delay={0.4}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Trash2 className="text-accent h-5 w-5 shrink-0" /> Retention and Deletion
              </h2>
              <p className="text-muted leading-relaxed">
                Institutions can request deletion of their backend data through the support
                endpoint. Upon deletion:
              </p>
              <ul className="text-muted mt-4 space-y-2 pl-5 list-disc">
                <li>All encrypted student records for that institution are deleted from PostgreSQL.</li>
                <li>The institution account is deactivated but the record is retained for audit purposes.</li>
                <li>Employer verification history is retained (counts only, no credential data).</li>
              </ul>
              <p className="text-muted mt-4 leading-relaxed">
                The Poseidon hash commitments submitted to Base Sepolia are permanent. The
                blockchain is immutable by design. However, because these hashes contain no
                PII and are computationally hiding, their permanence poses no privacy risk.
                They are meaningless 32-byte strings without access to the original data and
                blinding factor.
              </p>
            </section>
          </ScrollReveal>

          {/* ═══════════════ INCIDENT RESPONSE ═══════════════ */}
          <ScrollReveal direction="up" delay={0.45}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <EyeOff className="text-accent h-5 w-5 shrink-0" /> Incident Response and Breach Notification
              </h2>
              <p className="text-muted leading-relaxed mb-4">
                If a data breach is detected, Veridaq follows a structured incident response
                process that aligns with GDPR Article 33 and 34 requirements.
              </p>
              <div className="space-y-3 text-muted text-sm">
                <div className="flex items-start gap-3 p-3 bg-surface-card border border-surface-border">
                  <span className="bg-accent/10 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">1</span>
                  <div>
                    <h4 className="font-bold text-foreground text-xs">Detection and Triage</h4>
                    <p className="text-xs">The security team identifies the breach through monitoring alerts, user reports, or automated scanning. Initial assessment within 2 hours.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-surface-card border border-surface-border">
                  <span className="bg-accent/10 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">2</span>
                  <div>
                    <h4 className="font-bold text-foreground text-xs">Containment</h4>
                    <p className="text-xs">The affected server or service is isolated. Access tokens are revoked. If the backend is compromised, the encryption key is rotated and all credential data is re-encrypted.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-surface-card border border-surface-border">
                  <span className="bg-accent/10 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">3</span>
                  <div>
                    <h4 className="font-bold text-foreground text-xs">Notification</h4>
                    <p className="text-xs">Affected data subjects are notified within 72 hours. The supervisory authority is notified if required by GDPR Article 33. Notification includes: nature of the breach, categories of data involved, and recommended mitigation steps.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-surface-card border border-surface-border">
                  <span className="bg-accent/10 text-accent flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">4</span>
                  <div>
                    <h4 className="font-bold text-foreground text-xs">Remediation</h4>
                    <p className="text-xs">Root cause analysis is completed within 14 days. Security patches are deployed. A post-mortem is published for affected stakeholders.</p>
                  </div>
                </div>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ THIRD PARTY ═══════════════ */}
          <ScrollReveal direction="up" delay={0.5}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Server className="text-accent h-5 w-5 shrink-0" /> Third-Party Services and Data Processors
              </h2>
              <p className="text-muted leading-relaxed mb-4">
                Veridaq uses the following third-party services. Each has been reviewed for
                GDPR compliance and data processing agreements are in place where required.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Service</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Purpose</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Data Shared</th>
                      <th className="text-left p-3 text-muted-subtle font-bold uppercase tracking-wider">Jurisdiction</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-foreground">Base Sepolia (Coinbase)</td>
                      <td className="p-3 text-muted">Blockchain execution and proof verification</td>
                      <td className="p-3 text-muted">Poseidon hash commitments only</td>
                      <td className="p-3 text-muted">Global (L2 is permissionless)</td>
                    </tr>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-foreground">Alchemy</td>
                      <td className="p-3 text-muted">RPC endpoint for blockchain interaction</td>
                      <td className="p-3 text-muted">Transaction data (no student PII)</td>
                      <td className="p-3 text-muted">United States (Standard Contractual Clauses in place)</td>
                    </tr>
                    <tr className="border-b border-surface-border/50">
                      <td className="p-3 text-foreground">Neon (production)</td>
                      <td className="p-3 text-muted">PostgreSQL database hosting</td>
                      <td className="p-3 text-muted">Encrypted credential data (AES-256-GCM ciphertext)</td>
                      <td className="p-3 text-muted">US / EU (configurable region)</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-foreground">Upstash</td>
                      <td className="p-3 text-muted">Redis queue and cache</td>
                      <td className="p-3 text-muted">Job metadata, session cache (no PII)</td>
                      <td className="p-3 text-muted">US / EU (configurable region)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ SECURITY MEASURES ═══════════════ */}
          <ScrollReveal direction="up" delay={0.55}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Lock className="text-accent h-5 w-5 shrink-0" /> Organizational and Technical Security Measures
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: "Access Control", desc: "Role-based access control (RBAC) with three roles: Admin, Institution, Employer. Each role can only access its own data and routes." },
                  { title: "Password Policy", desc: "Passwords are hashed with bcrypt at cost factor 12. Minimum 8 characters, must include uppercase, lowercase, digit, and special character." },
                  { title: "Rate Limiting", desc: "Auth endpoints are rate limited to 5 attempts per IP per 15 minutes. API endpoints are rate limited to 100 requests per minute per user." },
                  { title: "Audit Logging", desc: "All verification requests are logged with unique IDs, timestamps, and transaction hashes. Logs are immutable and append-only." },
                  { title: "Dependency Scanning", desc: "All npm and Foundry dependencies are scanned for known vulnerabilities before deployment. Weekly automated scans." },
                  { title: "Secrets Rotation", desc: "JWT secrets, encryption keys, and API tokens are rotated every 90 days. Emergency rotation can be triggered on demand." },
                ].map(({ title, desc }) => (
                  <div key={title} className="p-4 bg-surface-card border border-surface-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">{title}</h4>
                    <p className="text-muted text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </ScrollReveal>

          {/* ═══════════════ CHANGES ═══════════════ */}
          <ScrollReveal direction="up" delay={0.6}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <FileCode2 className="text-accent h-5 w-5 shrink-0" /> Changes to This Policy
              </h2>
              <p className="text-muted leading-relaxed">
                We may update this privacy policy from time to time. Material changes will be
                communicated through the contact email on file for institution and employer
                accounts. Continued use of the platform after changes constitutes acceptance
                of the updated policy.
              </p>
              <p className="text-muted mt-4 leading-relaxed">
                The version number at the top of this document indicates the current revision.
                Historical versions are available on request. The effective date is the date
                the policy was last modified.
              </p>
            </section>
          </ScrollReveal>

          {/* ═══════════════ CONTACT ═══════════════ */}
          <ScrollReveal direction="up" delay={0.65}>
            <section>
              <h2 className="mb-4 text-lg font-bold uppercase tracking-widest text-foreground flex items-center gap-3">
                <Mail className="text-accent h-5 w-5 shrink-0" /> Contact and Data Protection Officer
              </h2>
              <p className="text-muted leading-relaxed">
                If you have questions about this privacy policy, want to exercise your GDPR
                rights, or need to report a security concern, contact the Veridaq team:
              </p>
              <div className="p-5 bg-surface-card border border-surface-border mt-4 font-mono text-sm text-muted">
                <p>Data Protection Officer</p>
                <p>Veridaq Project</p>
                <p>Department of Cybersecurity Science</p>
                <p>Federal University of Technology, Minna</p>
                <p>Niger State, Nigeria</p>
                <p className="mt-3 text-accent">privacy@veridaq.xyz</p>
              </div>
            </section>
          </ScrollReveal>

        </div>
      </div>
    </div>
  )
}

function Building2Icon({ className = "" }: { className?: string }) {
  return <Building2 className={className} />
}
function BuildingIcon({ className = "" }: { className?: string }) {
  return <Building className={className} />
}
function UserIcon({ className = "" }: { className?: string }) {
  return <User className={className} />
}

function Building2({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  )
}
function Building({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  )
}
function User({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
