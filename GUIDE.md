# VERIDAQ Setup Guide

This guide takes you from a fresh clone to a fully running local development
environment, a deployed set of contracts on Base Sepolia, and a compiled ZKP
circuit. Work through the sections in order the first time.

---

## Prerequisites

These tools must be installed on your machine before you start.

| Tool    | Version | How to get it                                           |
| ------- | ------- | ------------------------------------------------------- |
| Node.js | 22.x    | https://nodejs.org or `nvm install 22`                  |
| pnpm    | 9.x     | `npm install -g pnpm`                                   |
| Foundry | latest  | https://book.getfoundry.sh/getting-started/installation |
| Circom  | 2.0.8   | `npm install -g circom` — https://docs.circom.io        |
| Docker  | latest  | https://www.docker.com/products/docker-desktop          |
| Git     | 2.x     | https://git-scm.com                                     |

Verify Foundry is installed:

```bash
forge --version
cast --version
anvil --version
```

---

## Step 1: Open the workspace

Open the `veridaq` folder in VS Code. When the recommended extensions prompt
appears, accept it. VS Code will install ESLint, Prettier, Solidity support,
and Prisma tooling.

If you have GitHub Copilot enabled and signed in, it will automatically pick up
`AGENTS.md` and `.github/copilot-instructions.md` to guide its suggestions.

---

## Step 2: Install Foundry dependencies

The contracts use OpenZeppelin 5 and forge-std via git submodules.

```bash
cd packages/contracts &&
forge install &&
cd ../..
```

This populates `packages/contracts/lib/`. You only need to do this once.

---

## Step 3: Install Node dependencies

From the workspace root:

```bash
pnpm install
```

All packages for the backend, frontend, and tooling are installed from the
single root `package.json`. No separate installs in subdirectories.

---

## Step 4: Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

Open `.env` and fill in the following required values:

| Variable                     | Where to get it                                           |
| ---------------------------- | --------------------------------------------------------- |
| `ALCHEMY_API_KEY`            | https://dashboard.alchemy.com — create a Base Sepolia app |
| `ALCHEMY_BASE_SEPOLIA_URL`   | Shown on the Alchemy app page (ends in your key)          |
| `JWT_SECRET`                 | `openssl rand -base64 64`                                 |
| `REFRESH_SECRET`             | `openssl rand -base64 64` (must be different from above)  |
| `ENCRYPTION_KEY`             | `openssl rand -hex 32`                                    |
| `PLATFORM_ADMIN_PRIVATE_KEY` | Your deployer wallet private key, without the `0x` prefix |
| `PLATFORM_ADMIN_ADDRESS`     | The corresponding public address, with the `0x` prefix    |
| `FRONTEND_URL`               | `http://localhost:3000` for local development             |
| `BACKEND_URL`                | `http://localhost:4000` for local development             |

The contract address variables (`INSTITUTION_REGISTRY_ADDRESS` etc.) are filled
in Step 9 after you deploy. The circuit path variables are filled in Step 8
after you compile.

---

## Step 5: Start the database and cache

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379. Both are
health-checked before the services accept connections.

Verify they are running:

```bash
docker compose ps
```

Both should show `healthy`.

---

## Step 6: Run database migrations and seed

```bash
pnpm db:migrate
pnpm db:seed
```

The seed creates three default accounts for local development:

| Role        | Email                 | Password    |
| ----------- | --------------------- | ----------- |
| Admin       | admin@veridaq.xyz     | Admin@2026! |
| Institution | futminna@veridaq.xyz  | Inst@2026!  |
| Employer    | firstbank@veridaq.xyz | Emp@2026!   |

These credentials only exist in your local database. They are not hardcoded
anywhere outside the seed file.

---

## Step 7: Build the Solidity contracts

```bash
cd packages/contracts
forge build
```

This compiles all five contracts. There should be no warnings about unused
variables or state mutability. If there are, fix them before proceeding.

Run the test suite:

```bash
forge test -vvv
```

All tests should pass. If any fail, read the failure output carefully. The
tests document the intended behaviour of each contract.

---

## Step 8: Compile the ZKP circuit and run trusted setup

This is the most time-consuming step. It downloads a Powers of Tau file from
the Hermez ceremony (~72MB) and runs SnarkJS phase 2 setup.

```bash
pnpm circuit:compile
pnpm circuit:setup
```

After both scripts complete successfully, you will have:

```
packages/circuits/
  build/
    credential.r1cs
    credential_js/
      credential.wasm
  credential_final.zkey
  verification_key.json
packages/contracts/src/
  Groth16Verifier.sol    (generated by snarkjs)
```

Now update `.env` with the circuit file paths:

```
CIRCUIT_ZKEY_PATH=packages/circuits/credential_final.zkey
CIRCUIT_WASM_PATH=packages/circuits/build/credential_js/credential.wasm
```

The paths are relative to the workspace root. The backend resolves them with
`path.resolve(process.cwd(), config.CIRCUIT_ZKEY_PATH)`.

### Skipping circuit setup for development

If you want to start the backend without running the full trusted setup, you
can use the mock verifier. Create this file:

```solidity
// packages/contracts/src/Groth16Verifier.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * Mock verifier for local development only.
 * Always returns true. Do not deploy to production.
 */
contract Groth16Verifier {
    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[] calldata
    ) external pure returns (bool) {
        return true;
    }
}
```

Then set placeholder paths in `.env`:

```
CIRCUIT_ZKEY_PATH=packages/circuits/placeholder.zkey
CIRCUIT_WASM_PATH=packages/circuits/placeholder.wasm
```

The backend will not crash at startup. Proof generation will fail when
triggered, but login, batch upload, and admin functions all work.

---

## Step 9: Deploy contracts to Base Sepolia

Make sure your deployer wallet has Base Sepolia ETH. Get some from:
https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

Dry-run the deployment first (no broadcast, no cost):

```bash
pnpm contracts:deploy:dry
```

If the simulation completes without errors, broadcast it:

```bash
pnpm contracts:deploy
```

The deployment script logs each contract address as it deploys. Copy them into
your `.env`:

```
INSTITUTION_REGISTRY_ADDRESS=0x...
CREDENTIAL_REGISTRY_ADDRESS=0x...
REVOCATION_REGISTRY_ADDRESS=0x...
PAYMASTER_VAULT_ADDRESS=0x...
SUBSCRIPTION_MANAGER_ADDRESS=0x...
ZK_VERIFIER_ADDRESS=0x...
```

After filling these in, fund the PaymasterVault with a small amount of ETH to
cover gas for batch submissions:

```bash
cast send $PAYMASTER_VAULT_ADDRESS \
  --value 0.05ether \
  --private-key $PLATFORM_ADMIN_PRIVATE_KEY \
  --rpc-url $ALCHEMY_BASE_SEPOLIA_URL
```

---

## Step 10: Start the development servers

In one terminal:

```bash
pnpm dev:backend
```

In a second terminal:

```bash
pnpm dev:frontend
```

Or start both at once (log output is interleaved):

```bash
pnpm dev
```

The backend runs on http://localhost:4000. The frontend runs on http://localhost:3000.

The Swagger API docs are at http://localhost:4000/docs when `NODE_ENV=development`.

---

## Step 11: Verify everything works

Open http://localhost:3000 in your browser. You should see the VERIDAQ landing
page with the two portal cards.

Login test:

1. Go to http://localhost:3000/institution/login
2. Enter `futminna@veridaq.xyz` and `Inst@2026!`
3. You should land on the institution dashboard

If you get an "account not approved" error, the seed did not run or the database
is empty. Run `pnpm db:reset && pnpm db:seed` and try again.

---

## How to use the system

### Upload a credential batch (Institution)

1. Log in as the institution account.
2. Go to Batches and click Upload Batch.
3. Download the batch template from the modal or use the file at
   `templates/batch_template_README.md` for the column format.
4. Upload a filled Excel file.
5. The backend queues a BullMQ job. The batch status changes from PENDING to
   PROCESSING to COMPLETED. On completion, commitments are registered on-chain
   and you will see a transaction hash.

### Verify a credential (Employer)

1. Log in as the employer account.
2. Go to Verify.
3. Select an institution from the dropdown.
4. Enter the candidate's matriculation number exactly as the institution
   registered it (case-sensitive).
5. Select a claim type and threshold.
6. Click Verify. The backend generates a Groth16 proof (takes a few seconds),
   submits it on-chain, and returns VERIFIED or NOT VERIFIED.

### Approve a KYC application (Admin)

1. Log in as the admin account.
2. Go to Institutions or Employers.
3. Pending accounts show a yellow "Pending" badge.
4. Click the row and click Approve.
5. This registers the institution on-chain and sends them an email.

---

## Useful commands

```bash
# Database
pnpm db:studio            # Open Prisma Studio in the browser
pnpm db:reset             # Drop and recreate the database (loses all data)
pnpm db:seed              # Re-seed default dev accounts

# Contracts
cd packages/contracts
forge test -vvv           # Run all tests with full verbosity
forge test --watch        # Watch mode during development
forge coverage            # Line coverage report
forge snapshot            # Record gas usage to .gas-snapshot

# On-chain inspection
cast balance $PLATFORM_ADMIN_ADDRESS --rpc-url $ALCHEMY_BASE_SEPOLIA_URL --ether
cast call $INSTITUTION_REGISTRY_ADDRESS "isRegistered(bytes32)(bool)" 0x00...

# Backend tests
pnpm test:backend

# Type checking
pnpm typecheck

# Lint and format
pnpm lint:fix
pnpm format
```

---

## Working with Codex

The workspace is configured for OpenAI Codex (GPT-4.1) and GitHub Copilot agent
mode. The following files tell Codex how to work in this project:

| File                                             | Purpose                                             |
| ------------------------------------------------ | --------------------------------------------------- |
| `AGENTS.md`                                      | Primary agent instructions (Codex reads this first) |
| `.github/copilot-instructions.md`                | Copilot workspace instructions                      |
| `.github/prompts/new-api-route.prompt.md`        | Agent prompt for adding API routes                  |
| `.github/prompts/new-frontend-page.prompt.md`    | Agent prompt for adding frontend pages              |
| `.github/prompts/add-contract.prompt.md`         | Agent prompt for adding contracts                   |
| `.github/prompts/security-review.prompt.md`      | Agent prompt for security review                    |
| `.github/prompts/write-contract-test.prompt.md`  | Agent prompt for writing Foundry tests              |
| `.github/prompts/add-claim-type.prompt.md`       | Agent prompt for adding a ZKP claim type            |
| `.github/prompts/credential-lifecycle.prompt.md` | Agent prompt tracing the full data flow             |

To use a prompt in Copilot agent mode: open the command palette, run
"GitHub Copilot: Open Chat", then type `/` to see the available prompts.

---

## Troubleshooting

**`pnpm install` fails with peer dependency errors**

Run `pnpm install --no-strict-peer-dependencies`. The version constraints in
this workspace have been tested together but some packages declare conservative
peer ranges.

**`forge install` fails**

Make sure you are inside `packages/contracts` when you run it, and that git is
configured with a user name and email (`git config --global user.email ...`).

**Backend fails to start with "Environment variable validation failed"**

Open `.env` and check every required variable listed in Step 4. The error
output names the missing or invalid variable.

**`pnpm circuit:setup` hangs or fails**

The script downloads a 72MB ptau file from Hermez. If it fails mid-download,
delete `packages/circuits/hermez_final.ptau` and run again. If your internet
connection is slow, edit the script and use a smaller ptau (e.g. pot15) for
development; the proof size will be the same, only the setup time changes.

**Proof generation times out**

ZKP proof generation runs in the main Node.js process during development. On
slower machines it can take 10 to 30 seconds. The axios client in the frontend
has a 60-second timeout. If proofs consistently time out, move proof generation
to a dedicated BullMQ worker (the queue infrastructure is already in place in
`packages/backend/src/workers/`).

**`forge test` fails with "File not found" on OpenZeppelin imports**

You have not run `forge install` inside `packages/contracts`. Do that and try
again.

**Database migration fails with "column already exists"**

The local database state is ahead of the migration history. Run
`pnpm db:reset && pnpm db:seed` to start clean.

---

## Security notes for submission

This system is built as an academic final year project. Before any production
deployment, the following additional work is required:

1. The ZKP trusted setup must use a production multi-party ceremony, not the
   development beacon applied in `setup.sh`. The Hermez ceremony files are
   suitable for a small production deployment.

2. The ERC-4337 Paymaster implementation should be audited. The current
   implementation handles ETH isolation per institution but has not been
   reviewed by an external auditor.

3. Rate limiting on the proof generation endpoint should be enforced at the
   infrastructure level (e.g. Cloudflare) in addition to the application-level
   rate limit currently in place, because proof generation is CPU-intensive.

4. The admin account uses a single shared password. For production, replace
   this with a multi-factor authentication flow.

5. Contract upgradability is not implemented. If a bug is found in a deployed
   contract, redeployment and migration of all on-chain state is required. A
   proxy pattern (e.g. OpenZeppelin TransparentUpgradeableProxy) should be
   considered for production.
