# VERIDAQ — Zero-Knowledge Academic Credential Verification

Academic credential verification is broken. Universities in Nigeria and across Africa spend millions every year processing transcript requests that take weeks. Employers cannot trust paper certificates because forgery is rampant. The NUC estimates that 30 percent of submitted credentials in Nigeria have some form of alteration. Blockchain solutions exist but they make things worse by putting raw student data on a public ledger for anyone to scrape.

VERIDAQ solves this with zero-knowledge proofs. A university uploads student credentials to their own backend server. The data stays there. Only a cryptographic hash the size of a 32-byte string goes to the blockchain. When an employer wants to verify a claim like "this graduate has a CGPA above 3.5," the backend generates a SnarkJS proof that says "this claim is true" without revealing the actual CGPA, name, matriculation number, or any personal identifier. The proof is verified on Base L2 and the result is permanent.

Built at the Federal University of Technology, Minna, Department of Cybersecurity Science, 2025/2026 academic session.

---

## The Problem in Detail

Paper certificates are trivially forgeable. A university letterhead, a stamp, and a signature can be replicated on any color printer. Digital certificates signed with PKI expire when the issuing domain expires or the root CA rotates its key. Blockchain certificates that store raw data on-chain violate GDPR Article 17 because you cannot delete data from an immutable ledger.

The current process looks like this:

1. A graduate applies for a job and submits their certificate.
2. The employer sends a verification request to the university by email, post, or phone.
3. The university registrar checks their internal database and sends a response weeks later.
4. If the response is positive, the employer trusts it. If it is negative, they repeat the process.

This takes weeks, costs money, and creates a paper trail that exposes student data to every party in between. VERIDAQ collapses this into seconds: upload once, verify any claim, zero data exposure.

---

## How VERIDAQ Works

Three roles, three workflows, one shared truth.

### For Universities

A registrar logs into the Institution Portal and uploads an XLSX file of graduating students. The file contains name, matriculation number, CGPA, degree classification, course code, and graduation year for each student. The backend computes a Poseidon hash of each record using a random blinding factor. Only the hash goes on-chain. The raw data is encrypted with AES-256-GCM and stored in PostgreSQL.

Key properties:
- The blinding factor ensures that two identical records produce different hashes.
- Poseidon is 100x more efficient than keccak256 inside arithmetic circuits.
- The institution key binds each credential to that specific university.
- Uploads are processed asynchronously through BullMQ so large batches do not block the API.

### For Employers

An employer logs into the Employer Portal and submits a verification request. They provide the institution ID, the candidate's matriculation number, the claim type (one of six), and a threshold value. The backend retrieves the encrypted record, decrypts it in memory for milliseconds during proof generation, and runs SnarkJS fullProve to produce a Groth16 proof. The proof is submitted to the on-chain verifier. The result is VERIFIED or NOT VERIFIED.

The employer never sees:
- The student's name
- The student's actual CGPA
- The student's matriculation number (it is hashed)
- Any raw data from the university database

### For Students

Students receive one email notification when their credential is registered on-chain. They take no action. They have no portal. Their personal data never touches the blockchain at any point in the lifecycle. The only record of their existence is a Poseidon hash that no one can reverse.

---

## Architecture

```
  ┌─────────────────────────────────────────────┐
  │           Next.js 15 Frontend               │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
  │  │Institution│ │ Employer │ │  Admin   │   │
  │  │  Portal   │ │  Portal  │ │  Portal  │   │
  │  └────┬─────┘ └────┬─────┘ └────┬─────┘   │
  └───────┼─────────────┼────────────┼─────────┘
          │             │            │
  ┌───────┼─────────────┼────────────┼─────────┐
  │       └─────────────┼────────────┘         │
  │              Fastify 5 Backend              │
  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │
  │  │ Auth &   │ │  Batch   │ │  Proof     │ │
  │  │ Routes   │ │  Worker  │ │  Service   │ │
  │  └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
  │       │            │              │        │
  │  ┌────┴────┐ ┌─────┴─────┐ ┌─────┴──────┐ │
  │  │ Prisma  │ │  BullMQ   │ │   viem 2   │ │
  │  │ (PG)    │ │  (Redis)  │ │  (Base L2) │ │
  │  └─────────┘ └───────────┘ └────────────┘ │
  └────────────────────────────────────────────┘
                       │
  ┌────────────────────────────────────────────┐
  │          Base Sepolia (EVM L2)             │
  │  ┌──────────────────────────────────────┐  │
  │  │  InstitutionRegistry.sol             │  │
  │  │  CredentialRegistry.sol              │  │
  │  │  RevocationRegistry.sol              │  │
  │  │  SubscriptionManager.sol             │  │
  │  │  PaymasterVault.sol (ERC-4337)       │  │
  │  │  Groth16Verifier.sol (auto-gen)      │  │
  │  └──────────────────────────────────────┘  │
  └────────────────────────────────────────────┘
```

---

## Repository Layout

```
veridaq/
├── AGENTS.md                    Codex/Copilot agent instructions
├── GUIDE.md                     Human setup guide
├── pnpm-workspace.yaml          Single workspace
├── package.json                 All dependencies at root
├── docker-compose.yml           PostgreSQL 16 + Redis 7
├── .env.example                 All environment variables documented
│
├── packages/
│   ├── contracts/               Foundry project
│   │   ├── src/                 6 Solidity contracts + mock verifier
│   │   ├── script/              Deploy.s.sol — forge script deployer
│   │   ├── test/                Foundry tests (Forge standard)
│   │   └── foundry.toml         Solidity 0.8.28, Base Sepolia RPC
│   │
│   ├── circuits/                Circom 2 project
│   │   ├── credential.circom    Main circuit — 45k constraints
│   │   ├── build/               Compiled R1CS, WASM, zkey, vk
│   │   └── scripts/             Trusted setup helpers
│   │
│   ├── backend/                 Fastify 5 API server
│   │   ├── prisma/              Schema, migrations, seed
│   │   └── src/
│   │       ├── config/          Zod-validated environment
│   │       ├── plugins/         auth, prisma, redis
│   │       ├── routes/          auth, institution, employer, admin, verification, payments, earnings
│   │       ├── services/        auth, institution, verification, proof, blockchain, email, earnings
│   │       ├── workers/         batch.processor, proof.queue
│   │       ├── utils/           crypto (AES-256-GCM), logger
│   │       └── test/            Vitest test suite
│   │
│   ├── frontend/                Next.js 15 App Router
│   │   ├── app/
│   │   │   ├── page.tsx         Landing page
│   │   │   ├── institution/     Institution portal (login, dashboard, batches, claims, verify, earnings, settings)
│   │   │   ├── employer/        Employer portal (login, dashboard, verify, history)
│   │   │   ├── admin/           Admin portal (login, dashboard, institutions, employers, earnings)
│   │   │   ├── docs/            Protocol documentation (5 tabs)
│   │   │   ├── blueprint/       Protocol blueprint page
│   │   │   ├── zkp/             ZKP circuit specifications
│   │   │   ├── privacy/         Privacy policy
│   │   │   └── resources/       Technical resources
│   │   ├── components/
│   │   │   ├── ui/              shadcn/ui primitives
│   │   │   ├── institution/     Institution components
│   │   │   ├── employer/        Employer components
│   │   │   └── admin/           Admin components
│   │   └── lib/                 api client, auth context, types, utils
│   │
│   └── extension/               Chrome Manifest V3 extension
│       └── src/                 Background, popup, content scripts
│
└── templates/                   Batch upload XLSX template
```

---

## Full Tech Stack

| Layer                  | Technology                               | Version       |
| ---------------------- | ---------------------------------------- | ------------- |
| Blockchain             | Base Sepolia (EVM L2, OP Stack)          |               |
| Smart contracts        | Solidity, Foundry, OpenZeppelin          | 0.8.28 / 5.x  |
| Account abstraction    | ERC-4337 v0.6 EntryPoint                 |               |
| ZKP system             | Circom, SnarkJS, Groth16                 | 2.0.8 / 0.7.x |
| Commitment hash        | Poseidon (circomlib / circomlibjs)       |               |
| Backend runtime        | Node.js, Fastify, TypeScript             | 22 / 5 / 5.8  |
| ORM                    | Prisma                                   | 6             |
| Database               | PostgreSQL                               | 16            |
| Queue / cache          | Redis, BullMQ                            | 7 / 5         |
| Blockchain client      | viem                                     | 2             |
| Frontend               | Next.js, React                           | 15 / 19       |
| Styling                | Tailwind CSS, shadcn/ui                  | 3.4 / latest  |
| Animation              | Framer Motion                            | 11            |
| Package manager        | pnpm (single root package.json)          | 9             |
| Infrastructure         | Docker Compose, Neon (production DB)     |               |
| Testing (contracts)    | Forge standard (foundry)                 |               |
| Testing (backend)      | Vitest                                   | 2             |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. The following table explains every variable and where to get it.

### Database and Redis

| Variable                  | Description                        | Where to Get It                      |
| ------------------------- | ---------------------------------- | ------------------------------------ |
| `DATABASE_URL`            | PostgreSQL connection string       | Local: `postgresql://veridaq:veridaq_dev@localhost:5432/veridaq` |
| `REDIS_URL`               | Redis connection string            | Local: `redis://localhost:6379`      |

### JWT and Auth

| Variable                  | Description                        | Where to Get It                      |
| ------------------------- | ---------------------------------- | ------------------------------------ |
| `JWT_SECRET`              | HMAC key for signing JWTs          | Generate: `openssl rand -hex 64`     |
| `JWT_ACCESS_EXPIRES_IN`   | Access token TTL                   | Default: `15m`                       |
| `JWT_REFRESH_EXPIRES_IN`  | Refresh token TTL                  | Default: `7d`                        |
| `BCRYPT_ROUNDS`           | bcrypt cost factor                 | Default: `12`                        |

### Blockchain (Base Sepolia)

| Variable                          | Description                            | Where to Get It                      |
| --------------------------------- | -------------------------------------- | ------------------------------------ |
| `ALCHEMY_BASE_SEPOLIA_URL`        | RPC endpoint for Base Sepolia          | Alchemy dashboard (free tier works)  |
| `PLATFORM_ADMIN_PRIVATE_KEY`      | Admin wallet private key               | Generated wallet with >= 0.05 ETH    |
| `PLATFORM_ADMIN_ADDRESS`          | Corresponding public address           | From the wallet                      |
| `PLATFORM_OPERATOR_PRIVATE_KEY`   | Operator key for crypto withdrawals    | Separate wallet (can be same)        |
| `BASE_SEPOLIA_CHAIN_ID`           | Chain ID                               | `84532`                              |
| `ENTRYPOINT_ADDRESS`              | ERC-4337 EntryPoint contract           | `0x0000000071727De22E5E9d8bAf0eD5fA35Ee7b8` |

### Contract Addresses (deployed)

| Variable                              | Description                     |
| ------------------------------------- | ------------------------------- |
| `INSTITUTION_REGISTRY_ADDRESS`        | InstitutionRegistry contract    |
| `CREDENTIAL_REGISTRY_ADDRESS`         | CredentialRegistry contract     |
| `REVOCATION_REGISTRY_ADDRESS`         | RevocationRegistry contract     |
| `SUBSCRIPTION_MANAGER_ADDRESS`        | SubscriptionManager contract    |
| `PAYMASTER_VAULT_ADDRESS`             | PaymasterVault contract         |
| `ZK_VERIFIER_ADDRESS`                 | Groth16Verifier contract        |
| `AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS`   | SimpleAccountFactory contract   |

### Circuit Paths

| Variable                  | Description                        | Default Value                       |
| ------------------------- | ---------------------------------- | ----------------------------------- |
| `CIRCUIT_ZKEY_PATH`       | Path to proving key                | `packages/circuits/build/credential_final.zkey` |
| `CIRCUIT_WASM_PATH`       | Path to circuit WASM               | `packages/circuits/build/credential_js/credential.wasm` |

### Revenue Sharing and Pricing

| Variable                  | Description                        | Default |
| ------------------------- | ---------------------------------- | ------- |
| `PLATFORM_REVENUE_SHARE`  | Platform cut per verification      | `0.70`  |
| `INSTITUTION_REVENUE_SHARE` | Institution cut per verification | `0.20`  |
| `GAS_POOL_REVENUE_SHARE`  | Gas pool accumulation rate         | `0.10`  |
| `VERIFICATION_CREDIT_PRICE_USD` | Price per single credit      | `1.50`  |
| `GAS_POOL_ADDRESS`        | Ethereum address for gas pool       |         |

### Email (optional)

| Variable                  | Description                        |
| ------------------------- | ---------------------------------- |
| `SMTP_HOST`               | SMTP server host                   |
| `SMTP_PORT`               | SMTP server port                   |
| `SMTP_USER`               | SMTP username                      |
| `SMTP_PASS`               | SMTP password                      |
| `EMAIL_FROM`              | Sender email address               |

---

## Quick Start

### Prerequisites

- Node.js 22 (install via nvm or fnm)
- pnpm 9 (`npm install -g pnpm@9`)
- Docker Desktop or Docker Engine (for local PostgreSQL and Redis)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Circom 2.0.8 (install from GitHub releases)
- A wallet with Base Sepolia testnet ETH (https://base.org/faucet)

### Step 1 — Install Dependencies

```bash
# Install Foundry dependencies (OpenZeppelin, account-abstraction)
cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install eth-infinitism/account-abstraction --no-commit
cd ../..

# Install Node.js dependencies
pnpm install
```

### Step 2 — Start Local Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379. Both containers use health checks and will not be ready until the database finishes initialization.

Verify they are running:

```bash
docker compose ps
```

Both services should show `healthy`.

### Step 3 — Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:
- `JWT_SECRET` — generate with `openssl rand -hex 64`
- `ALCHEMY_BASE_SEPOLIA_URL` — from Alchemy dashboard
- `PLATFORM_ADMIN_PRIVATE_KEY` and `PLATFORM_ADMIN_ADDRESS` — from a wallet with Base Sepolia ETH

### Step 4 — Run Migrations and Seed

```bash
pnpm db:migrate
pnpm db:seed
```

The seed script creates default accounts and sample data. Look for three lines starting with `Seeded:` to confirm success.

### Step 5 — Compile and Test Contracts

```bash
cd packages/contracts && forge build
forge test -vvv
```

All 89 tests (5 suites) should pass with zero failures. If tests fail, check your Solidity version and OpenZeppelin dependency.

### Step 6 — Compile ZKP Circuit

```bash
pnpm circuit:compile
pnpm circuit:setup
```

The compile step runs Circom on `credential.circom` and outputs R1CS plus WASM files to `build/`. The setup step downloads the Hermez Powers of Tau file (~230 MB), runs phase 2, applies a random beacon, and exports the proving key and verification key. It also generates `packages/contracts/src/ZKVerifier.sol`.

This is the longest step. Plan for 5-10 minutes depending on your internet connection.

### Step 7 — Deploy Contracts

```bash
pnpm contracts:deploy
```

This runs `forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify`. The deploy script prints all contract addresses. Copy them into your `.env` file.

Verify deployment:

```bash
cast call $INSTITUTION_REGISTRY_ADDRESS "owner()(address)" --rpc-url $ALCHEMY_BASE_SEPOLIA_URL
```

Should return your deployer address.

### Step 8 — Start Development

```bash
pnpm dev:backend   # Terminal 1 — API server on port 4000
pnpm dev:frontend  # Terminal 2 — Next.js on port 3000
```

Open http://localhost:3000. The backend Swagger UI is at http://localhost:4000/docs.

---

## Default Development Accounts

Created by `pnpm db:seed`. These exist only in your local PostgreSQL database and are seeded with pre-approved KYC status so you can test immediately.

| Portal      | URL                | Email                 | Password    |
| ----------- | ------------------ | --------------------- | ----------- |
| Institution | /institution/login | futminna@veridaq.xyz  | Inst@2026!  |
| Employer    | /employer/login    | firstbank@veridaq.xyz | Emp@2026!   |
| Admin       | /admin/login       | admin@veridaq.xyz     | Admin@2026! |

---

## Contract Reference

### InstitutionRegistry.sol

Maps institution bytes32 IDs to name and admin wallet. Owned by platform admin.

| Function           | Description                                  |
| ------------------ | -------------------------------------------- |
| `registerInstitution(bytes32 id, string name, address admin)` | Register a new institution |
| `getInstitution(bytes32 id)` | Returns (name, admin, active) |
| `isRegistered(bytes32 id)` | Returns true if institution exists |

### CredentialRegistry.sol

Stores batches of (commitment, nullifier) pairs per institution.

| Function           | Description                                  |
| ------------------ | -------------------------------------------- |
| `registerBatch(bytes32 institutionId, bytes32[] commitments, bytes32[] nullifiers)` | Submit a batch |
| `isCommitmentValid(bytes32 commitment, bytes32 nullifier)` | Check if pair exists and not revoked |
| `getBatchCount(bytes32 institutionId)` | Number of batches for institution |

### RevocationRegistry.sol

Append-only list of revoked nullifiers.

| Function           | Description                                  |
| ------------------ | -------------------------------------------- |
| `revoke(bytes32 nullifier)` | Revoke a single credential |
| `revokeBatch(bytes32[] nullifiers)` | Revoke multiple credentials |
| `isRevoked(bytes32 nullifier)` | Returns true if nullifier is revoked |

### SubscriptionManager.sol

Tracks institution tiers (FREE vs PAID) and employer credits.

| Function           | Description                                  |
| ------------------ | -------------------------------------------- |
| `setTier(bytes32 institutionId, uint8 tier)` | Set FREE (0) or PAID (1) |
| `addCredits(address employer, uint256 amount)` | Add verification credits |
| `consumeCredit(address employer)` | Deduct one credit, returns remaining |

### PaymasterVault.sol

ERC-4337 Paymaster that sponsors gas for institution operations.

| Function           | Description                                  |
| ------------------ | -------------------------------------------- |
| `deposit(bytes32 institutionId)` | Deposit ETH for an institution |
| `withdraw(bytes32 institutionId, uint256 amount)` | Admin withdraws institution balance |
| `balanceOf(bytes32 institutionId)` | ETH balance for an institution |

### Groth16Verifier.sol

Auto-generated by SnarkJS from the Circom circuit. Uses BN254 pairing precompiles. Approximately 236,000 gas per verification.

---

## ZKP Circuit Details

File: `packages/circuits/credential.circom`

The circuit proves that a Poseidon hash commitment was computed from private inputs that satisfy a claimed condition. It has three constraint groups:

**Commitment constraint:** The Poseidon hash of all 7 private inputs (nameHash, matricHash, cgpa, classification, courseHash, graduationYear, blindingFactor) must equal the public commitment signal. This proves the backend possesses the original data.

**Nullifier constraint:** The Poseidon hash of (matricHash, institutionKey) must equal the public nullifier signal. This binds the credential to a specific institution and prevents double-verification.

**Claim constraint:** The ClaimDecoder template must output 1 for the given claimType and threshold. Six claim types are supported:
1. Programme Completion
2. Minimum Lower Second Class (classification >= 2)
3. Minimum Upper Second Class (classification >= 3)
4. First Class Honours (classification == 4)
5. CGPA Above Threshold (cgpa >= threshold)
6. Course Specific Completion (courseHash matches AND grade passes)

Performance: ~45,000 R1CS constraints, ~0.7 second proof generation on modern CPU, ~236,000 gas on-chain verification.

---

## API Overview

The Fastify backend exposes approximately 60 routes across these modules:

| Module         | Prefix              | Key Endpoints                               |
| -------------- | ------------------- | ------------------------------------------- |
| Auth           | `/api/auth`         | login, refresh, logout (3 roles)            |
| Institution    | `/api/institution`  | profile, batch upload, batch status, claims, settings, earnings |
| Employer       | `/api/employer`     | profile, credits, history                   |
| Verification   | `/api/verify`       | request, status, history                    |
| Admin          | `/api/admin`        | institutions, employers, kyc, earnings      |
| Payments       | `/api/payment`      | create intent, webhook                      |

Every request body is validated with Zod before any database or blockchain interaction. Authentication uses short-lived JWTs stored in httpOnly cookies.

---

## Security Model

### No Personal Data On-Chain

The system uses Poseidon hash commitments with a random blinding factor. Given only the bytes32 commitment on-chain, an attacker cannot determine the underlying student data. The blinding factor ensures that even two identical records produce different commitments.

### Non-Forgeability of Proofs

The Groth16 verifier contract uses BN254 elliptic curve pairings to verify the mathematical soundness of every proof. Without a valid witness that satisfies all circuit constraints, the proof fails. The backend cannot fabricate a VERIFIED result.

### Revocation

Institutions can revoke individual credentials by submitting the nullifier to the RevocationRegistry. Once revoked, the credential can never be verified again, regardless of proof validity. This handles graduates whose degrees are rescinded or who are found to have submitted fraudulent transcripts during admission.

### JWT Security

Access tokens expire after 15 minutes and live only in memory. Refresh tokens expire after 7 days and are stored in httpOnly cookies that JavaScript cannot read. The API uses rate limiting on all auth endpoints: 5 attempts per IP per 15 minutes.

### Input Validation

Every API endpoint validates its request body with Zod. Malformed requests are rejected before any business logic or database query runs. This prevents injection attacks, type confusion, and schema violations.

### Encryption at Rest

Student credential data is encrypted with AES-256-GCM before being stored in PostgreSQL. The encryption key is stored in the environment and never written to the database. Data is decrypted only in memory during the milliseconds needed for proof generation, then discarded.

### Audit Trail

Every verification request is logged with a unique ID, the public signals, the transaction hash, and the result. Admins can audit any verification on-chain by looking up the transaction hash on BaseScan.

---

## Testing

### Smart Contracts

```bash
cd packages/contracts && forge test -vvv
```

89 tests across 5 suites. Covers:
- Institution registration and edge cases
- Batch registration with zero, one, and many records
- Revocation and re-revocation attempts
- Subscription tier changes
- Paymaster deposit and withdrawal
- ZK verifier with valid and invalid proofs

### Backend

```bash
pnpm test:backend
```

37+ tests across 5+ suites. Covers:
- Authentication (login, refresh, rate limiting, role guards)
- Institution workflows (profile, batch)
- Employer workflows (profile, credits)
- Verification requests (create, status, history)
- Admin operations (KYC approval, institution management)
- Payment integration (create intent, webhook handling)
- Earnings and revenue sharing (credit, withdrawal, gas pool)

### All Checks

```bash
pnpm lint
pnpm typecheck
pnpm test:backend
cd packages/contracts && forge test -vvv
```

Run these before every commit to main. The pre-push Husky hook runs them automatically.

---

## Deployment

### Local Development

```bash
docker compose up -d
pnpm dev:backend
pnpm dev:frontend
```

### Production Build

```bash
pnpm build:backend
pnpm build:frontend
```

Both must pass with zero TypeScript errors. The backend build outputs to `packages/backend/dist/` and the frontend build outputs to `packages/frontend/.next/`.

### Docker Compose Production

The `docker-compose.yml` file can be adapted for production by replacing the local PostgreSQL and Redis services with external Neon and Upstash URLs. Set the `DATABASE_URL` and `REDIS_URL` environment variables to point to your managed services.

---

## Revenue Model

VERIDAQ uses a revenue sharing model for credential verification:

- **Platform fee:** 70 percent of each verification credit consumed
- **Institution share:** 20 percent of each verification credit consumed (even when an institution verifies their own students through the institution-as-employer feature)
- **Gas savings pool:** 10 percent accumulated to subsidize on-chain gas costs

Batch upload pricing is based on file size:
- 1,001–5,000 records: $20
- 5,001–10,000 records: $30
- 10,001–25,000 records: $90
- 25,001–50,000 records: $170

Verification credits are sold in packs:
- 10 credits: $15
- 50 credits: $65
- 100 credits: $120
- 250 credits: $275
- 500 credits: $550

---

## Common Issues and Troubleshooting

### Database connection refused

```
Error: connect ECONNREFUSED ::1:5432
```

Docker is not running or PostgreSQL is not started. Run `docker compose up -d` and wait 15 seconds for the health check to pass.

### Seed script fails

```
Error: Unique constraint failed on the fields: (`email`)
```

You have run `pnpm db:seed` before. Run `pnpm db:reset && pnpm db:seed` to reset the database and re-seed.

### Forge build fails with OpenZeppelin import error

```
Error: Source "lib/openzeppelin-contracts/contracts/access/Ownable.sol" not found
```

Run `forge install OpenZeppelin/openzeppelin-contracts --no-commit` from `packages/contracts/`.

### Circuit setup takes too long

The Hermez Powers of Tau file is approximately 230 MB. Download speed depends on your internet connection. The file is cached after first download and reused for subsequent runs.

### Wallet has insufficient ETH for deployment

The deployer wallet needs at least 0.05 ETH on Base Sepolia. Use the faucet at https://base.org/faucet.

### Transaction reverted during deploy

This usually means the EntryPoint address is wrong or the constructor arguments are incorrect. Check that `ENTRYPOINT_ADDRESS` in `.env` matches the canonical ERC-4337 v0.6 address.

---

## Contributing

This is an academic project and is not currently accepting external contributions. If you find a bug or have a suggestion, open an issue on GitHub.

---

## License

MIT — see the `LICENSE` file for details.

> This project has not been audited. Do not use for production credential verification without an independent security review. The zero-knowledge circuits, smart contracts, and backend infrastructure should all undergo professional audits before handling real student data.
