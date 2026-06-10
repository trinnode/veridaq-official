# VERIDAQ

**Censor-Resistant Academic Truth.**

VERIDAQ lets universities register student credentials on-chain as Poseidon hash
commitments and lets employers verify specific academic claims through Groth16
Zero-Knowledge Proofs. No student name, grade, matriculation number, or personal
attribute ever appears on the public blockchain in readable form.

Built as a final year B.Tech project at the Federal University of Technology, Minna,
Department of Cybersecurity Science, 2025/2026 session.

---

## What it does

A university registrar uploads an Excel file of graduating students. The backend
computes a Poseidon hash commitment and a nullifier for each student record and
submits them on-chain in a single batch transaction. No raw data leaves the backend.

When an employer wants to verify a candidate's qualifications, they submit the
candidate's matriculation number, their institution, and the specific claim they
want confirmed (for example, "minimum Upper Second Class"). The backend retrieves
the private credential data, generates a Groth16 ZKP off-chain proving the claim
is true, then submits the proof to the on-chain verifier. The result is VERIFIED or
NOT VERIFIED. The transaction hash is the permanent audit record.

Students receive one email when their credential is registered. They have no portal
and need to take no action.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js 15 frontend                  │
│           Institution │ Employer │ Admin portals          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼──────────────────────────────┐
│                   Fastify 5 backend                      │
│   Auth │ Batch upload │ Proof generation │ Admin API     │
│   Prisma 6 (PostgreSQL) │ BullMQ (Redis) │ viem 2       │
└──────────────────────────┬──────────────────────────────┘
                           │ JSON-RPC (Alchemy)
┌──────────────────────────▼──────────────────────────────┐
│                  Base Sepolia (EVM L2)                   │
│  InstitutionRegistry │ CredentialRegistry               │
│  RevocationRegistry  │ SubscriptionManager              │
│  PaymasterVault      │ Groth16Verifier                  │
└─────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer               | Technology                               |
| ------------------- | ---------------------------------------- |
| Blockchain          | Base Sepolia, EVM L2 by Coinbase         |
| Smart contracts     | Solidity 0.8.28, Foundry, OpenZeppelin 5 |
| Account abstraction | ERC-4337 Paymaster                       |
| ZKP circuit         | Circom 2.0.8, SnarkJS 0.7, Groth16       |
| Commitment hash     | Poseidon (circomlibjs)                   |
| Backend             | Node.js 22, Fastify 5, TypeScript 5.8    |
| Database            | PostgreSQL 16, Prisma 6                  |
| Queue               | Redis 7, BullMQ 5                        |
| Blockchain client   | viem 2                                   |
| Frontend            | Next.js 15 App Router, React 19          |
| Styling             | Tailwind CSS 3.4                         |
| Package manager     | pnpm 9 (single root package.json)        |
| Infrastructure      | Docker Compose                           |

---

## Project structure

```
veridaq/
  packages/
    contracts/     Foundry project — 5 Solidity contracts + tests + deploy script
    circuits/      Circom 2 circuit + trusted setup scripts
    backend/       Fastify 5 API — routes, services, BullMQ workers, Prisma
    frontend/      Next.js 15 App Router — institution, employer, admin portals
  AGENTS.md        Codex/Copilot agent instructions
  GUIDE.md         Full setup guide
  docker-compose.yml  PostgreSQL 16 + Redis 7
  package.json     All npm dependencies for the entire monorepo
  pnpm-workspace.yaml  Monorepo config
```

---

## Quick start

```bash
# 1. Install Foundry dependencies
cd packages/contracts && forge install && cd ../..

# 2. Install Node dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Fill in the required values — see GUIDE.md Step 4

# 4. Start the database and cache
docker compose up -d

# 5. Run migrations and seed default accounts
pnpm db:migrate && pnpm db:seed

# 6. Build contracts and run tests
cd packages/contracts && forge test -vvv && cd ../..

# 7. Compile the ZKP circuit (takes several minutes on first run)
pnpm circuit:compile && pnpm circuit:setup

# 8. Deploy contracts to Base Sepolia
pnpm contracts:deploy

# 9. Start development servers
pnpm dev
```

Open http://localhost:3000.

See `GUIDE.md` for the full step-by-step guide including troubleshooting.

---

## Default development accounts

These are created by `pnpm db:seed` and only exist in your local database.

| Role        | Email                 | Password    |
| ----------- | --------------------- | ----------- |
| Admin       | admin@veridaq.xyz     | Admin@2026! |
| Institution | futminna@veridaq.xyz  | Inst@2026!  |
| Employer    | firstbank@veridaq.xyz | Emp@2026!   |

---

## Smart contracts

| Contract            | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| InstitutionRegistry | On-chain identity for registered universities            |
| CredentialRegistry  | Stores (commitment, nullifier) pairs in batches          |
| RevocationRegistry  | Append-only revocation list keyed by nullifier           |
| SubscriptionManager | Institution tier management (FREE / PAID)                |
| PaymasterVault      | ERC-4337 Paymaster, isolates ETH balance per institution |
| Groth16Verifier     | Generated by SnarkJS from the Circom circuit             |

---

## ZKP circuit

The circuit is in `packages/circuits/credential.circom`. It proves that a given
commitment was computed from private inputs that satisfy the claimed property,
without revealing the private inputs.

Private inputs: student name, matric number, CGPA, degree class, course code,
graduation year, random blinding factor.

Public inputs: commitment, nullifier, claim type, claim threshold.

The Poseidon hash function is used throughout because it is efficient inside
arithmetic circuits. Using keccak256 here would make the circuit impractically large.

---

## Security properties

The system provides the following guarantees by construction:

**No personal data on-chain.** Commitments are Poseidon hashes of seven private
inputs including a random blinding factor. The hash is computationally hiding:
given only the commitment, an adversary learns nothing about the underlying data.

**Non-forgeability.** The Groth16 verifier on-chain checks mathematical soundness
of the proof. The backend cannot fabricate a VERIFIED result without a valid
witness.

**Revocation.** Institutions can revoke any credential by nullifier. The verifier
checks the RevocationRegistry before accepting a proof.

**JWT hygiene.** Access tokens live in memory only. Refresh tokens are in httpOnly
cookies. Neither is ever stored in localStorage.

**Input validation.** Every API endpoint validates its request body with Zod before
touching the database or blockchain.

---

## Acknowledgements

This project builds on work by the Ethereum community, the iden3 team (Circom,
circomlibjs), the OpenZeppelin team, the Foundry team, and the Base team at Coinbase.

The trusted setup uses the Hermez Powers of Tau ceremony conducted by the Hermez
Network team in 2020.

---

## Licence

MIT — see `LICENSE` file.

> This is an academic project. It has not been audited. Do not use for production
> credential verification without an independent security review.
