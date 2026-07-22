# VERIDAQ — Extension Plan

> **Status**: Design document — not yet implemented
> **Date**: 2026-07-21
> **Target Branch**: `dev` (preview at `dev.veridaq-official.vercel.app/`)

---

## Table of Contents

### Part I — Architecture Vision

1. [Core Design Principle](#1-core-design-principle)
2. [Email-Only Authentication](#2-email-only-authentication)
3. [Embedded Wallet Architecture](#3-embedded-wallet-architecture)
4. [Multi-Institution Flexible Circuit](#4-multi-institution-flexible-circuit)
5. [Fiat-to-Stablecoin Payment Flow](#5-fiat-to-stablecoin-payment-flow)
6. [Real-Time NGN Pricing Oracle](#6-real-time-ngn-pricing-oracle)
7. [Revenue & Pricing Model](#7-revenue--pricing-model)
8. [KYC & Legal Compliance](#8-kyc--legal-compliance)
9. [Data Model Changes](#9-data-model-changes)
10. [Backend Changes](#10-backend-changes)
11. [Frontend Changes](#11-frontend-changes)
12. [Dev Branch & Vercel Preview Deployment](#12-dev-branch--vercel-preview-deployment)

### Part II — Feature Extensions

13. [Institution-as-Employer](#13-institution-as-employer)
14. [Revenue Sharing & Wallet Architecture](#14-revenue-sharing--wallet-architecture)
15. [Money Flow & Accounting](#15-money-flow--accounting)

### Part III — Execution

16. [Edge Cases & Gotchas](#16-edge-cases--gotchas)
17. [Implementation Roadmap](#17-implementation-roadmap)
18. [Files Changed Summary](#18-files-changed-summary)

---

# Part I — Architecture Vision

---

## 1. Core Design Principle

**The blockchain is invisible to end users.**

No student, institution admin, or employer should ever:
- See a wallet address
- Sign a transaction
- Manage a private key / seed phrase
- Pay gas fees
- Know what "Base Sepolia" is

The entire Web3 layer is abstracted by the platform. Users interact with
familiar web forms, receive email OTPs, and pay in NGN. The platform creates
wallets, signs transactions, and settles on-chain settlement in the background.

### Who Sees What

| User Role | Sees Blockchain? | Sees Wallet? | Sees Gas Fees? | Pays In? |
|-----------|:-:|:-:|:-:|:-:|
| Student | Never | Never | Never | Nothing (free) |
| Institution Admin | Never | Never (one-time setup) | Never | NGN |
| Employer | Never | Never | Never | NGN |
| Platform Admin | Dashboard only | Yes (manages paymaster) | Yes (gas pool) | N/A |

### Pricing Philosophy

All prices are denominated in a **stable internal unit** (USD cents) but
**displayed and charged in NGN** using the live exchange rate. The backend
stores canonical prices in USD cents and converts to NGN at the latest rate
at display time. This prevents price drift when NGN devalues.

---

## 2. Email-Only Authentication

### Flow

```
┌─────────┐     ┌──────────┐     ┌───────────┐     ┌─────────┐
│  User   │────▶│  /login  │────▶│  Email    │────▶│  JWT +  │
│ enters  │     │  (email) │     │  OTP      │     │  Wallet │
│ email   │     │          │     │  (6-digit)│     │  Session│
└─────────┘     └──────────┘     └───────────┘     └─────────┘

                      ┌─────────────────────────────┐
                      │  On first login:             │
                      │  • Create user record (DB)   │
                      │  • Create embedded wallet    │
                      │    (ERC-4337)                │
                      │  • Send welcome email        │
                      └─────────────────────────────┘
```

### Details

- **Primary auth**: Email + OTP (6-digit numeric code, 5 min expiry)
- **Secondary auth** (optional, future): Password login, Google OAuth
- **OTP delivery**: Resend endpoint with 30-second cooldown
- **Rate limit**: 5 OTP requests per 15 minutes per email
- **Session**: JWT in httpOnly cookie (same as current system)
- **No password field** on registration or login (unless user chooses password later)

### Prisma Model

```prisma
model OtpCode {
  id          String   @id @default(cuid())
  email       String
  code        String   // 6-digit, hashed with bcrypt
  type        String   // "LOGIN" | "REGISTRATION" | "PASSWORD_RESET" | "EMAIL_CHANGE"
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)  // Invalidate after 3 wrong attempts
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([email, type])
  @@map("otp_codes")
}
```

### Route Design

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/send-otp` | None | Send OTP to email |
| POST | `/api/auth/verify-otp` | None | Verify OTP, return JWT, create wallet if new user |
| POST | `/api/auth/logout` | Required | Clear session |
| GET | `/api/auth/me` | Required | Current user + wallet info |

### OTP Template (Email)

```
From: VERIDAQ <noreply@veridaq.xyz>
Subject: Your VERIDAQ login code

Hi {{name}},

Your one-time login code is:

  {{otp_code}}

This code expires in 5 minutes. Never share this code with anyone.

If you did not request this code, please ignore this email.

— VERIDAQ Team
```

---

## 3. Embedded Wallet Architecture

### Decision: MetaMask Embedded Wallets (MMEW) vs Custom ERC-4337

| Factor | MetaMask Embedded Wallets | Custom ERC-4337 (Biconomy/Pimlico) |
|--------|:------------------------:|:----------------------------------:|
| Custody model | Non-custodial (passkey) | Non-custodial (server signs) |
| User UX | Biometric + passkey generated wallet | Server creates + manages |
| Gas sponsorship | Built-in gas sponsor | Requires Paymaster contract |
| Cost | Free tier: 1K MAU, $0.005/extra tx | Free (self-hosted bundler) |
| Multi-chain | EVM chains | Any EVM |
| Key management | Device passkey (iCloud/Google) | Server-side encrypted |
| Control | Less (MetaMask manages keys) | Full (we manage keys) |

### Recommended: Custom ERC-4337 with server-side key management

Rationale:
- Full control over wallet creation and gas sponsorship
- No dependency on MetaMask's free tier limits
- Can batch transactions efficiently (200 credentials per tx)
- PaymasterVault already deployed and funded
- User never needs to install MetaMask or any browser extension

### Architecture

```
┌─────────────────────────────────────────────┐
│                  BACKEND                     │
│                                              │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │ Auth Service  │──▶│ Wallet Service   │    │
│  │ (OTP login)   │   │ (creates/manages)│    │
│  └──────────────┘   └────────┬─────────┘    │
│                              │               │
│                   ┌──────────▼──────────┐    │
│                   │  Key Management     │    │
│                   │  • AES-256-GCM      │    │
│                   │    encrypted seed   │    │
│                   │    phrase in DB     │    │
│                   │  • Derive wallet    │    │
│                   │    from seed + path │    │
│                   └──────────┬──────────┘    │
│                              │               │
│                   ┌──────────▼──────────┐    │
│                   │  Blockchain Service │    │
│                   │  • Deploy SimpleAccount│  │
│                   │  • Sign UserOps     │    │
│                   │  • Submit via       │    │
│                   │    Paymaster        │    │
│                   └─────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Key Management

The platform generates and encrypts wallet keys on first login:

1. Generate a BIP-39 mnemonic (12 words) using `ethers.Wallet.createRandom()`
2. Derive the wallet: `m/44'/60'/0'/0/0` (EIP-1193 path)
3. Encrypt the mnemonic with AES-256-GCM using a master key from env:
   ```
   WALLET_MASTER_ENCRYPTION_KEY=<32-byte hex>
   ```
4. Store encrypted blob in a new `UserWallet` table
5. The user NEVER sees the mnemonic

For institutions, deploy an ERC-4337 SimpleAccount (factory already deployed):

```solidity
address account = factory.createAccount(owner, salt);
```

The "owner" is the derived wallet address from step 2. The platform signs
UserOperations on behalf of this account using the derived private key.

### Prisma Models

```prisma
model UserWallet {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])

  encryptedSeed   String   // AES-256-GCM, nonce + ciphertext + tag stored as hex
  walletAddress   String   // Derived EVM address
  accountAddress  String?  // ERC-4337 SimpleAccount address (deployed on-chain)
  derivationPath  String   @default("m/44'/60'/0'/0/0")

  createdAt       DateTime @default(now())

  @@map("user_wallets")
}
```

### Gas Sponsorship Flow

All on-chain transactions use the existing PaymasterVault:

1. Backend constructs a UserOperation
2. Signs with the derived private key
3. Estimates gas using `eth_estimateUserOperationGas`
4. Sends to the bundler (Pimlico or custom) with PaymasterVault as sponsor
5. PaymasterVault deducts gas from its balance (funded by Gas Pool)

The user never pays gas — the platform absorbs it and recovers through the
pricing model.

---

## 4. Multi-Institution Flexible Circuit

### The Problem

Different institution types have different credential schemas:

| Institution Type | Fields |
|-----------------|--------|
| University | matric_no, course, grade, graduation_year, degree_type |
| Bootcamp | name, program_completed, completion_date, duration |
| Professional Body (NBA) | bar_number, call_to_bar_year, specialization |
| Professional Body (COREN) | reg_number, engineering_discipline, license_expiry |
| Medical (MDCN) | license_number, specialization, year_of_registration |
| NYSC | call_up_number, state_code, service_year, discharge_status |

The current circuit uses fixed signals. We need a flexible pattern that can
handle any schema without recompiling the circuit for each institution type.

### Evaluated Approaches

#### Approach A: zkFabric 8-Slot Fixed Schema (Recommended)

Design from https://eprint.iacr.org/2023/1954

```
Circuit Inputs:
  - privateInputs[8]  (Poseidon hashes of each field)
  - claimType          (which fields are being claimed)
  - threshold          (e.g., "First Class" encoded as uint256)
  - merkleRoot         (on-chain commitment tree root)
  - merkleProof[levels]
  - nullifier

Public Outputs:
  - commitment         (Poseidon root of privateInputs)
  - nullifier
  - claimType
  - threshold
```

**How it works:**
- Each credential has exactly 8 "slots" — each slot holds a Poseidon hash of
  one field value
- The institution defines a schema mapping: "matric_no → slot 0, course → slot 1,
  grade → slot 2, ..."
- If an institution has fewer than 8 fields, unused slots are Poseidon(0)
- The `claimType` signal selects which slots to reveal
- For example, "I have a First Class in Computer Science" would:
  - Select slot 1 (course = "Computer Science") and slot 2 (grade = "First Class")
  - Set threshold = hash("First Class")
  - Verifier checks: commitment matches merkleRoot AND grade >= threshold

**verification_key.json stays the same for every institution. Only the
schema mapping changes.**

**Pros:**
- Single circuit for all institution types
- No recompilation or new trusted setup
- verification_key.json is universal
- Gas-efficient (same ZKVerifier contract)
- Proven in production (zkFabric)

**Cons:**
- Limited to 8 fields (most institutions need 4-6 fields)
- Schema mapping must be stored off-chain and agreed upon
- Claim type encoding gets complex with many combinations

#### Approach B: iden3 Schema-Based Queries

Design from https://docs.iden3.io

Each credential references a JSON-LD schema (e.g.,
`https://schema.veridaq.xyz/university-transcript.json`). The circuit uses
`atomicQueryCredential` to check specific fields by their JSON path.

**Pros:**
- Arbitrary number of fields per schema
- W3C Verifiable Credential Data Model v2.0 compliant
- Schema can evolve independently

**Cons:**
- Must recompile circuit per schema (different schema hash)
- Each schema needs its own verification key
- More complex trusted setup management
- Higher on-chain verification cost (more verification keys)

#### Approach C: Selector-Bitmap Disclosure

The circuit has a single `uint256 selector` bitmask. Each bit corresponds
to a field in the credential. The prover sets bits for fields they want to
reveal.

**Pros:**
- Very flexible disclosure
- Single circuit
- Simple UX for selecting which fields to show

**Cons:**
- Still needs fixed number of fields compiled into circuit
- Requires more bits than typical (e.g., 32-bit uint)
- Schema mapping still needed

### Recommended Approach: Hybrid — 8-Slot + Schema Registry

```
┌──────────────────────────────────────────────────────┐
│                   SCHEMA REGISTRY                    │
│  (Stored in DB, one per institution type)            │
│                                                      │
│  University:                                         │
│    slot_0: "matric_no"           (hash of value)     │
│    slot_1: "course"              (hash of value)     │
│    slot_2: "grade"               (hash of value)     │
│    slot_3: "graduation_year"     (hash of value)     │
│    slot_4: "degree_type"         (hash of value)     │
│    slot_5: "unused"              (Poseidon(0))       │
│    slot_6: "unused"              (Poseidon(0))       │
│    slot_7: "unused"              (Poseidon(0))       │
│                                                      │
│  Bootcamp:                                           │
│    slot_0: "student_name"        (hash of value)     │
│    slot_1: "program_completed"   (hash of value)     │
│    slot_2: "completion_date"     (hash of value)     │
│    slot_3: "duration_weeks"      (hash of value)     │
│    slot_4-7: "unused"            (Poseidon(0))        │
│                                                      │
│  Professional Body (NBA):                            │
│    slot_0: "bar_number"          (hash of value)     │
│    slot_1: "call_to_bar_year"    (hash of value)     │
│    slot_2: "specialization"      (hash of value)     │
│    slot_3-7: "unused"            (Poseidon(0))        │
└──────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   CREDENTIAL     │
                    │  CIRCUIT (fixed) │
                    │                  │
                    │  8 slot inputs   │
                    │  claimType       │
                    │  threshold       │
                    │  merkleRoot      │
                    │  nullifier       │
                    └──────────────────┘
```

### Circuit Changes

Current circuit: `credential.circom` with fixed signals for each field.

New circuit: generic 8-slot.

```circom
pragma circom 2.1.0;

include "circomlib/poseidon.circom";
include "circomlib/merkle_tree.circom";

template Credential() {
    signal input privateInputs[8];
    signal input merkleProof[levels];
    signal input nullifierSeed;

    signal input claimType;
    signal input threshold;

    signal output commitment;
    signal output nullifier;
    signal output merkleRoot;

    component hash = Poseidon(8);
    for (var i = 0; i < 8; i++) {
        hash.inputs[i] <== privateInputs[i];
    }
    commitment <== hash.out;

    component nullifierHash = Poseidon(1);
    nullifierHash.inputs[0] <== nullifierSeed;
    nullifier <== nullifierHash.out;

    component merkleCalculator = MerkleTreeCalculator(levels);
    merkleCalculator.leaf <== commitment;
    for (var i = 0; i < levels; i++) {
        merkleCalculator.siblings[i] <== merkleProof[i];
    }
    merkleRoot <== merkleCalculator.root;
}
```

**This does NOT replace the existing circuit.** It is a new circuit that
coexists with (or replaces) the current fixed-signal circuit. The current
circuit remains valid for university credentials. The new circuit enables
all institution types.

### Schema Registry (Backend)

New Prisma model:

```prisma
model CredentialSchema {
  id              String   @id @default(cuid())
  institutionType String   @unique  // "UNIVERSITY" | "BOOTCAMP" | "NBA" | "COREN" | "MDCN" | "NYSC"
  name            String
  description     String?
  version         Int      @default(1)
  slot0Field      String
  slot1Field      String
  slot2Field      String
  slot3Field      String
  slot4Field      String
  slot5Field      String
  slot6Field      String
  slot7Field      String
  claimTypes      Json     // [{code, label, description, fields[]}]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("credential_schemas")
}
```

### Batches Reference Schema

When an institution uploads a batch, they select their schema. The XLSX
template columns map to the schema's slot fields. For example, a university
template would have columns: `matric_no | course | grade | graduation_year | degree_type`.

A bootcamp template would have: `student_name | program_completed | completion_date | duration_weeks`.

The backend hashes each column value with Poseidon and stores the 8-slot
array as the commitment.

### Verification Flow (New)

1. Employer selects institution type (e.g., "Nigerian Law School")
2. Frontend shows available claim types from the schema registry
3. Employer picks a claim (e.g., "Called to Bar in 2023")
4. Employer enters the student's ID (e.g., bar number)
5. Backend resolves the student's credential commitment from the batch
6. Backend generates the proof:
   - Maps bar_number → slot_0, call_to_bar_year → slot_1
   - Sets claimType = "CALLED_TO_BAR" (encoded as uint256)
   - Sets threshold = Poseidon("2023")
   - Fills unused slots with Poseidon(0)
7. Circuit runs with 8-slot inputs
8. On-chain verification uses the same ZKVerifier (unchanged)

---

## 5. Fiat-to-Stablecoin Payment Flow

### Payment Processing Architecture

```
┌─────────┐     ┌───────────────┐
│  User   │────▶│  Flutterwave  │
│ pays    │     │  (NGN → USDC  │
│ via     │     │   on Polygon) │
│ Card /  │     └───────┬───────┘
│ USSD    │             │
│ /Bank   │             ▼
│ Transfer│     ┌──────────────────┐
└─────────┘     │  Platform Admin  │
                │  Wallet (USDC)   │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  Revenue Split   │
                │  (DB-level)      │
                │  70/20/10        │
                └──────────────────┘
```

### Primary: Flutterwave Stablecoins (NGN → USDC on Polygon)

| Feature | Details |
|---------|---------|
| Supported stablecoins | USDC (Polygon), USDT (Tron/Ethereum) |
| Fiat sources | NGN, USD, EUR, GBP, KES, GHS, ZAR |
| Settlement | USDC/USDT sent to platform's wallet |
| Transaction fee | ~2% buy/sell spread |
| Payout | Instant (on-chain) |
| Docs | https://developer.flutterwave.com/docs/stablecoin-payments |

**Flow:**
1. User pays in NGN via Flutterwave (card, bank, USSD, mobile money)
2. Flutterwave converts to USDC (Polygon) and sends to platform's wallet
3. Backend receives webhook: `event.type = "stablecoin-transfer.completed"`
4. Backend records the payment and updates user's credits

### Secondary: Paystack (NGN Fallback)

| Feature | Details |
|---------|---------|
| Supported currencies | NGN, GHS, ZAR, USD |
| Settles to | NGN bank account |
| Transaction fee | 1.5% + ₦100 (NGN) |
| Payout speed | T+1 (next business day) |

**Flow:**
1. User pays in NGN via Paystack (card, USSD, bank transfer, QR)
2. Paystack settles NGN to platform's bank account
3. Backend records the fiat payment, updates credits/balance
4. Platform admin periodically converts NGN to USDC (via Quidax/Busha) for
   on-chain operations

**Limitation**: Paystack does not natively convert to stablecoins. The
platform must manage the fiat-to-crypto conversion separately.

### cNGN Oracle (Future)

cNGN is an NGN-denominated stablecoin by a consortium of Nigerian banks
(Access Bank, First Bank, Sterling, etc.):

| Feature | Details |
|---------|---------|
| Peg | 1 cNGN = 1 NGN |
| Underlying | Fiat NGN held in licensed bank accounts |
| Current status | Still in pilot / regulatory sandbox (CBN) |
| Use case | On-chain NGN settlement without dollar exposure |
| Challenge | Limited liquidity and exchange support |

**Decision**: Monitor cNGN for future integration but do not depend on it
now. Use Flutterwave Stablecoins (USDC on Polygon) as the primary on-ramp.

If cNGN gains traction, the architecture supports it as a drop-in — replace
USDC with cNGN in the wallet and update pricing to be NGN-native.

### Payment Records

```prisma
model Payment {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])

  // Amount
  amount            Decimal  // In NGN (fiat)
  currency          String   @default("NGN")
  amountUsdCents    Decimal  // Normalized to USD cents (internal stable unit)

  // What was purchased
  packType          String?  // "CREDITS_5" | "CREDITS_10" | ... | "BATCH_1001_5000" | ...
  packLabel         String?  // "10 verification credits" | "Batch upload (1,001-5,000)"
  creditsAdded      Int?     // For employer credit packs
  institutionId     String?  // For batch upload payments

  // Payment provider
  provider          String   // "PAYSTACK" | "FLUTTERWAVE"
  providerRef       String   // Paystack reference / Flutterwave transaction ID
  status            String   // "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"

  // Stablecoin settlement
  stablecoinAddress String?  // USDC wallet that received the funds
  stablecoinAmount  Decimal? // Amount received in USDC
  txHash            String?  // On-chain transaction hash (if applicable)

  // Exchange rate at time of transaction
  rateUsdToNgn      Decimal? // e.g. 1361 = ₦1,361 per $1
  rateEthToUsd      Decimal? // e.g. 1669.30

  createdAt         DateTime @default(now())
  completedAt       DateTime?
  metadata          Json?

  @@map("payments")
}
```

### Settlement Flow (Detailed)

```
1. User clicks "Buy 10 Credits" on frontend
   → Price shown in NGN (computed from live rate)
   ↓
2. Frontend calls POST /api/payments/initialize
   → Backend returns { authorizationUrl: "https://checkout.flutterwave.com/..." }
   ↓
3. User completes payment in Flutterwave widget (in NGN)
   ↓
4. Flutterwave sends webhook to POST /api/payments/webhook/flutterwave
   → Verify HMAC signature
   → If event.type == "stablecoin-transfer.completed" or "charge.completed":
     • Update Payment.status = "COMPLETED"
     • Add credits to Employer.verificationCredits
     • Or flag Institution batch payment as received
   ↓
5. Frontend polls GET /api/payments/{reference}/status
   → Shows success state
   → Redirects to dashboard with new credit balance
```

### Withdrawal Flow (Institution Earnings)

Institutions earn 20% of verification revenue. They can withdraw:

1. **Via Flutterwave Stablecoins** (automatic, low fees):
   - Backend initiates Flutterwave stablecoin payout from platform's USDC
     wallet to the institution's bank account
   - Flutterwave converts USDC → NGN and sends to institution's bank
   - Fee: ~2%

2. **Via crypto** (manual, higher fees):
   - Backend transfers ETH from platform admin wallet to institution's
     payout wallet address
   - Gas cost: varies

3. **Via bank transfer** (manual, admin processes):
   - Institution initiates withdrawal request
   - Admin reviews, initiates bank transfer
   - Fee: bank charges

---

## 6. Real-Time NGN Pricing Oracle

### Overview

All prices are stored internally in **USD cents** (canonical stable unit).
The live NGN equivalent is computed at display time using the exchange rate
cached in the database. Every 30 minutes, a BullMQ repeatable job fetches
fresh rates from external APIs and updates the cache.

### Rate Sources

| Rate | Source | API | Free Tier Limit |
|------|--------|-----|:---------------:|
| NGN → USD | Open Exchange Rates | `https://openexchangerates.org/api/latest.json?app_id=...` | 1,000 req/mo |
| NGN → USD (fallback) | exchangerate.host | `https://api.exchangerate.host/convert?from=USD&to=NGN` | 1,000 req/mo |
| NGN → USD (CBN) | CBN official rates | `https://www.cbn.gov.ng/rates/ExchRateByCurrency.html` | Unlimited (scrape) |
| USD → ETH | CoinGecko | `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd` | 50 req/min (free) |
| USD → ETH (fallback) | CoinMarketCap | `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=ETH` | 10K req/mo (free tier) |
| Base gas price | Base RPC | `eth_gasPrice` via viem | Free (your own RPC) |

### Recommended Primary Sources

1. **Open Exchange Rates** for NGN/USD — reliable, updates hourly, free tier adequate
2. **CoinGecko** for ETH/USD — free tier, no API key needed for basic queries
3. **Base RPC** (`base.drpc.org` or Alchemy) for gas price — free tier

### Database Model

```prisma
model ExchangeRate {
  id            String   @id @default(cuid())

  // NGN ↔ USD
  rateUsdToNgn  Decimal  // e.g. 1361.50 (₦1,361.50 per $1)
  rateNgnToUsd  Decimal  // e.g. 0.000734 (inverse)

  // ETH ↔ USD
  rateEthToUsd  Decimal  // e.g. 1669.30

  // Base gas
  baseGasPriceGwei Decimal // e.g. 0.006 (gwei)
  baseGasPriceUsd  Decimal // Gas cost per credential in USD

  // Metadata
  source       String   // "OPEN_EXCHANGE_RATES" | "COINGECKO" | "DRPC"
  fetchedAt    DateTime @default(now())
  expiresAt    DateTime // +30 minutes from fetchedAt

  @@map("exchange_rates")
}
```

### BullMQ Repeatable Job

```typescript
// workers/price-oracle.worker.ts

import { Queue, Worker } from "bullmq"

const PRICE_ORACLE_QUEUE = "price-oracle"
const REPEAT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export class PriceOracleService {
  private readonly queue = new Queue(PRICE_ORACLE_QUEUE, {
    connection: redisConnection,
  })

  async startRepeatableJob() {
    // Remove old repeatable jobs to avoid duplicates
    await this.queue.removeRepeatable("fetch-rates", {
      every: REPEAT_INTERVAL_MS,
    })

    await this.queue.add(
      "fetch-rates",
      {},
      {
        repeat: { every: REPEAT_INTERVAL_MS },
        jobId: "price-oracle-repeatable",
      }
    )
  }

  async fetchRates(): Promise<void> {
    const [ngnUsd, ethUsd, gasPrice] = await Promise.all([
      this.fetchNgnUsdRate(),
      this.fetchEthUsdRate(),
      this.fetchBaseGasPrice(),
    ])

    const ngnToUsd = ngnUsd !== 0n ? 1n / ngnUsd : 0n

    await prisma.exchangeRate.create({
      data: {
        rateUsdToNgn: ngnUsd,
        rateNgnToUsd: ngnToUsd,
        rateEthToUsd: ethUsd,
        baseGasPriceGwei: gasPrice.gwei,
        baseGasPriceUsd: gasPrice.usdPerCredential,
        source: "OPEN_EXCHANGE_RATES", // or whichever succeeded
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + REPEAT_INTERVAL_MS),
      },
    })

    // Prune old rates — keep only last 30 days
    await prisma.exchangeRate.deleteMany({
      where: {
        fetchedAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    })
  }

  private async fetchNgnUsdRate(): Promise<number> {
    // Primary: Open Exchange Rates
    try {
      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${process.env.OXR_APP_ID}`
      )
      const data = await response.json()
      return data.rates.NGN // e.g. 1361.50
    } catch {
      // Fallback: exchangerate.host
      const response = await fetch(
        "https://api.exchangerate.host/convert?from=USD&to=NGN"
      )
      const data = await response.json()
      return data.result
    }
  }

  private async fetchEthUsdRate(): Promise<number> {
    // Primary: CoinGecko
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      )
      const data = await response.json()
      return data.ethereum.usd
    } catch {
      // Fallback: use last known rate from DB
      const last = await prisma.exchangeRate.findFirst({
        orderBy: { fetchedAt: "desc" },
      })
      return last?.rateEthToUsd ?? 1700
    }
  }

  private async fetchBaseGasPrice(): Promise<{
    gwei: number
    usdPerCredential: number
  }> {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL),
    })

    const gasPrice = await publicClient.getGasPrice()
    const gwei = Number(gasPrice) / 1e9

    // 134,332 gas per credential registration on Base
    const GAS_PER_CREDENTIAL = 134332
    const usdPerCredential = gwei * GAS_PER_CREDENTIAL * 1e-9 * ethUsdRate

    return { gwei, usdPerCredential }
  }
}

// Worker
const worker = new Worker(
  PRICE_ORACLE_QUEUE,
  async (job) => {
    if (job.name === "fetch-rates") {
      await new PriceOracleService().fetchRates()
    }
  },
  { connection: redisConnection }
)
```

### API Endpoint

```typescript
// routes/pricing.ts

const pricingSchema = z.object({
  rateUsdToNgn: z.number(),
  rateNgnToUsd: z.number(),
  rateEthToUsd: z.number(),
  baseGasPriceGwei: z.number(),
  baseGasPriceUsd: z.number(),
  lastUpdated: z.string(),
  expiresAt: z.string(),
})

export async function pricingRoutes(app: FastifyInstance) {
  app.get("/api/pricing/rates", async () => {
    const rate = await prisma.exchangeRate.findFirst({
      orderBy: { fetchedAt: "desc" },
    })

    if (!rate) {
      return reply.status(503).send({
        error: "Rates not available yet",
        message: "The price oracle has not fetched rates. Try again in a few minutes.",
      })
    }

    return {
      rateUsdToNgn: Number(rate.rateUsdToNgn),
      rateNgnToUsd: Number(rate.rateNgnToUsd),
      rateEthToUsd: Number(rate.rateEthToUsd),
      baseGasPriceGwei: Number(rate.baseGasPriceGwei),
      baseGasPriceUsd: Number(rate.baseGasPriceUsd),
      lastUpdated: rate.fetchedAt.toISOString(),
      expiresAt: rate.expiresAt.toISOString(),
    }
  })
}
```

### NGN Price Computation (Frontend)

```typescript
// lib/pricing.ts

// Internal canonical prices in USD cents
const CREDIT_PACKS_USD_CENTS: Record<string, number> = {
  CREDITS_5: 700,   // $7.00
  CREDITS_10: 1500,  // $15.00
  CREDITS_25: 3500,  // $35.00
  CREDITS_50: 6500,  // $65.00
  CREDITS_100: 12000, // $120.00
  CREDITS_500: 55000, // $550.00
}

export function computeNgnPrice(
  usdCents: number,
  rateUsdToNgn: number
): number {
  // usdCents is USD cents, rateUsdToNgn is e.g. 1361.50
  // $15.00 = 1500 cents → 1500 / 100 * 1361.50 = ₦20,422.50
  return Math.round((usdCents / 100) * rateUsdToNgn)
}

export function formatNgn(amountKobo: number): string {
  return `₦${amountKobo.toLocaleString("en-NG")}`
}
```

### Frontend Pricing Hook

```typescript
// hooks/usePricing.ts

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

const REFETCH_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

interface PricingRates {
  rateUsdToNgn: number
  rateEthToUsd: number
  baseGasPriceUsd: number
  lastUpdated: string
}

export function usePricing() {
  return useQuery<PricingRates>({
    queryKey: ["pricing-rates"],
    queryFn: async () => {
      const { data } = await api.get("/pricing/rates")
      return data
    },
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: REFETCH_INTERVAL_MS,
    retry: 3,
    // If the API is down, use last cached value (react-query persists to localStorage)
  })
}

export function useCreditPackPrices() {
  const { data: rates } = usePricing()

  if (!rates) return null

  return Object.entries(CREDIT_PACKS_USD_CENTS).map(([packType, usdCents]) => ({
    packType,
    usdCents,
    usd: usdCents / 100,
    ngn: computeNgnPrice(usdCents, rates.rateUsdToNgn),
    rateUsed: rates.rateUsdToNgn,
  }))
}
```

### Graceful Degradation

If the price oracle job fails (API outage, network error, etc.):

1. **Use the most recent cached rate** from the `ExchangeRate` table
2. If no rate exists at all (first run), use a **hardcoded fallback** from `.env`:
   ```
   FALLBACK_RATE_USD_TO_NGN=1361
   FALLBACK_RATE_ETH_TO_USD=1669.30
   FALLBACK_BASE_GAS_PRICE_GWEI=0.006
   ```
3. Log a warning to Pino logger
4. The BullMQ job retries with exponential backoff (3 retries, 5 min apart)
5. If all retries fail, it waits for the next 30-minute cycle

### Pricing Display Rules

- All prices on the frontend display in **NGN only** by default (₦)
- A small USD reference can be shown in parentheses if desired: `₦20,415 ($15)`
- The exchange rate and "last updated" timestamp are shown in a subtle footer:
  `Rates updated 12 min ago • ₦1,361 = $1`
- If rates are stale (>60 minutes), show a warning banner:
  `⚠️ Exchange rates may be outdated. Last update: 2 hours ago.`

---

## 7. Revenue & Pricing Model

### NGN Pricing (Based on Live Rate)

All prices are computed dynamically. The table below uses ₦1,361 = $1 as
reference. Actual displayed prices use the live oracle rate.

**Employers pay per verification** (credits):

| Pack | Internal (USD) | NGN at ₦1,361/$ | Per Verify |
|------|:--------------:|:---------------:|:----------:|
| 5 (trial) | $7.00 | ₦9,527 | $1.40 |
| 10 | $15.00 | ₦20,415 | $1.50 |
| 25 | $35.00 | ₦47,635 | $1.40 |
| 50 | $65.00 | ₦88,465 | $1.30 |
| 100 | $120.00 | ₦163,320 | $1.20 |
| 500 | $550.00 | ₦748,550 | $1.10 |

**Institutions pay for batch upload** (PAID tier):

| Batch Size | Fee (USD) | Fee (NGN) | Used For |
|:----------:|:---------:|:---------:|----------|
| 1–999 | Free | Free | Gas pool sponsors |
| 1,001–5,000 | $20 | ₦27,220 | Gas pool |
| 5,001–10,000 | $30 | ₦40,830 | Gas pool |
| 10,001–25,000 | $90 | ₦122,490 | Gas pool |
| 25,001–50,000 | $170 | ₦231,370 | Gas pool |

### Revenue Streams

| Stream | Source | Platform Cut | Details |
|--------|--------|:------------:|---------|
| Verification fees | Employer credit packs | 70% | Per verification consumed |
| Batch upload fees | Institution PAID tier | 100% | Goes to Gas Pool (covers costs) |
| Gas pool surplus | Remaining after sponsor | 100% | Excess gas pool → platform profit |
| Future: Premium features | Institutions | TBD | Analytics, custom branding, etc. |

### Cost Structure (Monthly Projected)

Assuming 500 employers × 10 verifications/month = 5,000 verifications:

| Cost Item | Per Unit | Monthly Total |
|-----------|:--------:|:-------------:|
| Gas (0.006 gwei, 134k gas) | $0.0014 | $7.00 |
| Flutterwave 2% fee on $7,500 | $150 | $150.00 |
| Paymaster top-up | $5.00 | $5.00 |
| Server hosting | $20/mo | $20.00 |
| Database (PostgreSQL) | $15/mo | $15.00 |
| Redis (BullMQ) | $10/mo | $10.00 |
| Email (SendGrid) | $20/mo | $20.00 |
| **Total** | | **$227.00** |

### Revenue Projection (Monthly)

| Revenue Stream | Volume | Gross Revenue | Platform Net (70%) |
|---------------|:------:|:------------:|:------------------:|
| 10-credit packs | 500 × $15 | $7,500 | $5,250 |
| Batch upload fees | 20 institutions × $20 | $400 | $400 (via pool) |
| **Total** | | **$7,900** | **$5,650** |

**Monthly profit (after costs)**: ~$5,423

### Breakeven

Current gas costs on Base are negligible ($0.0014/credential). The primary
cost is payment processing (~2% of revenue). At 500 verifications/month:

- Revenue: $7,500
- Costs: $227
- Profit margin: ~97%
- Breakeven: Instant (within first few sales)

---

## 8. KYC & Legal Compliance

### Regulatory Requirements

| Jurisdiction | Regulation | Requirements |
|--------------|-----------|--------------|
| Nigeria | NDPR (2023) | Consent, data minimization, breach notification, DPO appointment |
| Nigeria | Startup Act (2023) | Business registration, tax incentives |
| EU | GDPR | Data processing agreement, right to erasure, DPO outside Nigeria |
| Global | KYC/AML | Institutional KYC (not individual user KYC) |

### Applicability to VERIDAQ

**VERIDAQ does NOT store student PII on-chain.** Student data is:
- Hashed (Poseidon) before on-chain storage
- Raw values stored in the backend database (access-controlled)
- Only revealed to employers who pay and are verified

This means:
- The blockchain is not a "data processor" under GDPR/NDPR
- The backend database is the data processor
- Data processing agreement required between VERIDAQ and institutions

### KYC Flow (Institutions, Not Students)

```
Institution submits registration
  │
  ▼
Admin reviews documents:
  • Certificate of Incorporation
  • CAC registration (Nigeria)
  • Letter of designation for signatory
  • Proof of address
  │
  ▼
Admin approves/denies
  │
  ▼
If approved: Institution can upload batches
```

**Students do NOT need KYC.** We verify the institution, not individual
students. This is critical for the product's scalability.

### Implementation Checks

- [ ] NDPR compliance: Add consent checkbox on institution registration
- [ ] GDPR compliance: Add data processing agreement (DPA) flow for EU institutions
- [ ] Data retention policy: Configurable retention period for credential data
- [ ] Right to erasure: API endpoint to delete student records (with audit log)
- [ ] Breach notification: Alert workflow for security incidents
- [ ] DPO appointment: Add contact info to privacy policy
- [ ] Cookie consent: Add cookie banner to frontend

### Data Processing Agreement (DPA)

When an institution registers, they must accept a DPA that specifies:

1. VERIDAQ is the Data Processor
2. Institution is the Data Controller
3. Student data is stored encrypted at rest (AES-256-GCM)
4. Student data is never sold or shared with third parties
5. Institution can request deletion of all their students' data at any time
6. VERIDAQ will notify institution within 72 hours of any data breach

---

## 9. Data Model Changes

### New Models

```prisma
// ===== AUTH =====

model OtpCode {
  id          String   @id @default(cuid())
  email       String
  code        String   // bcrypt hash of 6-digit code
  type        String   // "LOGIN" | "REGISTRATION"
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([email, type])
  @@map("otp_codes")
}

model UserSession {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   // JWT jti
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())

  @@map("user_sessions")
}

// Modify existing User model
model User {
  // ... existing fields ...
  otpEnabled    Boolean    @default(true)
  emailVerified DateTime?
  sessions      UserSession[]
  wallet        UserWallet?
}


// ===== WALLET =====

model UserWallet {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  encryptedSeed   String   // AES-256-GCM sealed
  walletAddress   String   // Derived EVM address
  accountAddress  String?  // ERC-4337 SimpleAccount
  derivationPath  String   @default("m/44'/60'/0'/0/0")
  createdAt       DateTime @default(now())

  @@map("user_wallets")
}


// ===== PRICING ORACLE =====

model ExchangeRate {
  id                String   @id @default(cuid())
  rateUsdToNgn      Decimal  // e.g. 1361.50
  rateNgnToUsd      Decimal  // e.g. 0.000734
  rateEthToUsd      Decimal  // e.g. 1669.30
  baseGasPriceGwei  Decimal  // e.g. 0.006
  baseGasPriceUsd   Decimal  // e.g. 0.0014 (gas per credential in USD)
  source            String   // "OPEN_EXCHANGE_RATES" | "COINGECKO" | "DRPC"
  fetchedAt         DateTime @default(now())
  expiresAt         DateTime

  @@map("exchange_rates")
}


// ===== SCHEMA REGISTRY =====

model CredentialSchema {
  id              String   @id @default(cuid())
  institutionType String   @unique
  name            String
  description     String?
  version         Int      @default(1)
  slot0Field      String
  slot1Field      String
  slot2Field      String
  slot3Field      String
  slot4Field      String
  slot5Field      String
  slot6Field      String
  slot7Field      String
  claimTypes      Json     // [{code, label, description, fields[]}]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("credential_schemas")
}

model InstitutionCredential {
  id                 String   @id @default(cuid())
  institutionId      String
  institution        Institution @relation(fields: [institutionId], references: [id])
  schemaId           String
  schema             CredentialSchema @relation(fields: [schemaId], references: [id])
  studentIdentifier  String   // e.g. matric_no value
  slot0Hash          String   // Poseidon hash of slot0 value
  slot1Hash          String
  slot2Hash          String
  slot3Hash          String
  slot4Hash          String
  slot5Hash          String
  slot6Hash          String
  slot7Hash          String
  commitment         String   // Poseidon hash of all 8 slots
  batchId            String?
  batch              BatchUpload?
  createdAt          DateTime @default(now())

  @@unique([institutionId, studentIdentifier])
  @@index([commitment])
  @@map("institution_credentials")
}


// ===== PAYMENTS =====

model Payment {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  amount            Decimal  // In NGN
  currency          String   @default("NGN")
  amountUsdCents    Decimal  // Normalized to USD cents (internal stable unit)
  packType          String?  // "CREDITS_5" | "CREDITS_10" | ...
  packLabel         String?
  creditsAdded      Int?
  institutionId     String?
  provider          String   // "PAYSTACK" | "FLUTTERWAVE"
  providerRef       String
  status            String   // "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"
  stablecoinAddress String?
  stablecoinAmount  Decimal?
  txHash            String?
  rateUsdToNgn      Decimal? // Exchange rate at time of transaction
  rateEthToUsd      Decimal?
  createdAt         DateTime @default(now())
  completedAt       DateTime?
  metadata          Json?

  @@map("payments")
}


// ===== EARNINGS =====

model InstitutionEarnings {
  id              String   @id @default(cuid())
  institutionId   String   @unique
  institution     Institution @relation(fields: [institutionId], references: [id])
  totalEarnedUsd  Decimal  @default(0)
  totalEarnedWei  Decimal  @default(0)
  withdrawnUsd    Decimal  @default(0)
  withdrawnWei    Decimal  @default(0)
  availableUsd    Decimal  @default(0)
  availableWei    Decimal  @default(0)
  payoutWallet    String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("institution_earnings")
}

model EarningTransaction {
  id                String   @id @default(cuid())
  institutionId     String
  institution       Institution @relation(fields: [institutionId], references: [id])
  verificationId    String?
  type              String   // "EARNED" | "WITHDRAWN" | "DEPOSITED" | "SPONSORED"
  amountUsd         Decimal
  amountWei         Decimal
  platformShareUsd  Decimal?
  institutionShareUsd Decimal?
  poolShareUsd      Decimal?
  description       String
  referenceId       String?
  metadata          Json?
  createdAt         DateTime @default(now())

  @@map("earning_transactions")
}

model GasPool {
  id                String   @id @default(cuid())
  totalDepositedUsd Decimal  @default(0)
  totalDepositedWei Decimal  @default(0)
  totalSpentUsd     Decimal  @default(0)
  totalSpentWei     Decimal  @default(0)
  availableUsd      Decimal  @default(0)
  availableWei      Decimal  @default(0)
  updatedAt         DateTime @updatedAt

  @@map("gas_pool")
}

model GasPoolTransaction {
  id            String   @id @default(cuid())
  type          String   // "DEPOSIT" | "SPEND"
  amountUsd     Decimal
  amountWei     Decimal
  source        String?  // "VERIFICATION_SHARE" | "BATCH_UPLOAD_FEE" | "ADMIN_TOPUP"
  destination   String?  // "FREE_TIER_BATCH" | "EMPLOYER_TRIAL" | "ADMIN_WITHDRAWAL"
  referenceId   String?
  description   String?
  metadata      Json?
  createdAt     DateTime @default(now())

  @@map("gas_pool_transactions")
}
```

### Changes to Existing Models

- **User**: Add `otpEnabled`, `emailVerified`, relation to `UserWallet`, `UserSession`
- **Employer**: Add `institutionId`, `walletAddress` (nullable)
- **Institution**: Already has `alsoEmployer` and `employerProfile` (from prior plan)
- **BatchUpload**: Add optional `schemaId` FK to `CredentialSchema`

---

## 10. Backend Changes

### New Services

| Service | File | Purpose |
|---------|------|---------|
| `OtpService` | `services/otp.service.ts` | Generate, send, verify OTP codes |
| `WalletService` | `services/wallet.service.ts` | Create, encrypt, manage embedded wallets |
| `PaymentService` | `services/payment.service.ts` | Initiate, verify, record fiat payments |
| `PriceOracleService` | `services/price-oracle.service.ts` | Fetch exchange rates, update cache |
| `SchemaService` | `services/schema.service.ts` | Manage credential schemas, slot mappings |
| `FlexibleProofService` | `services/flexible-proof.service.ts` | Generate ZK proofs using 8-slot circuit |
| `EarningsService` | `services/earnings.service.ts` | Revenue split, withdrawals, gas pool |

### New Workers

| Worker | File | Purpose |
|--------|------|---------|
| `PriceOracleWorker` | `workers/price-oracle.worker.ts` | BullMQ repeatable job every 30 min |

### Modified Services

| Service | Changes |
|---------|---------|
| `auth.service.ts` | Add OTP login/register flow, email verification, session management |
| `auth.plugin.ts` | Add session validation from `UserSession` |
| `blockchain.service.ts` | Add userOp signing, SimpleAccount deployment, Paymaster interaction |
| `verification.service.ts` | Update to work with schema registry + flexible proof |
| `institution.service.ts` | Add schema selection to batch upload flow, employer toggle |
| `earnings.service.ts` | Integrate with PaymentService for fiat withdrawal |

### New Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/send-otp` | None | Send OTP to email |
| POST | `/api/auth/verify-otp` | None | Verify OTP, login/register |
| POST | `/api/auth/logout` | Required | End session |
| GET | `/api/pricing/rates` | None | Get latest exchange rates |
| GET | `/api/payments/packs` | Required | List available credit packs with NGN prices |
| POST | `/api/payments/initialize` | Required | Create payment intent, return checkout URL |
| POST | `/api/payments/webhook/flutterwave` | Webhook | Flutterwave payment callback |
| POST | `/api/payments/webhook/paystack` | Webhook | Paystack payment callback |
| GET | `/api/payments/:reference/status` | Required | Poll payment status |
| GET | `/api/schemas` | None | List all credential schemas |
| GET | `/api/schemas/:type` | None | Get schema by institution type |
| POST | `/api/institution/batch/upload` | Institution | Upload batch with schema |
| PATCH | `/api/institution/employer-access` | Institution | Toggle alsoEmployer flag |
| GET | `/api/institution/earnings` | Institution | Balance, total earned, withdrawn |
| GET | `/api/institution/earnings/transactions` | Institution | Paginated history |
| POST | `/api/institution/earnings/withdraw` | Institution | Initiate withdrawal |
| PUT | `/api/institution/earnings/wallet` | Institution | Set payout address |
| GET | `/api/admin/earnings/pool` | Admin | Gas pool health |
| GET | `/api/admin/earnings/platform` | Admin | Platform revenue summary |
| POST | `/api/admin/earnings/withdraw` | Admin | Admin withdraws platform earnings |

### Key Implementation: OtpService

```typescript
// services/otp.service.ts
import crypto from "node:crypto"
import bcrypt from "bcryptjs"

export class OtpService {
  private readonly OTP_LENGTH = 6
  private readonly OTP_EXPIRY = 5 * 60 * 1000
  private readonly MAX_ATTEMPTS = 3
  private readonly RATE_LIMIT = 5
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000

  async generate(email: string, type: "LOGIN" | "REGISTRATION"): Promise<void> {
    // 1. Rate limit check
    // 2. Generate 6-digit code: crypto.randomInt(100000, 999999).toString()
    // 3. Hash with bcrypt (cost 8)
    // 4. Store in OtpCode
    // 5. Send via email (SendGrid / AWS SES)
  }

  async verify(email: string, code: string): Promise<boolean> {
    // 1. Find latest unused, unexpired OTP
    // 2. Check attempts < MAX_ATTEMPTS
    // 3. bcrypt.compare(code, otp.code)
    // 4. If match: mark used, return true
    // 5. If no match: increment attempts, invalidate if >= 3
  }
}
```

### Key Implementation: WalletService

```typescript
// services/wallet.service.ts
import { Wallet, HDNodeWallet } from "ethers"
import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const MASTER_KEY = Buffer.from(process.env.WALLET_MASTER_ENCRYPTION_KEY!, "hex")

export class WalletService {
  async createWallet(userId: string): Promise<UserWallet> {
    const mnemonic = Wallet.createRandom().mnemonic!.phrase
    const hdNode = HDNodeWallet.fromMnemonic(mnemonic)
    const child = hdNode.derivePath("m/44'/60'/0'/0/0")

    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv)
    const encrypted = Buffer.concat([
      cipher.update(mnemonic, "utf8"),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    const encryptedSeed = iv.toString("hex") + ":" + tag.toString("hex") + ":"
      + encrypted.toString("hex")

    return await prisma.userWallet.create({
      data: {
        userId,
        encryptedSeed,
        walletAddress: child.address,
        derivationPath: "m/44'/60'/0'/0/0",
      },
    })
  }

  async getSigner(userId: string): Promise<HDNodeWallet> {
    // Fetch encrypted wallet from DB, decrypt, return HDNodeWallet
  }

  async deployAccount(userId: string): Promise<string> {
    // Call VeridaqSimpleAccountFactory, store accountAddress in DB
  }
}
```

### Key Implementation: PaymentService

```typescript
// services/payment.service.ts
export class PaymentService {
  private readonly flutterwave = new FlutterwaveClient({
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
  })

  async initializeCreditPack(userId: string, packType: string) {
    const pack = CREDIT_PACKS[packType]

    const payment = await prisma.payment.create({
      data: { userId, amount: pack.priceNGN, currency: "NGN", ... },
    })

    const response = await this.flutterwave.initializeTransaction({
      tx_ref: `VRD-${payment.id}`,
      amount: pack.priceNGN,
      currency: "NGN",
      redirect_url: `${FRONTEND_URL}/payments/callback`,
      customer: { email: userEmail },
      meta: { paymentId: payment.id },
    })

    return { authorizationUrl: response.data.link }
  }

  async handleFlutterwaveWebhook(event: FlutterwaveEvent) {
    if (event.event !== "charge.completed") return

    const payment = await prisma.payment.findUnique({
      where: { providerRef: event.data.tx_ref },
    })
    if (!payment || payment.status !== "PENDING") return

    const verify = await this.flutterwave.verifyTransaction(event.data.id)
    if (verify.data.status !== "successful") return

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
      prisma.employer.update({
        where: { userId: payment.userId },
        data: { verificationCredits: { increment: payment.creditsAdded! } },
      }),
    ])
  }
}
```

### Key Implementation: EarningsService

```typescript
// services/earnings.service.ts
export class EarningsService {
  async creditVerification(
    institutionId: string,
    verificationId: string,
    amountUsd: number,
    amountWei: bigint,
  ): Promise<void> {
    const platformShare = amountUsd * 0.7
    const institutionShare = amountUsd * 0.2
    const poolShare = amountUsd * 0.1

    await prisma.$transaction([
      // Update InstitutionEarnings
      prisma.institutionEarnings.upsert({
        where: { institutionId },
        create: {
          institutionId,
          totalEarnedUsd: institutionShare,
          availableUsd: institutionShare,
        },
        update: {
          totalEarnedUsd: { increment: institutionShare },
          availableUsd: { increment: institutionShare },
        },
      }),
      // Update GasPool
      prisma.gasPool.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          totalDepositedUsd: poolShare,
          availableUsd: poolShare,
        },
        update: {
          totalDepositedUsd: { increment: poolShare },
          availableUsd: { increment: poolShare },
        },
      }),
      // Record EarningTransaction
      prisma.earningTransaction.create({
        data: {
          institutionId,
          verificationId,
          type: "EARNED",
          amountUsd,
          amountWei,
          platformShareUsd: platformShare,
          institutionShareUsd: institutionShare,
          poolShareUsd: poolShare,
          description: `Verification ${verificationId}`,
        },
      }),
    ])
  }

  async requestWithdrawal(
    institutionId: string,
    amountUsd: number,
    method: "CRYPTO" | "FIAT",
  ): Promise<void> {
    const earnings = await prisma.institutionEarnings.findUnique({
      where: { institutionId },
    })

    if (!earnings || Number(earnings.availableUsd) < amountUsd) {
      throw new Error("Insufficient balance")
    }

    // Deduct balance
    await prisma.institutionEarnings.update({
      where: { institutionId },
      data: {
        availableUsd: { decrement: amountUsd },
        withdrawnUsd: { increment: amountUsd },
      },
    })

    await prisma.earningTransaction.create({
      data: {
        institutionId,
        type: "WITHDRAWN",
        amountUsd,
        amountWei: 0, // computed at time of transfer
        description: `Withdrawal (${method}): $${amountUsd}`,
      },
    })
  }
}
```

---

## 11. Frontend Changes

### New Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email input → OTP input (no password) |
| Register | `/register` | Email → name → OTP verify (instant account) |
| Payment callback | `/payments/callback` | Flutterwave redirect landing |
| Institution Earnings | `/institution/earnings` | Balance, transactions, withdrawal |
| Institution Verify | `/institution/verify` | Verify as employer (alsoEmployer only) |
| Admin Earnings | `/admin/earnings` | Platform revenue, gas pool, institution earnings |

### Modified Pages

| Page | Changes |
|------|---------|
| Institution login | Replace with shared email-OTP login |
| Employer login | Replace with shared email-OTP login |
| Institution dashboard | Add earnings summary card, schema selector |
| Institution batches | Add schema column to batch list |
| Institution nav | Add "Verify" and "Earnings" links (conditional) |
| Employer verify | Show dynamic claim types based on institution schema |
| Employer history | Show schema info in verification details |
| Credit purchase modal | NGN pricing with live exchange rate |

### Login UX (Desktop)

```
┌──────────────────────────────────────┐
│                                      │
│   ┌────────────────────────────────┐ │
│   │    VERIDAQ                     │ │
│   │                                │ │
│   │    Email                       │ │
│   │    ┌──────────────────────┐   │ │
│   │    │  you@example.com    │   │ │
│   │    └──────────────────────┘   │ │
│   │                                │ │
│   │    [ Send Login Code ]         │ │
│   │                                │ │
│   │    ── or ──                    │ │
│   │                                │ │
│   │    [ Sign in with Password ]   │ │
│   │    [ Register Institution ]    │ │
│   └────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘
```

After sending code:

```
┌──────────────────────────────────────┐
│                                      │
│   ┌────────────────────────────────┐ │
│   │    VERIDAQ                     │ │
│   │                                │ │
│   │    Enter the code sent to      │ │
│   │    y***@example.com            │ │
│   │                                │ │
│   │    ┌──────────────────────┐   │ │
│   │    │  _  _  _  _  _  _  │   │ │
│   │    └──────────────────────┘   │ │
│   │                                │ │
│   │    [ Verify & Login ]          │ │
│   │                                │ │
│   │    Resend code in 30s          │ │
│   └────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘
```

### Auth Flow (Frontend)

```typescript
// lib/auth.tsx — updated AuthContext

// Step 1: Send OTP
const { data } = await api.post("/auth/send-otp", { email })
// → { message: "Code sent" }

// Step 2: Verify OTP
const { data } = await api.post("/auth/verify-otp", { email, code })
// → { user, token } — JWT set as httpOnly cookie by server
// → On first login, wallet created in background
// → User redirected to appropriate dashboard
```

### Credit Purchase UX (NGN Pricing)

```
┌────────────────────────────────────────────┐
│  Buy Verification Credits                  │
│                                            │
│  ┌────────────┐  ┌────────────┐          │
│  │ 10 Credits │  │ 25 Credits │          │
│  │  ₦20,415   │  │  ₦47,635   │          │
│  │  ($15.00)  │  │  ($35.00)  │          │
│  └────────────┘  └────────────┘          │
│                                            │
│  ┌────────────┐  ┌────────────┐          │
│  │ 50 Credits │  │ 100 Credits│          │
│  │  ₦88,465   │  │  ₦163,320  │          │
│  │  ($65.00)  │  │  ($120.00) │          │
│  └────────────┘  └────────────┘          │
│                                            │
│  Payment Method:                           │
│  ○ Card (NGN)    ○ Bank Transfer (NGN)    │
│                                            │
│  Rates updated 12 min ago • ₦1,361 = $1   │
│                                            │
│  [ Pay with Flutterwave ]                  │
└────────────────────────────────────────────┘
```

---

## 12. Dev Branch & Vercel Preview Deployment

### Strategy

Use Vercel **Branch Domains** (not Preview Deployment Suffix, which
requires Enterprise plan).

| Environment | Branch | Domain | Purpose |
|:-----------:|:------:|:------:|---------|
| Production | `main` | `veridaq-official.vercel.app` | Live app |
| Development | `dev` | `dev.veridaq-official.vercel.app` | Staging / experiments |
| Feature | `feat/*` | `*-git-xxx.veridaq-official.vercel.app` | Per-branch preview |

### Setup Steps

1. **Create the `dev` branch**:
   ```bash
   git checkout -b dev
   git push -u origin dev
   ```

2. **Add branch domain in Vercel Dashboard**:
   - Go to Project → Settings → Domains
   - Add `dev.veridaq-official.vercel.app`
   - Select "Branch" → `dev`
   - Save

3. **Configure DNS** (if using custom domain apex):
   - Add CNAME record: `dev` → `cname.vercel-dns.com`
   - Or use Vercel's nameservers

4. **Environment Variables**:
   - Copy production env vars
   - Change `NEXT_PUBLIC_APP_URL=https://dev.veridaq-official.vercel.app`
   - Point to dev database (separate PostgreSQL instance or schema)
   - Use test payment API keys (Flutterwave test mode)
   - Set `FALLBACK_RATE_USD_TO_NGN=1361` for local dev

5. **Deploy**:
   - Push to `dev` → auto-deploys to `dev.veridaq-official.vercel.app`
   - Vercel bot posts deployment URL in GitHub commit

### Development Workflow

```
main                  dev                   feat/otp-auth
 │                     │                      │
 │  (stable,          │  (unstable,          │  (feature branch)
 │   production)      │   experiments)       │
 │                     │                      │
 ├─── merge ──────────┤                      │
 │  (bug fixes only)  │                      │
 │                     ├─── merge ───────────┤
 │                     │  (feature complete)  │
 │                     │                      │
 │                     │  ─── deploy ────     │
 │                     │  dev.veridaq-        │
 │                     │  official.vercel.app │
 │                     │                      │
 │  ←── merge ────────┤                      │
 │  (after dev         │                      │
 │   is stable)        │                      │
```

---

# Part II — Feature Extensions

---

## 13. Institution-as-Employer

### Concept

An institution (e.g., FUTMINNA) should also be able to act as an employer —
verifying credentials from other institutions (for postgraduate admissions,
etc.). Employers remain employers-only.

### What Changes

- Institutions get an opt-in `alsoEmployer` flag
- When enabled, a linked `Employer` record is auto-created for them
- The institution can access employer features (Verify, History) from their dashboard
- The JWT/auth system allows dual-role access for institution+employer users

### Data Model

```prisma
model Employer {
  // ... existing fields ...
  institutionId String?       @unique
  institution   Institution?  @relation(fields: [institutionId], references: [id])
}

model Institution {
  // ... existing fields ...
  alsoEmployer    Boolean     @default(false)
  employerProfile Employer?
}
```

### Auth

- New middleware `requireEmployerOrInstitutionEmployer`
- Allows: `EMPLOYER` role (as today) + `INSTITUTION` role where `alsoEmployer === true`
- Verification routes switch from `requireEmployer` → `requireEmployerOrInstitutionEmployer`
- `/me` endpoint returns `alsoEmployer` for institution users

### Registration

- Institution registration form gets a checkbox: "Also verify credentials from other institutions?"
- When ticked AND KYC-approved, auto-create Employer record linked to this institution
- The checkbox can be toggled later from Institution Settings

### When Institution Creates a Verification Request

1. Backend detects role is `INSTITUTION` with `alsoEmployer: true`
2. Resolves `institution.employerProfile.id` → use that as `employerId`
3. Deducts credits from the linked employer profile
4. Revenue sharing: 20% credited to **this verification's institution**

---

## 14. Revenue Sharing & Wallet Architecture

### The Money Flow

```
                EMPLOYER
                    │
              pays for credits (NGN)
                    │
                    ▼
          ┌─────────────────────┐
          │   Platform Receives │
          │   Full Payment      │
          └────────┬────────────┘
                   │
       Store in Payment model
                   │
                   ▼
        ┌─── When verification runs ───┐
        │    1 credit consumed = $1.50 │
        │                              │
        │   $1.05 → Platform admin     │
        │   $0.30 → Institution wallet │
        │   $0.15 → Gas Savings Pool   │
        └──────────────────────────────┘


                 INSTITUTION
                     │
             pays for batch upload (NGN)
                     │
                     ▼
           ┌─────────────────────┐
           │  Payment goes to    │
           │  Gas Savings Pool   │
           └─────────────────────┘


                  ADMIN WALLET
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
    ┌─────────┐ ┌──────────┐ ┌────────────┐
    │Platform │ │Institution│ │Gas Savings │
    │  70%    │ │   20%    │ │Pool    10% │
    │         │ │          │ │            │
    │ Owner:  │ │ Owner:   │ │ Owner:     │
    │ Platform│ │Institution│ │Platform    │
    │ Admin   │ │ (can     │ │ Admin      │
    │ Wallet  │ │ withdraw) │ │ Wallet     │
    └─────────┘ └──────────┘ └────────────┘
```

### Important: Revenue Share Happens Per-Verification, Not Upfront

- When employer buys 10 credits: the full payment goes to platform initially
- As each verification is consumed (deducting 1 credit):
  - 70% → Platform admin
  - 20% → That institution's earnings balance (DB-tracked)
  - 10% → Gas Savings Pool (DB-tracked)
- Institution can withdraw their accrued balance to their external wallet or via fiat

### Three Wallet Balances Tracked in Database

1. **Platform Admin Wallet** (crypto — actual on-chain wallet):
   - Receives 70% of verification revenue
   - Receives batch upload fees
   - Platform admin can view/withdraw

2. **Institution Earnings** (DB-tracked, per institution):
   - Receives 20% of verification revenue per their students
   - Visible in institution dashboard
   - Can be withdrawn to their external wallet (crypto or fiat)

3. **Gas Savings Pool** (DB-tracked):
   - Receives 10% of verification revenue
   - Receives batch upload payments from institutions
   - Used to sponsor FREE tier batch uploads and 3 free employer verification trials
   - When pool balance is low, platform admin may top up

### Why No Smart Contract Needed

Revenue split is DB-level accounting. Admin's earnings go to their existing
`PLATFORM_ADMIN_ADDRESS` wallet (can be transferred periodically). Institution
earnings accrue in `InstitutionEarnings` table. Gas savings pool is tracked in
DB, with actual ETH held in the PaymasterVault contract (already deployed).

---

## 15. Money Flow & Accounting

### Complete Transaction Flow

#### Scenario A: Employer buys 10 credits ($15 equivalent in NGN)

```
1. Employer purchases 10-credit pack (₦20,415 at ₦1,361/$)
   → Payment record created (status: COMPLETED)
   → Employer.verificationCredits += 10
   → Full ₦20,415 credited to platform (no split yet)

2. Employer verifies a credential from FUTMINNA (first verification)
   → Credits consumed: 10 → 9
   → Revenue split happens NOW:
      • Platform: $1.05 (70%)
      • FUTMINNA: $0.30 (20%)
      • Gas Pool: $0.15 (10%)
   → InstitutionEarnings(FUTMINNA).availableUsd += $0.30
   → GasPool.availableUsd += $0.15
   → EarningTransaction created with full breakdown

3. Employer verifies another credential (second verification)
   → Same split, 9 → 8 credits
   → FUTMINNA earns another $0.30
```

#### Scenario B: Institution uploads 3000 credentials (PAID tier)

```
1. Institution pays ₦27,220 flat fee (1,001–5,000 tier at ₦1,361/$)
2. Money flows:
   → GasPool.availableUsd += $20
   → GasPoolTransaction created (DEPOSIT, source: "BATCH_UPLOAD_FEE")
3. Upload processing:
   → Backend chunks into 15 on-chain transactions (200 each)
   → On-chain gas cost: ~$4.09 (0.006 gwei)
   → GasPool.availableUsd -= $4.09
   → GasPoolTransaction created (SPEND, destination: "FREE_TIER_BATCH")
4. Net pool after this batch: +$15.91
```

#### Scenario C: FREE tier institution uploads 500 credentials

```
1. Institution uploads (no payment — platform sponsors)
2. Upload processing:
   → Backend chunks into 3 on-chain transactions
   → On-chain gas cost: ~$0.68 (0.006 gwei)
   → GasPool.availableUsd -= $0.68
   → GasPoolTransaction created (SPEND, destination: "FREE_TIER_BATCH")
```

#### Scenario D: Institution withdraws earnings

```
1. Institution has $45.00 available (₦61,245 at ₦1,361/$)
2. Clicks "Withdraw $45"
3. If CRYPTO:
   → Backend transfers 0.027 ETH from platform admin wallet → institution's payout wallet
   → InstitutionEarnings.availableUsd -= $45
   → InstitutionEarnings.withdrawnUsd += $45
   → EarningTransaction created (WITHDRAWN)
4. If FIAT:
   → EarningTransaction created (WITHDRAWN, status: PENDING)
   → Admin processes manually
   → Admin marks as completed
```

### Gas Pool Health Check

The gas pool should always have enough to cover:
1. FREE tier batch uploads
2. 3 free employer verifications (currently $0 — read-only)

At current gas prices (0.006 gwei):
- A typical FREE batch of 500 students: ~$0.68
- A 10-pack sold generates $1.50 for the pool → covers ~2 free batches
- A FREE batch of 999 students: ~$1.36
- Pool contribution from batch uploads is additional

**Safety**: If Gas Pool balance drops below $10, auto-notify platform admin to top up.

### Reconciliation

Every `EarningTransaction` stores the full breakdown:

```json
{
  "type": "EARNED",
  "amountUsd": 1.50,
  "amountWei": "<wei_value>",
  "platformShareUsd": 1.05,
  "institutionShareUsd": 0.30,
  "poolShareUsd": 0.15,
  "verificationId": "vr_xxx",
  "referenceId": "VRD-XXXX",
  "createdAt": "..."
}
```

This ensures full auditability — every cent is traceable to a specific verification.

---

# Part III — Execution

---

## 16. Edge Cases & Gotchas

### 1. Free Verifications (No Revenue Share)
- 3 free trials per employer → no institution earnings, no pool contribution
- `EarningsService.creditVerification()` must check if this was a free verification
- Solution: Pass a flag or detect from credit type

### 2. Institution Verifies Its Own Credentials
- Institution A uploads credentials for Student X
- Institution A also acts as employer, verifies Student X's credentials
- Who gets the 20%? → **Institution A** (it's their credential)
- This is correct — the institution earns from their own students

### 3. Institution A Verifies Institution B's Students
- Institution A (alsoEmployer=true) verifies credentials from Institution B
- 20% goes to **Institution B** (the credential owner)
- Institution A pays from their employer credits (separate from institution funds)

### 4. Employer Buys Credits but Never Uses Them
- No revenue sharing happens until credits are consumed
- The full payment sits as platform liability
- Potential refund scenario: implement refund logic if credits are unused after 1 year

### 5. Multiple Credit Packs
- Employer bought 10 credits ($15) + 50 credits ($65) = 60 credits total
- Which pack's rate is used per verification?
- **Solution**: Track credits per-pack (FIFO). Consume from oldest pack first.

### 6. Gas Pool Goes Negative
- If gas prices spike (e.g., 1 gwei instead of 0.006 gwei) while pool is low
- **Solution**: Platform admin manual top-up required. System alerts admin when pool < $10

### 7. Withdrawal - Insufficient Balance for Crypto Transfer
- Institution wants to withdraw $50 but their available balance is $45
- Validate on backend before initiating transfer
- Also account for gas cost of the transfer itself

### 8. Institution Toggles Off "alsoEmployer" Mid-Verification
- If they're in the middle of verifying as employer and toggle off
- Pending verifications should complete, then disable further employer access
- Don't orphan the employer profile (keep it, just set active: false)

### 9. Duplicate Verification Credit
- If backend crashes after on-chain verifyProof succeeds but before recording the split
- **Solution**: Make the split recording part of the same DB transaction as status update

### 10. Admin Wallet Tracking
- The platform admin's actual on-chain wallet receives real ETH (crypto)
- But the revenue split is in USD (tracked in DB)
- Need to handle exchange rate at time of transfer/payout
- **Solution**: Track everything in USD cents + wei equivalent at time of transaction

### 11. NGN Rate Staleness
- If the price oracle job fails for multiple cycles, displayed prices could be outdated
- **Solution**: Show warning banner if rates are >60 minutes old. Use hardcoded fallback
  from `.env` if no cached rate exists. Log warnings to Pino.

### 12. NGN Fluctuation During Payment Flow
- User sees price ₦20,415 on checkout page
- User takes 5 minutes to complete payment
- NGN rate may have shifted in that window
- **Solution**: Lock the rate at payment initialization. Store `rateUsdToNgn` on the
  `Payment` record. Accept the NGN amount from the locked rate even if rate moved.

### 13. Flutterwave Rate Spread
- Flutterwave charges ~2% spread on NGN→USDC conversion
- This spread reduces effective revenue by ~2%
- **Solution**: Account for this in pricing. The 70/20/10 split is on the USD amount
  received (post-spread), not the NGN amount paid.

---

## 17. Implementation Roadmap

### Phase 0: Foundation (Week 1-2)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 0.1 | Create `dev` branch + Vercel preview deployment | DevOps | None |
| 0.2 | Set up separate dev PostgreSQL database | DevOps | 0.1 |
| 0.3 | Set up test Flutterwave/Paystack accounts | Backend | None |
| 0.4 | Set up Open Exchange Rates + CoinGecko API keys | Backend | None |
| 0.5 | Add all new Prisma models + migration | Backend | 0.2 |
| 0.6 | Implement `OtpService` (generate, verify, rate limit) | Backend | 0.5 |

### Phase 1: Email-Only Auth + Pricing Oracle (Week 3-4)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 1.1 | Implement OTP auth routes (`send-otp`, `verify-otp`) | Backend | 0.6 |
| 1.2 | Implement `WalletService` (create, encrypt, decrypt) | Backend | 0.5 |
| 1.3 | Auto-create wallet on first OTP login | Backend | 1.2 |
| 1.4 | Implement `PriceOracleService` + BullMQ repeatable job | Backend | 0.4, 0.5 |
| 1.5 | Build `GET /api/pricing/rates` endpoint | Backend | 1.4 |
| 1.6 | Build OTP login UI (email → code → dashboard) | Frontend | 1.1 |
| 1.7 | Build pricing hooks + NGN display components | Frontend | 1.5 |
| 1.8 | Replace old login pages with new OTP login | Frontend | 1.6 |

### Phase 2: Flexible Circuits (Week 5-6)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 2.1 | Design and compile 8-slot circuit | Circuits | None |
| 2.2 | Run trusted setup for new circuit | Circuits | 2.1 |
| 2.3 | Deploy new verifier contract | Contracts | 2.2 |
| 2.4 | Build `SchemaService` and schema registry | Backend | 0.5 |
| 2.5 | Build `FlexibleProofService` for 8-slot proofs | Backend | 2.2 |
| 2.6 | Update batch upload to support schema selection | Backend | 2.4 |
| 2.7 | Update verification flow to use schema registry | Backend | 2.5 |
| 2.8 | Seed institution type schemas | Backend | 2.4 |

### Phase 3: Fiat Payments (Week 7-8)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 3.1 | Integrate Flutterwave stablecoin API | Backend | 0.3 |
| 3.2 | Build `PaymentService` (initialize, verify, record) | Backend | 3.1 |
| 3.3 | Build payment routes (initialize, webhook, status) | Backend | 3.2 |
| 3.4 | Build credit purchase UI (packs, Flutterwave widget) | Frontend | 3.3 |
| 3.5 | Build payment status polling UI | Frontend | 3.3 |
| 3.6 | Integrate payments with earnings/revenue split | Backend | 3.2 |

### Phase 4: Institution-as-Employer + Earnings (Week 8-9)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 4.1 | Add `alsoEmployer` field + employer linking | Backend | 0.5 |
| 4.2 | Build `requireEmployerOrInstitutionEmployer` middleware | Backend | 4.1 |
| 4.3 | Update verification routes for dual-role | Backend | 4.2 |
| 4.4 | Implement `EarningsService` (credit, withdraw, pool) | Backend | 3.6 |
| 4.5 | Build Institution Verify page (reuse employer components) | Frontend | 4.3 |
| 4.6 | Build Institution Earnings page + withdrawal UI | Frontend | 4.4 |
| 4.7 | Build Admin Earnings dashboard | Frontend | 4.4 |

### Phase 5: Testing & Polish (Week 10-11)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 5.1 | Backend test suite for OTP auth + wallet creation | Backend | 1.3 |
| 5.2 | Backend test suite for flexible proofs | Backend | 2.5 |
| 5.3 | Backend test suite for payment flows | Backend | 3.2 |
| 5.4 | Backend test suite for earnings service | Backend | 4.4 |
| 5.5 | E2E test: OTP register → buy credits → verify credential | E2E | 5.1-5.3 |
| 5.6 | E2E test: institution uploads batch, employer verifies, earnings credited | E2E | 5.4 |
| 5.7 | Security audit: OTP, wallet encryption, webhook HMAC | Security | 5.1 |
| 5.8 | Legal review: DPA, privacy policy, NDPR/GDPR checklist | Legal | None |
| 5.9 | Price oracle failover testing | Backend | 1.4 |
| 5.10 | Merge `dev` → `main` after full QA pass | DevOps | 5.5-5.9 |

---

## 18. Files Changed Summary

### Backend: New Files

| File | Purpose |
|------|---------|
| `services/otp.service.ts` | OTP generation, rate limiting, verification |
| `services/wallet.service.ts` | Embedded wallet creation, encryption, signing |
| `services/payment.service.ts` | Flutterwave/Paystack payment processing |
| `services/price-oracle.service.ts` | Exchange rate fetching and caching |
| `services/schema.service.ts` | Credential schema registry management |
| `services/flexible-proof.service.ts` | 8-slot ZK proof generation |
| `services/earnings.service.ts` | Revenue split, withdrawals, gas pool |
| `workers/price-oracle.worker.ts` | BullMQ repeatable job for rate updates |
| `routes/pricing.ts` | GET /api/pricing/rates endpoint |
| `routes/earnings.ts` | Institution/admin earnings endpoints |

### Backend: Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 12+ new models, modify existing models |
| `plugins/auth.ts` | Add `requireEmployerOrInstitutionEmployer` guard, session validation |
| `routes/auth.ts` | Add OTP routes, `alsoEmployer` field |
| `routes/verification.ts` | Replace guard, integrate schema registry |
| `routes/institution.ts` | Toggle employer access, schema selection, batch payment |
| `routes/admin.ts` | Earnings overview, withdrawal processing |
| `services/auth.service.ts` | Add OTP login/register flow, wallet creation hook |
| `services/verification.service.ts` | Schema-aware verification, earnings trigger |
| `services/blockchain.service.ts` | UserOp signing, SimpleAccount deployment |
| `services/institution.service.ts` | Schema selection for batch upload |
| `server.ts` | Register new route modules, start price oracle job |
| `config/index.ts` | Add new env vars (API keys, fallback rates) |

### Frontend: New Files

| File | Purpose |
|------|---------|
| `app/login/page.tsx` | Shared email-OTP login page |
| `app/register/page.tsx` | Shared registration page |
| `app/payments/callback/page.tsx` | Flutterwave redirect handler |
| `app/institution/verify/page.tsx` | Institution verification as employer |
| `app/institution/earnings/page.tsx` | Institution earnings dashboard |
| `app/admin/earnings/page.tsx` | Admin earnings overview |
| `components/institution/withdraw-modal.tsx` | Withdrawal form modal |
| `hooks/usePricing.ts` | React Query hook for live pricing |
| `lib/pricing.ts` | NGN price computation utilities |

### Frontend: Modified Files

| File | Changes |
|------|---------|
| `app/institution/login/page.tsx` | Replace with redirect to shared login |
| `app/employer/login/page.tsx` | Replace with redirect to shared login |
| `app/institution/dashboard/page.tsx` | Add earnings summary card, schema selector |
| `app/institution/batches/page.tsx` | Add schema column |
| `app/employer/verify/page.tsx` | Dynamic claim types from schema |
| `app/employer/history/page.tsx` | Schema info in details |
| `components/institution/layout.tsx` | Add Verify + Earnings nav items |
| `components/employer/credit-purchase-modal.tsx` | NGN pricing, live rates |
| `lib/auth.tsx` | OTP flow, session management |
| `lib/api.ts` | Add rate refresh interceptor |

### New Environment Variables

```
# ── OTP Auth ──
# (uses existing SENDGRID_API_KEY for email delivery)

# ── Wallet Encryption ──
WALLET_MASTER_ENCRYPTION_KEY=<32-byte-hex>

# ── Price Oracle ──
OXR_APP_ID=                     # Open Exchange Rates app ID
COINGECKO_API_KEY=              # CoinGecko API key (optional, free tier no key needed)
FALLBACK_RATE_USD_TO_NGN=1361
FALLBACK_RATE_ETH_TO_USD=1669.30
FALLBACK_BASE_GAS_PRICE_GWEI=0.006

# ── Payment Providers ──
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_ENCRYPTION_KEY=     # For webhook payload decryption
PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=

# ── Revenue Sharing ──
VERIFICATION_PRICE_USD_CENTS=150
PLATFORM_REVENUE_SHARE_PERCENT=70
INSTITUTION_REVENUE_SHARE_PERCENT=20
GAS_POOL_REVENUE_SHARE_PERCENT=10
GAS_POOL_MIN_BALANCE_USD=10

# ── Batch Pricing (USD cents, displayed in NGN) ──
BATCH_PRICE_1001_5000_USD_CENTS=2000
BATCH_PRICE_5001_10000_USD_CENTS=3000
BATCH_PRICE_10001_25000_USD_CENTS=9000
BATCH_PRICE_25001_50000_USD_CENTS=17000

# ── Credit Packs (USD cents) ──
CREDIT_PACK_5_USD_CENTS=700
CREDIT_PACK_10_USD_CENTS=1500
CREDIT_PACK_25_USD_CENTS=3500
CREDIT_PACK_50_USD_CENTS=6500
CREDIT_PACK_100_USD_CENTS=12000
CREDIT_PACK_500_USD_CENTS=55000

# ── Batch Processing ──
MAX_BATCH_CHUNK_SIZE=200

# ── Dev Deployment ──
NEXT_PUBLIC_APP_URL=https://dev.veridaq-official.vercel.app
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=   # Test keys for dev
```
