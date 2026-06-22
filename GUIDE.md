# VERIDAQ Setup Guide

This guide walks you through the complete setup of VERIDAQ from a fresh clone to a running development environment. It covers every step with exact commands you can copy and paste.

---

## Prerequisites

Before you start, install these tools on your machine.

| Tool | Version | Installation |
| ---- | ------- | ------------ |
| Node.js | 22.x | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh \| bash && nvm install 22` |
| pnpm | 9.x | `npm install -g pnpm@9` |
| Foundry | latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Circom | 2.0.8 | Download from https://github.com/iden3/circom/releases |
| Docker | latest | https://docs.docker.com/engine/install/ |
| Git | latest | `apt install git` or `brew install git` |

Verify everything is installed:

```bash
node --version    # should show v22.x
pnpm --version    # should show 9.x
forge --version   # should show forge [latest]
circom --version  # should show circom 2.0.8
docker --version  # should show Docker version [latest]
```

---

## Step 1: Clone and Install Dependencies

```bash
git clone <repo-url> veridaq
cd veridaq
```

The workspace uses a single root `package.json` with pnpm workspaces. All packages share this one file.

```bash
pnpm install
```

This installs all dependencies for the backend, frontend, and shared libraries.

Now install the Foundry dependencies:

```bash
cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install eth-infinitism/account-abstraction --no-commit
cd ../..
```

---

## Step 2: Start Local Infrastructure

Start PostgreSQL 16 and Redis 7 using Docker Compose:

```bash
docker compose up -d
```

Wait for the containers to become healthy:

```bash
docker compose ps
```

Both `postgres` and `redis` should show `healthy` in the status column. If they show `unhealthy`, wait 10 seconds and check again.

---

## Step 3: Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` in your editor. You need to set at minimum these values:

```
JWT_SECRET=<run: openssl rand -hex 64>
ALCHEMY_BASE_SEPOLIA_URL=<your alchemy rpc url>
PLATFORM_ADMIN_PRIVATE_KEY=<your wallet private key>
PLATFORM_ADMIN_ADDRESS=<your wallet address>
```

Generate a JWT secret:

```bash
openssl rand -hex 64
```

Get an Alchemy RPC URL by creating a free account at https://alchemy.com, creating an app on Base Sepolia, and copying the HTTPS endpoint.

For the wallet, you can use any Ethereum wallet. The address needs Base Sepolia ETH for contract deployment. Get test ETH from the faucet at https://base.org/faucet.

All other variables have sensible defaults for local development. The full variable reference is in `.env.example`.

---

## Step 4: Database Migrations and Seed

```bash
pnpm db:migrate
pnpm db:seed
```

The migration creates all tables defined in the Prisma schema. The seed script creates:

1. One admin account: `admin@veridaq.xyz` / `Admin@2026!`
2. One institution account: `futminna@veridaq.xyz` / `Inst@2026!`
3. One employer account: `firstbank@veridaq.xyz` / `Emp@2026!`
4. Six claim type definitions
5. A gas pool record

You should see three lines starting with `Seeded:` confirming success.

If you see a unique constraint error, you have already seeded the database. Run `pnpm db:reset && pnpm db:seed` to reset and re seed.

---

## Step 5: Compile Smart Contracts

```bash
cd packages/contracts
forge build
cd ../..
```

There should be zero compiler errors. Warnings about unused variables in test files are acceptable.

Run the contract tests:

```bash
cd packages/contracts
forge test -vvv
cd ../..
```

All 89 tests across 5 suites should pass. If tests fail, check your OpenZeppelin dependency. Run `forge install OpenZeppelin/openzeppelin-contracts --no-commit` from `packages/contracts/` to fix it.

---

## Step 6: Compile the ZKP Circuit

```bash
pnpm circuit:compile
pnpm circuit:setup
```

The compile step runs Circom on `packages/circuits/credential.circom` and outputs R1CS and WASM files to `packages/circuits/build/`.

The setup step does three things:

1. Downloads the Hermez Powers of Tau file (approximately 230 MB) from AWS S3. This file is cached after the first download.
2. Runs the Groth16 phase 2 setup to generate the proving key.
3. Applies a random beacon to destroy toxic waste.
4. Exports the verification key to `verification_key.json`.
5. Generates `packages/contracts/src/ZKVerifier.sol` from the circuit.

This is the longest step. On a typical broadband connection the download takes 2-5 minutes and the setup takes 1-3 minutes.

If you cannot run the full setup, replace `ZKVerifier.sol` with the mock verifier shown in `AGENTS.md`.

---

## Step 7: Deploy Contracts to Base Sepolia

Make sure your wallet has at least 0.05 ETH on Base Sepolia.

```bash
pnpm contracts:deploy
```

This runs:

```bash
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

The script deploys all 8 contracts in dependency order and prints their addresses. Copy these addresses into your `.env` file under the corresponding variable names:

- `INSTITUTION_REGISTRY_ADDRESS`
- `CREDENTIAL_REGISTRY_ADDRESS`
- `REVOCATION_REGISTRY_ADDRESS`
- `SUBSCRIPTION_MANAGER_ADDRESS`
- `PAYMASTER_VAULT_ADDRESS`
- `ZK_VERIFIER_ADDRESS`
- `AA_SIMPLE_ACCOUNT_FACTORY_ADDRESS`

The deploy script automatically grants BUNDLER_ROLE to the VERIDAQ Admin on the SubscriptionManager contract.

Verify the deployment:

```bash
cast call $INSTITUTION_REGISTRY_ADDRESS "owner()(address)" \
  --rpc-url $ALCHEMY_BASE_SEPOLIA_URL
```

This should return your deployer address.

---

## Step 8: Start Development

Open two terminals.

Terminal 1: Backend server

```bash
pnpm dev:backend
```

This starts the Fastify 5 API server on port 4000 with hot reload via tsx watch. The server logs every request and shows Zod validation errors in a human readable format.

Open http://localhost:4000/docs to see the Swagger UI with all available routes.

Terminal 2: Frontend server

```bash
pnpm dev:frontend
```

This starts the Next.js 15 development server on port 3000.

---

## Step 9: Login and Test

Open http://localhost:3000 in your browser.

### Test as Institution

1. Click Institution in the top navigation bar.
2. Log in with `futminna@veridaq.xyz` / `Inst@2026!`.
3. You see the institution dashboard with stats for credentials, verifications, and earnings.
4. Navigate to Batches to upload a credential batch.
5. Navigate to Claims to manage claim definitions.
6. Navigate to Earnings to see revenue share balance.
7. Open Settings to toggle employer access.

### Test as Employer

1. Click Employer in the top navigation bar.
2. Log in with `firstbank@veridaq.xyz` / `Emp@2026!`.
3. Navigate to Verify to submit a verification request.
4. Enter the institution ID (FUTMINNA), a matriculation number, a claim type, and a threshold.
5. The backend generates a proof and returns VERIFIED or NOT VERIFIED.

### Test as Admin

1. Navigate to http://localhost:3000/admin/login.
2. Log in with `admin@veridaq.xyz` / `Admin@2026!`.
3. Approve institutions, manage employers, view platform earnings.
4. Navigate to Earnings to see the gas pool balance and platform revenue.

---

## Directory Structure

```
veridaq/
  README.md           This project overview
  GUIDE.md            This file
  AGENTS.md           Instructions for AI coding agents
  package.json        Root package with all dependencies
  pnpm-workspace.yaml Workspace configuration
  docker-compose.yml  PostgreSQL 16 and Redis 7
  .env.example        All environment variables documented
  .env                Your local configuration (gitignored)

  packages/
    contracts/        Foundry Solidity project
      src/            8 Solidity contracts
      script/         Deploy.s.sol
      test/           89 tests across 5 suites
      foundry.toml    Solidity 0.8.28 configuration

    circuits/         Circom 2 ZKP project
      credential.circom  Main circuit (45k constraints)
      build/             Compiled outputs (R1CS, WASM, zkey)

    backend/          Fastify 5 TypeScript API
      prisma/           Schema, migrations, seed
      src/
        config/         Zod validated environment
        plugins/        auth, prisma, redis plugins
        routes/         auth, institution, employer, admin,
                        verification, payments, earnings
        services/       auth, institution, verification,
                        proof, blockchain, email, earnings
        workers/        batch processor, proof queue
        utils/          crypto, logger
        test/           37+ tests across 5+ suites

    frontend/         Next.js 15 App Router
      app/
        page.tsx              Landing page
        institution/          Institution portal
        employer/             Employer portal
        admin/                Admin portal
        docs/                 Protocol documentation
        blueprint/            Protocol blueprint
        zkp/                  Circuit specifications
        privacy/              Privacy policy
        resources/            Technical resources
      components/
        ui/                   shadcn/ui primitives
        institution/          Institution components
        employer/             Employer components
        admin/                Admin components
      lib/
        api.ts                Axios client with auto refresh
        auth.tsx              Auth context
        types.ts              Shared TypeScript types
        utils.ts              Helpers

    extension/        Chrome Manifest V3 extension
      src/              Popup, panel, service worker
```

---

## Default Accounts

| Portal | URL | Email | Password |
| --- | --- | --- | --- |
| Institution | /institution/login | futminna@veridaq.xyz | Inst@2026! |
| Employer | /employer/login | firstbank@veridaq.xyz | Emp@2026! |
| Admin | /admin/login | admin@veridaq.xyz | Admin@2026! |

These accounts exist only in your local database. They have pre approved KYC status so you can test immediately.

---

## Running Tests

### Smart Contracts

```bash
cd packages/contracts
forge test -vvv
```

Runs all 89 tests with verbose output showing gas costs and event emissions.

### Backend

```bash
pnpm test:backend
```

Runs all backend tests using Vitest. Tests cover authentication, institution workflows, employer workflows, verification, admin operations, payments, and earnings.

### Type Checking

```bash
pnpm typecheck
```

Runs TypeScript compiler on both backend and frontend with noEmit. Zero errors required before committing.

### Linting

```bash
pnpm lint
```

Runs ESLint on the backend and biome on the frontend.

---

## Troubleshooting

### Database connection error

```
Error: connect ECONNREFUSED ::1:5432
```

Docker is not running or PostgreSQL has not finished starting. Run `docker compose up -d` and wait 15 seconds. Check `docker compose ps` to confirm both services are healthy.

### Prisma migration fails

```
Error: P1000: Authentication failed
```

The DATABASE_URL in `.env` has incorrect credentials. The default is `postgresql://veridaq:veridaq_dev@localhost:5432/veridaq`. Verify the password matches what is in `docker-compose.yml`.

### Seed script fails with unique constraint

```
Error: Unique constraint failed on the fields: (`email`)
```

You have already seeded. Run `pnpm db:reset && pnpm db:seed` to reset and re seed.

### Forge build fails

```
Error: Source "lib/openzeppelin-contracts/contracts/access/Ownable.sol" not found
```

Run `forge install OpenZeppelin/openzeppelin-contracts --no-commit` from `packages/contracts/`.

### Circuit setup is slow

The Hermez Powers of Tau file is approximately 230 MB. Download speed depends on your internet. The file is cached after first download so subsequent runs are fast.

### Contract deployment fails

```
Error: insufficient funds for gas * price + value
```

Your wallet needs at least 0.05 ETH on Base Sepolia. Get test ETH from the faucet at https://base.org/faucet.

### Contract verification fails on BaseScan

```
Error: Failed to verify contract
```

Make sure your Alchemy RPC URL is correct and your API key has access to Base Sepolia. You can also verify manually using the `forge verify-contract` command.

### Backend fails to start

```
Error: Missing required environment variable: PLATFORM_ADMIN_PRIVATE_KEY
```

Check your `.env` file has all required variables. The full list is in `.env.example`. Every variable marked as required must have a value.

### Proof generation fails

```
Error: Failed to generate proof
```

Check that CIRCUIT_ZKEY_PATH and CIRCUIT_WASM_PATH point to existing files. If you have not run `pnpm circuit:setup`, the zkey file does not exist.

---

## Production Deployment

For production deployment, replace the local Docker services with managed alternatives:

| Service | Local | Production |
| --- | --- | --- |
| PostgreSQL | Docker container | Neon (serverless) |
| Redis | Docker container | Upstash (serverless) |
| Backend | tsx watch | Node.js 22 production |
| Frontend | Next.js dev | Next.js build + start |

Update your `.env` to point DATABASE_URL and REDIS_URL to your managed services. Run `pnpm build:backend && pnpm build:frontend` before deploying.

---

## Revenue Model Reference

Veridaq uses a revenue sharing model for credential verification.

**Revenue split per verification credit consumed:**

| Party | Share | Purpose |
| --- | --- | --- |
| Platform | 70 percent | Infrastructure, development, operations |
| Institution | 20 percent | Earned by the issuing institution |
| Gas pool | 10 percent | Accumulated to subsidize on chain gas |

**Batch upload pricing:**

| Record Count | Price |
| --- | --- |
| 1,001 to 5,000 | $20 |
| 5,001 to 10,000 | $30 |
| 10,001 to 25,000 | $90 |
| 25,001 to 50,000 | $170 |

**Verification credit packs:**

| Credits | Price |
| --- | --- |
| 10 | $15 |
| 50 | $65 |
| 100 | $120 |
| 250 | $275 |
| 500 | $550 |

---

## Common Commands Reference

```bash
pnpm install              # Install all dependencies
docker compose up -d      # Start PostgreSQL and Redis
pnpm db:migrate           # Apply database migrations
pnpm db:seed              # Seed default data
pnpm db:reset             # Reset database
pnpm db:studio            # Open Prisma Studio
pnpm dev:backend          # Start backend server
pnpm dev:frontend         # Start frontend server
pnpm test:backend         # Run backend tests
pnpm test:contracts       # Run contract tests
pnpm typecheck            # Type check both projects
pnpm lint                 # Lint both projects
pnpm circuit:compile      # Compile ZKP circuit
pnpm circuit:setup        # Run trusted setup
pnpm contracts:deploy     # Deploy to Base Sepolia
pnpm build:backend        # Production build backend
pnpm build:frontend       # Production build frontend
```
