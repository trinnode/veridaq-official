# VERIDAQ — Architecture

This document describes the system as it is built in this repository. It is
deliberately narrower than `README.md`: that file explains the product, this one
explains the moving parts, the boundaries between them and the decisions that
are easy to get wrong when changing the code.

Version: November 2026. Local stack: Postgres 5433, Redis 6380, Fastify 4100,
Next 3000, Base Sepolia 84532.

---

## 1. What exists

```
packages/
  contracts/   Foundry project — registries, verifier, subscription, paymaster
  circuits/    Circom 2 Groth16 circuit + trusted setup artefacts
  backend/     Fastify 5 API, Prisma, BullMQ worker, proof generation
  frontend/    Next.js 15 App Router — institution, employer, admin portals
  extension/   Manifest V3 extension (not part of the core flow)
```

One root `package.json`, one lockfile, one `pnpm install`. There is no
per-package manifest.

---

## 2. Runtime topology

```
Browser (Next.js, three portals)
        │  HTTPS, httpOnly cookie access token
        ▼
Fastify API (packages/backend)
        ├── PostgreSQL 16  — users, encrypted credential payloads, requests
        ├── Redis 7        — JWT session material, FX cache, login limits,
        │                    BullMQ queues, free-check reconciliation cadence
        ├── Base Sepolia   — registries, Groth16 verifier, subscription counts
        └── Circom build   — credential_js/credential.wasm + credential_final.zkey
```

The API is stateless apart from cookie-borne credentials. Anything that must
survive a restart lives in Postgres or Redis. The only long-running background
work is:

- the BullMQ batch worker, started as an import side effect in `server.ts`;
- the free-verification reconciliation timer, started after routes register.

Both are intentionally in-process. A separate worker process is a deployment
concern and is not needed at this scale; the timer is `unref`'d so it never
holds the process open.

---

## 3. Backend layout

```
packages/backend/src/
  config/      Zod-validated environment, fails at startup
  plugins/     prisma, redis, auth (JWT verification + decorators)
  routes/      auth, institution, employer, verification, admin, payment,
               earnings, stats, fx, crossmint
  services/    one file per domain concern (see below)
  workers/     batch processor + queue definition
  utils/       crypto (AES-256-GCM), field arithmetic, course binding, logger
  test/        vitest suites against the real local database
```

Services worth knowing:

| Service | Responsibility |
| --- | --- |
| `auth.service.ts` | Password verification, token issue, refresh |
| `verification.service.ts` | Employer request lifecycle, dedupe, proof dispatch, history |
| `institution.service.ts` | Batches, manual review, approve/decline, review detail |
| `admin.service.ts` | KYC approval, chain registration, retry, platform stats |
| `blockchain.service.ts` | The only place that talks to Base Sepolia |
| `proof.service.ts` | SnarkJS `fullProve`, local verification, verifier call data |
| `earnings.service.ts` | 70/20/10 split, balances, withdrawal reservation |
| `credit.service.ts` | Atomic spend/refund of free checks and paid credits |
| `eth-price.service.ts` | ETH/USD quote used to size ETH payouts |
| `reconcile.service.ts` | Chain → database sync of free-check counters |
| `fx.service.ts` | USD→NGN display rate, median of keyless providers |
| `report.service.ts` | PDF verification report |

`blockchain.service.ts` is the only module allowed to hold a private key. Route
handlers never import `viem` clients directly; they go through a service.

---

## 4. Data model, in one paragraph per table

**Institution** — one row per university. Holds `onChainId` (the bytes32 key
used by the registries), `adminWallet`, an AES-GCM encrypted institution signing
key, KYC state and `blockchainStatus`. The encrypted key is the only secret that
can authorise a credential for that institution; rotating it invalidates the
nullifier of every credential already issued, which is why `seed.ts` is written
to never regenerate it on re-run.

**Employer** — one row per verifying organisation. `walletAddress` is a
non-null string defaulting to `""` (not NULL), so filters must use
`{ not: "" }`. Holds `freeVerificationsRemaining` (a mirror of the chain) and
`verificationCredits` (paid, database-authoritative).

**Batch** — an upload of students. Tracks status (`PENDING`, `PROCESSING`,
`CONFIRMED`, `FAILED`), counts, and the on-chain transaction hash.

**Credential** — one student record. `commitment` and `nullifier` are public;
`encryptedData` is the AES-GCM payload containing name hash, matric hash, CGPA,
classification, `courseHash`, graduation year and blinding factor. Revocation
is a status plus reason, not a delete.

**VerificationRequest** — the employer's question and its answer. Carries
`claimType`, `threshold`, `courseName` (claim 6 only), status, result, proof
JSON for audit, tx hash, `adminNote` (internal) and `institutionNote` (shown to
the employer).

**InstitutionEarnings / EarningTransaction / Payment / GasPool** — the money
ledger. Balances are USD; `amountWei` is recorded alongside for ETH settlement.

**ClaimDefinition** — per-institution claim catalogue, including whether a claim
is `AUTO` or `MANUAL`.

**AuditLog** — append-only record of privileged actions with actor IDs.

---

## 5. The verification path

1. Employer submits institution, matriculation number, claim type and optional
   threshold.
2. The API resolves the institution by `onChainId`, rejects it if KYC was never
   approved, then applies a 60-second dedupe on an identical request.
3. The credential is located by decrypting candidates and comparing the
   `matricHash`. There is no plaintext index on matric number, by design.
4. For claim 6 the typed programme is hashed and compared to the stored
   `courseHash` before anything is spent. A mismatch returns
   `PROGRAMME_MISMATCH` and no credit is consumed.
5. A credit is spent: free checks and paid credits both use guarded
   `updateMany` updates, so concurrent requests cannot spend the same unit.
6. AUTO claims generate a proof immediately in the background. MANUAL claims
   move to `AWAITING_INSTITUTION`.
7. Proof generation decrypts the record in memory, runs `fullProve`, calls the
   on-chain verifier, writes the result and credits the institution's earnings.
8. The client polls `GET /api/verify/request/:id`.

---

## 6. Money

Prices are USD. The split on a paid verification is 70% institution, 20%
platform, 10% gas pool.

Nothing in the codebase trusts a read-then-write balance check:

- **Credit spend** — `updateMany({ where: { id, verificationCredits: { gt: 0 } } })`
  and a `count` check. Two concurrent requests cannot both succeed.
- **Withdrawal** — the balance is reserved with the same guarded update before
  any ETH leaves the wallet. If the send throws, the reservation is reversed.
  If the send succeeds but the ledger row fails, the money is *not* refunded;
  the error is logged with the transaction hash for manual reconciliation.
  Refunding after a successful send would pay the institution twice.
- **Manual review charging** — a claim that needs a registrar is charged at
  review, not at submission, so the employer is not billed for a review that
  never happens. Two guards keep that honest: submission is refused when the
  employer has no unit available at all, and approval cannot proceed when the
  charge fails. A decline that cannot charge still completes, but credits the
  institution nothing.
- **Payout pricing** — ETH/USD comes from a live quote with a configured
  fallback. The applied rate, its source and whether it was stale are written
  into the transaction metadata.

Display currency (NGN) is presentation only. It is fetched from `/api/fx/rate`,
cached 30 minutes, and reported with a freshness timestamp. No stored amount is
ever denominated in Naira.

---

## 7. Chain interaction

Five deployed contracts on Base Sepolia:

| Contract | Role |
| --- | --- |
| `InstitutionRegistry` | institution bytes32 ID → name, admin wallet |
| `CredentialRegistry` | batch registration of commitment/nullifier pairs |
| `RevocationRegistry` | append-only nullifier revocation |
| `SubscriptionManager` | FREE/PAID tier, three free employer checks |
| `ZKVerifier` | SnarkJS-generated Groth16 verifier, four public signals |
| `PaymasterVault` / `VeridaqSimpleAccount*` | ERC-4337 sponsorship of institution gas |

The chain is authoritative for the free-check counter. The database column is a
mirror used for rendering and to avoid an RPC call on every page. A scheduled
reconciliation copies chain → database only; it can never grant a check the
contract would refuse. Admins can trigger the same sync per employer.

---

## 8. Frontend

```
app/
  institution/  dashboard, batches, claims, verifications, earnings, settings
  employer/     dashboard, verify, history
  admin/        dashboard, institutions, employers, payments, audit, earnings
components/
  ui/           primitives, including currency toggle and load-failure state
  institution|employer|admin/  portal shells and domain components
lib/            api client, auth context, currency context, roles, types
```

Each portal shell checks `user.role`, not just the presence of a session. A
session for the wrong role is redirected to its own dashboard rather than
rendering a shell whose every request will 403.

The API client keeps the access token in memory, relies on an httpOnly cookie
for persistence, and retries once after a refresh. Tokens are never written to
`localStorage`.

---

## 9. Failure behaviour worth knowing

- **Backend restart** marks orphaned `PROCESSING` requests as `FAILED` so they
  do not poll forever.
- **Proof generation failure** is caught, logged and reflected in request status;
  the employer is not charged twice on retry.
- **Chain registration failure** during KYC approval sets
  `blockchainStatus = FAILED` without rolling back KYC. The admin can retry
  registration without re-approving the institution.
- **FX provider failure** falls back to the last cached rate, then to a
  configured constant, and marks the quote stale so the UI can say so.
- **ETH price failure** uses the last real quote if there is one, else the
  configured fallback, and records the choice on the payout.

---

## 10. Testing

`pnpm test:backend` runs vitest against the local Postgres and a mocked
blockchain service (aliased in `vitest.config.ts`). `pnpm test:contracts` runs
the Foundry suite. Concurrency behaviour is tested with real parallel promises,
not by mocking the database.
