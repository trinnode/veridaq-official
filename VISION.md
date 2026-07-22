# VERIDAQ — Next-Generation Architecture Vision

> **Status**: Research & design — not implemented
> **Date**: 2026-07-21
> **Target Branch**: `dev` (preview at `dev.veridaq-official.vercel.app/`)

---

## Table of Contents

1. [Core Design Principle](#1-core-design-principle)
2. [Email-Only Authentication](#2-email-only-authentication)
3. [Embedded Wallet Architecture](#3-embedded-wallet-architecture)
4. [Multi-Institution Flexible Circuit](#4-multi-institution-flexible-circuit)
5. [Fiat-to-Stablecoin Payment Flow](#5-fiat-to-stablecoin-payment-flow)
6. [Revenue & Pricing Model](#6-revenue--pricing-model)
7. [KYC & Legal Compliance](#7-kyc--legal-compliance)
8. [Data Model Changes](#8-data-model-changes)
9. [Backend Changes](#9-backend-changes)
10. [Frontend Changes](#10-frontend-changes)
11. [Dev Branch & Vercel Preview Deployment](#11-dev-branch--vercel-preview-deployment)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Open Questions](#13-open-questions)

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
familiar web forms, receive email OTPs, and pay in fiat (NGN/USD). The
platform creates wallets, signs transactions, and settles on-chain
settlement in the background.

### Who Sees What

| User Role | Sees Blockchain? | Sees Wallet? | Sees Gas Fees? | Pays In? |
|-----------|:-:|:-:|:-:|:-:|
| Student | Never | Never | Never | Nothing (free) |
| Institution Admin | Never | Never (one-time setup) | Never | NGN |
| Employer | Never | Never | Never | NGN/USD |
| Platform Admin | Dashboard only | Yes (manages paymaster) | Yes (gas pool) | N/A |

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
  id        String   @id @default(cuid())
  email     String
  code      String   // 6-digit, hashed with bcrypt
  type      String   // "LOGIN" | "REGISTRATION" | "PASSWORD_RESET" | "EMAIL_CHANGE"
  attempts  Int      @default(0)
  maxAttempts Int    @default(3)  // Invalidate after 3 wrong attempts
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

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
// VeridaqSimpleAccountFactory is already deployed on Base Sepolia
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

  // Encrypted seed — AES-256-GCM, nonce + ciphertext + tag stored as hex
  encryptedSeed   String
  // Derivations
  walletAddress   String   // Derived address (EVM)
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

// VERIDAQ Flexible Credential Circuit
// Supports up to 8 arbitrary fields per credential
// Single circuit for ALL institution types

template Credential() {
    // ── Private Inputs ──
    signal input privateInputs[8];      // Poseidon hashes of each field value
    signal input merkleProof[levels];   // Merkle proof path
    signal input nullifierSeed;         // Unique seed for nullifier derivation

    // ── Public Inputs (also public outputs) ──
    signal input claimType;             // Which claim is being made (encoded)
    signal input threshold;             // Minimum value / matching hash

    // ── Public Outputs ──
    signal output commitment;           // Poseidon hash of all 8 slots
    signal output nullifier;            // Poseidon(nullifierSeed)
    signal output merkleRoot;           // Verified tree root

    // ── Computations ──
    component hash = Poseidon(8);
    for (var i = 0; i < 8; i++) {
        hash.inputs[i] <== privateInputs[i];
    }
    commitment <== hash.out;

    component nullifierHash = Poseidon(1);
    nullifierHash.inputs[0] <== nullifierSeed;
    nullifier <== nullifierHash.out;

    // Verify Merkle proof
    component merkleCalculator = MerkleTreeCalculator(levels);
    merkleCalculator.leaf <== commitment;
    for (var i = 0; i < levels; i++) {
        merkleCalculator.siblings[i] <== merkleProof[i];
    }
    merkleRoot <== merkleCalculator.root;

    // claimType and threshold are public — the verifier checks them
    // against the verified credential data off-chain
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

  // 8 slots — each with a human-readable field name
  slot0Field      String   // e.g. "matric_no"
  slot1Field      String
  slot2Field      String
  slot3Field      String
  slot4Field      String
  slot5Field      String
  slot6Field      String
  slot7Field      String

  // Claim types available for this schema (JSON array of {code, label, description})
  // e.g. [{"code": 1, "label": "Graduated", "fields": [0,1,2,3,4]}]
  claimTypes      Json

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
┌─────────┐     ┌───────────────┐     ┌──────────────────┐
│  User   │────▶│  Paystack /   │────▶│  Stablecoin      │
│ pays    │     │  Flutterwave  │     │  Wallet          │
│ NGN/USD │     │  (convert to  │     │  (Platform Admin)│
│         │     │   USDC/USDT)  │     │                  │
└─────────┘     └───────────────┘     └──────────────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │  Revenue Split   │
                                     │  (DB-level)      │
                                     │  70/20/10        │
                                     └──────────────────┘
```

### Fiat On-Ramp Options

#### Option 1: Paystack (NGN Focus)

| Feature | Details |
|---------|---------|
| Supported currencies | NGN, GHS, ZAR, USD |
| Settles to | NGN bank account |
| Transaction fee | 1.5% + ₦100 (NGN) |
| Payout speed | T+1 (next business day) |
| API | REST, webhooks |
| Docs | https://paystack.com/docs |

**Flow:**
1. User pays in NGN via Paystack (card, USSD, bank transfer, QR)
2. Paystack settles NGN to platform's bank account
3. Backend records the fiat payment, updates credits/balance
4. Platform admin periodically converts NGN to USDC (via Quidax/Busha) for
   on-chain operations

**Limitation**: Paystack does not natively convert to stablecoins. The
platform must manage the fiat-to-crypto conversion separately.

#### Option 2: Flutterwave Stablecoins (Recommended)

Flutterwave now supports buying/selling USDC and USDT directly via their API:

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

**Polygon USDC advantages over Base:**
- Flutterwave natively settles USDC on Polygon
- Low fees (~$0.001 per transfer)
- Fast finality (2-3 seconds)
- Can bridge to Base if needed (via Across or custom bridge)

#### Option 3: cNGN Oracle for NGN Stablecoin

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

### Subscription & Credit Pricing

**Employers pay per verification** (credits):

| Pack | Price (USD) | Price (NGN) | Per Verify |
|------|:-----------:|:-----------:|:----------:|
| 5 (trial) | $7 | ₦9,527 | $1.40 |
| 10 | $15 | ₦20,415 | $1.50 |
| 25 | $35 | ₦47,635 | $1.40 |
| 50 | $65 | ₦88,465 | $1.30 |
| 100 | $120 | ₦163,320 | $1.20 |
| 500 | $550 | ₦748,550 | $1.10 |

**Note**: At higher volumes, the per-verification price drops, creating a
volume discount. This is already in the existing `implementation.md` plan.

**Institutions pay for batch upload** (PAID tier):

| Batch Size | Fee (USD) | Fee (NGN) | Used For |
|:----------:|:---------:|:---------:|----------|
| 1–999 | Free | Free | Gas pool sponsors |
| 1,001–5,000 | $20 | ₦27,220 | Gas pool |
| 5,001–10,000 | $30 | ₦40,830 | Gas pool |
| 10,001–25,000 | $90 | ₦122,490 | Gas pool |
| 25,001–50,000 | $170 | ₦231,370 | Gas pool |

### Payment Records

```prisma
model Payment {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  // Amount
  amount          Decimal  // In fiat currency
  currency        String   // "NGN" | "USD"
  amountUsd       Decimal  // Normalized to USD

  // What was purchased
  packType        String?  // "CREDITS_5" | "CREDITS_10" | ... | "BATCH_1001_5000" | ...
  packLabel       String?  // "10 verification credits" | "Batch upload (1,001-5,000)"
  creditsAdded    Int?     // For employer credit packs
  institutionId   String?  // For batch upload payments

  // Payment provider
  provider        String   // "PAYSTACK" | "FLUTTERWAVE"
  providerRef     String   // Paystack reference / Flutterwave transaction ID
  status          String   // "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"

  // Stablecoin settlement
  stablecoinAddress String? // USDC/USDT wallet that received the funds
  stablecoinAmount  Decimal? // Amount received in stablecoin
  txHash            String?  // On-chain transaction hash (if applicable)

  createdAt       DateTime @default(now())
  completedAt     DateTime?
  metadata        Json?

  @@map("payments")
}
```

### Settlement Flow (Detailed)

```
1. User clicks "Buy 10 Credits" on frontend
   ↓
2. Frontend calls POST /api/payments/initialize
   → Backend returns { authorizationUrl: "https://checkout.flutterwave.com/..." }
   → Or { reference: "VRD-XXX", publicKey: "flwpk_..." } for inline card form
   ↓
3. User completes payment in Flutterwave widget
   ↓
4. Flutterwave sends webhook to POST /api/payments/webhook/flutterwave
   → Verify HMAC signature
   → If event.type == "stablecoin-transfer.completed":
     • Update Payment.status = "COMPLETED"
     • Add credits to Employer.verificationCredits
     • Or flag Institution batch payment as received
   → If event.type == "charge.completed" (card/NGN):
     • Mark Payment.status = "COMPLETED"
     • Credits added immediately
   ↓
5. Frontend polls GET /api/payments/{reference}/status
   → Shows success state
   → Redirects to dashboard with new credit balance
```

### Withdrawal Flow (Institution Earnings)

Institutions earn 20% of verification revenue. They can withdraw:

1. **Via Flutterwave Stablecoins** (automatic, low fees):
   - Backend initiates Flutterwave stablecoin payout from platform's wallet
     to the institution's Flutterwave ID or wallet address
   - Flutterwave converts USDC → NGN and sends to institution's bank account
   - Fee: ~2%

2. **Via crypto** (manual, higher fees):
   - Backend transfers ETH from platform admin wallet to institution's
     payout wallet address
   - Gas cost: ~$0.50-2.00 depending on network

3. **Via bank transfer** (manual, admin processes):
   - Institution initiates withdrawal request
   - Admin reviews, initiates bank transfer
   - Fee: bank charges

---

## 6. Revenue & Pricing Model

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

## 7. KYC & Legal Compliance

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

## 8. Data Model Changes

### New Models (In Addition to Existing)

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
  otpEnabled    Boolean    @default(true)    // Email-only auth
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
  id              String   @id @default(cuid())
  institutionId   String
  institution     Institution @relation(fields: [institutionId], references: [id])
  schemaId        String
  schema          CredentialSchema @relation(fields: [schemaId], references: [id])

  // Example: for university, schema slot0=matric_no
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

  batchId    String?
  batch      BatchUpload?
  createdAt  DateTime @default(now())

  @@unique([institutionId, studentIdentifier])
  @@index([commitment])
  @@map("institution_credentials")
}


// ===== PAYMENTS =====

model Payment {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  amount            Decimal
  currency          String   // "NGN" | "USD"
  amountUsd         Decimal
  packType          String?  // "CREDITS_5" | "CREDITS_10" | "CREDITS_25" | "CREDITS_50" | "CREDITS_100" | "CREDITS_500" | "BATCH_1001_5000" | ...
  packLabel         String?
  creditsAdded      Int?
  institutionId     String?
  provider          String   // "PAYSTACK" | "FLUTTERWAVE"
  providerRef       String
  status            String   // "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"
  stablecoinAddress String?
  stablecoinAmount  Decimal?
  txHash            String?
  createdAt         DateTime @default(now())
  completedAt       DateTime?
  metadata          Json?

  @@map("payments")
}

// Modify existing Employer model
model Employer {
  // ... existing fields ...
  institutionId String?       @unique
  institution   Institution?  @relation(fields: [institutionId], references: [id])
  // Allow employers to exist without wallet initially
  walletAddress String?       // Their Smart Account address (for ownership)
}


// Modify existing BatchUpload model
model BatchUpload {
  // ... existing fields ...
  schemaId String?           // Which schema this batch uses
  schema   CredentialSchema? @relation(fields: [schemaId], references: [id])
}
```

### Changes to Existing Models

**User model**: Add `otpEnabled`, `emailVerified`, relation to `UserWallet`, `UserSession`

**Employer model**: Add `institutionId` for institution-as-employer linking. Add `walletAddress` (nullable — employer may not need wallet).

**Institution model**: Already has `alsoEmployer` and `employerProfile` (from implementation.md).

**BatchUpload**: Add optional `schemaId` foreign key to `CredentialSchema`.

---

## 9. Backend Changes

### New Services

| Service | File | Purpose |
|---------|------|---------|
| `OtpService` | `services/otp.service.ts` | Generate, send, verify OTP codes |
| `WalletService` | `services/wallet.service.ts` | Create, encrypt, manage embedded wallets |
| `PaymentService` | `services/payment.service.ts` | Initiate, verify, record fiat payments |
| `SchemaService` | `services/schema.service.ts` | Manage credential schemas, slot mappings |
| `FlexibleProofService` | `services/flexible-proof.service.ts` | Generate ZK proofs using 8-slot circuit |

### Modified Services

| Service | Changes |
|---------|---------|
| `auth.service.ts` | Add OTP login/register flow, email verification, session management |
| `auth.plugin.ts` | Add session validation from `UserSession` |
| `blockchain.service.ts` | Add userOp signing, SimpleAccount deployment, Paymaster interaction |
| `verification.service.ts` | Update to work with schema registry + flexible proof |
| `institution.service.ts` | Add schema selection to batch upload flow |
| `earnings.service.ts` | Integrate with PaymentService for fiat withdrawal |

### New Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/send-otp` | None | Send OTP to email |
| POST | `/api/auth/verify-otp` | None | Verify OTP, login/register |
| POST | `/api/auth/logout` | Required | End session |
| GET | `/api/payments/packs` | Required | List available credit packs with prices |
| POST | `/api/payments/initialize` | Required | Create payment intent, return checkout URL |
| POST | `/api/payments/webhook/flutterwave` | Webhook | Flutterwave payment callback |
| POST | `/api/payments/webhook/paystack` | Webhook | Paystack payment callback |
| GET | `/api/payments/:reference/status` | Required | Poll payment status |
| GET | `/api/schemas` | None | List all credential schemas |
| GET | `/api/schemas/:type` | None | Get schema by institution type |
| POST | `/api/institution/batch/upload` | Institution | Upload batch with schema |
| GET | `/api/institution/credentials/:studentId` | Institution | Look up credential details |

### Key Implementation Details

#### OTP Service

```typescript
// services/otp.service.ts
import crypto from "node:crypto"
import bcrypt from "bcryptjs"

export class OtpService {
  private readonly OTP_LENGTH = 6
  private readonly OTP_EXPIRY = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_ATTEMPTS = 3
  private readonly RATE_LIMIT = 5 // per 15 minutes
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000

  async generate(email: string, type: "LOGIN" | "REGISTRATION"): Promise<void> {
    // 1. Rate limit check: count OTPs sent to this email in last 15 min
    // 2. Generate 6-digit code: crypto.randomInt(100000, 999999).toString()
    // 3. Hash with bcrypt (cost 8 — OTPs are short-lived)
    // 4. Store in OtpCode table
    // 5. Send via email (SendGrid / AWS SES)
  }

  async verify(email: string, code: string): Promise<boolean> {
    // 1. Find latest unused, unexpired OTP for this email
    // 2. Check attempts < MAX_ATTEMPTS
    // 3. bcrypt.compare(code, otp.code)
    // 4. If match: mark used, return true
    // 5. If no match: increment attempts, if attempts >= 3, invalidate OTP
  }
}
```

#### Wallet Service

```typescript
// services/wallet.service.ts
import { Wallet, HDNodeWallet } from "ethers"
import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const MASTER_KEY = Buffer.from(process.env.WALLET_MASTER_ENCRYPTION_KEY!, "hex")

export class WalletService {
  async createWallet(userId: string): Promise<UserWallet> {
    // 1. Generate random BIP-39 mnemonic (12 words)
    const mnemonic = Wallet.createRandom().mnemonic!.phrase

    // 2. Derive wallet at path m/44'/60'/0'/0/0
    const hdNode = HDNodeWallet.fromMnemonic(mnemonic)
    const child = hdNode.derivePath("m/44'/60'/0'/0/0")

    // 3. Encrypt mnemonic
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv)
    const encrypted = Buffer.concat([
      cipher.update(mnemonic, "utf8"),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    const encryptedSeed = iv.toString("hex") + ":" + tag.toString("hex") + ":" +
      encrypted.toString("hex")

    // 4. Store in DB
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
    // 1. Fetch encrypted wallet from DB
    // 2. Decrypt with master key
    // 3. Return HDNodeWallet instance for signing
  }

  async deployAccount(userId: string): Promise<string> {
    // 1. Get signer
    // 2. Call VeridaqSimpleAccountFactory to deploy SimpleAccount
    // 3. Store accountAddress in DB
    // 4. Return address
  }
}
```

#### Payment Service (Flutterwave)

```typescript
// services/payment.service.ts
export class PaymentService {
  private readonly flutterwave = new FlutterwaveClient({
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
  })

  async initializeCreditPack(userId: string, packType: string) {
    const pack = CREDIT_PACKS[packType]
    // 1. Create Payment record (status: PENDING)
    const payment = await prisma.payment.create({
      data: { userId, amount: pack.priceNGN, currency: "NGN", ... },
    })

    // 2. Initialize Flutterwave transaction
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

    // Verify transaction
    const verify = await this.flutterwave.verifyTransaction(event.data.id)
    if (verify.data.status !== "successful") return

    // Update payment
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
      // Add credits to employer
      prisma.employer.update({
        where: { userId: payment.userId },
        data: { verificationCredits: { increment: payment.creditsAdded! } },
      }),
    ])
  }
}
```

---

## 10. Frontend Changes

### New Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email input → OTP input (no password) |
| Register | `/register` | Email → name → OTP verify (instant account) |
| Payment callback | `/payments/callback` | Flutterwave redirect landing |

### Modified Pages

| Page | Changes |
|------|---------|
| Institution login | Replace with shared email-OTP login |
| Employer login | Replace with shared email-OTP login |
| Institution dashboard | Add schema selector for batch upload |
| Institution batches | Add schema column to batch list |
| Employer verify | Show dynamic claim types based on institution schema |
| Employer history | Show schema info in verification details |

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
│   │    [ Sign in with Google ]     │ │
│   │    [ Institution Register ]    │ │
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

// Step 3: Session established
// api client uses the httpOnly cookie automatically
```

### Credit Purchase UX

```
┌────────────────────────────────────────────┐
│  Buy Verification Credits                  │
│                                            │
│  ┌────────────┐  ┌────────────┐          │
│  │ 10 Credits │  │ 25 Credits │          │
│  │  $15.00    │  │  $35.00    │          │
│  │  ₦20,415   │  │  ₦47,635   │          │
│  └────────────┘  └────────────┘          │
│                                            │
│  ┌────────────┐  ┌────────────┐          │
│  │ 50 Credits │  │ 100 Credits│          │
│  │  $65.00    │  │  $120.00   │          │
│  │  ₦88,465   │  │  ₦163,320  │          │
│  └────────────┘  └────────────┘          │
│                                            │
│  ┌────────────────────────────────────┐  │
│  │  Or enter custom amount            │  │
│  │  ┌──────────────────┐             │  │
│  │  │  $               │             │  │
│  │  └──────────────────┘             │  │
│  └────────────────────────────────────┘  │
│                                            │
│  Payment Method:                           │
│  ○ Card (NGN)    ○ Bank Transfer (NGN)    │
│  ○ USDC          ○ USDT                   │
│                                            │
│  [ Pay with Flutterwave ]                  │
└────────────────────────────────────────────┘
```

---

## 11. Dev Branch & Vercel Preview Deployment

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

## 12. Implementation Roadmap

### Phase 0: Foundation (Week 1-2)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 0.1 | Create `dev` branch + Vercel preview deployment | DevOps | None |
| 0.2 | Set up separate dev PostgreSQL database | DevOps | 0.1 |
| 0.3 | Set up test Flutterwave/Paystack accounts | Backend | None |
| 0.4 | Add new Prisma models + migration | Backend | 0.2 |
| 0.5 | Implement `OtpService` (generate, verify, rate limit) | Backend | 0.4 |
| 0.6 | Implement OTP auth routes (`send-otp`, `verify-otp`) | Backend | 0.5 |

### Phase 1: Email-Only Auth (Week 3-4)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 1.1 | Implement `WalletService` (create, encrypt, decrypt) | Backend | 0.4 |
| 1.2 | Auto-create wallet on first OTP login | Backend | 1.1 |
| 1.3 | Deploy ERC-4337 SimpleAccount | Backend | 1.2 |
| 1.4 | Build OTP login UI (email → code → dashboard) | Frontend | 0.6 |
| 1.5 | Build OTP register UI | Frontend | 0.6 |
| 1.6 | Update auth context and API client | Frontend | 1.4 |
| 1.7 | Replace old login pages with new OTP login | Frontend | 1.6 |

### Phase 2: Flexible Circuits (Week 5-6)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 2.1 | Design and compile 8-slot circuit | Circuits | None |
| 2.2 | Run trusted setup for new circuit | Circuits | 2.1 |
| 2.3 | Deploy new verifier contract | Contracts | 2.2 |
| 2.4 | Build `SchemaService` and schema registry | Backend | 0.4 |
| 2.5 | Build `FlexibleProofService` for 8-slot proofs | Backend | 2.2 |
| 2.6 | Update batch upload to support schema selection | Backend | 2.4 |
| 2.7 | Update verification flow to use schema registry | Backend | 2.5 |
| 2.8 | Seed institution type schemas (university, bootcamp, NBA, etc.) | Backend | 2.4 |

### Phase 3: Fiat Payments (Week 7-8)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 3.1 | Integrate Flutterwave stablecoin API | Backend | 0.3 |
| 3.2 | Build `PaymentService` (initialize, verify, record) | Backend | 3.1 |
| 3.3 | Build payment routes (initialize, webhook, status) | Backend | 3.2 |
| 3.4 | Build credit purchase UI (packs, Flutterwave widget) | Frontend | 3.3 |
| 3.5 | Build payment status polling UI | Frontend | 3.3 |
| 3.6 | Integrate payments with earnings/revenue split | Backend | 3.2 |
| 3.7 | Build withdrawal UI for institution earnings | Frontend | 3.6 |

### Phase 4: Testing & Polish (Week 9-10)

| # | Task | Area | Dependencies |
|---|------|:----:|:-----------:|
| 4.1 | Backend test suite for OTP auth | Backend | 1.1 |
| 4.2 | Backend test suite for wallet creation | Backend | 1.2 |
| 4.3 | Backend test suite for flexible proofs | Backend | 2.5 |
| 4.4 | Backend test suite for payment flows | Backend | 3.2 |
| 4.5 | E2E test: user registers via OTP, buys credits, verifies credential | E2E | 4.1-4.4 |
| 4.6 | E2E test: institution registers, uploads batch with schema, employer verifies | E2E | 4.3 |
| 4.7 | Security audit: OTP, wallet encryption, webhook HMAC | Security | 4.1-4.4 |
| 4.8 | Legal review: DPA, privacy policy, NDPR/GDPR checklist | Legal | None |
| 4.9 | Merge `dev` → `main` after full QA pass | DevOps | 4.5-4.8 |

---

## 13. Open Questions

1. **Wallet master key**: Should we use AWS KMS / GCP Cloud KMS instead of
   an env var for `WALLET_MASTER_ENCRYPTION_KEY`? KMS is more secure but
   adds latency on every key derivation.

2. **Flutterwave vs Paystack as primary**: Flutterwave supports USDC
   settlement natively. Paystack does not but has better UX for Nigerian
   users (bank transfers, USSD). Should we support both?

3. **cNGN adoption**: Should we monitor cNGN as a future NGN-native
   stablecoin, or build USDC support first and migrate later?

4. **Circuit compilation**: The current circuit is `credential.circom` with
   fixed signals. Should the 8-slot circuit replace it entirely, or coexist
   as `flexible-credential.circom`? Coexistence means two verifier contracts,
   two verification keys, two trusted setups.

5. **Batching on Polygon vs Base**: Flutterwave settles USDC on Polygon.
   Our contracts are on Base. Should we:
   - (a) Accept Polygon USDC and bridge to Base (extra complexity)
   - (b) Accept fiat payments, record credits in DB, keep all on-chain ops on Base
   - (c) Deploy a separate set of contracts on Polygon

   Option (b) seems cleanest — fiat payment ↔ DB credits, blockchain ops
   stay on Base.

6. **Email provider**: Current setup uses SendGrid (from .env). Should we
   switch to AWS SES for cost at scale? SendGrid free tier: 100 emails/day.
   Paid: $19.95/mo for 50K emails. AWS SES: $0.10/1K emails.

7. **Employer wallet needed?**: Do employers need an ERC-4337 wallet?
   Currently, employers don't interact with the blockchain at all
   (verifyProof is a read-only staticcall). They only pay fiat. So no
   employer wallet is needed — only Institution wallets for batch uploads.

8. **Student revocation**: When a student's credential is revoked, the
   nullifier goes on-chain. Does the flexible circuit need any changes
   to the revocation flow? No — revocation uses the same nullifier set,
   just the credential commitment now references a schema.

---

## Appendix A: Claim Type Encoding

The 8-slot circuit uses a `claimType` signal to specify which fields are
being claimed. Encoding scheme:

```
claimType = uint256

Bits 0-7:   Number of fields in this claim (0-8)
Bits 8-15:  Reserved
Bits 16-23: Slot indices for claim (bitmap, 8 bits for 8 slots)
Bits 24+:   Threshold type (0 = exact match, 1 = greater than, 2 = less than)

Example:
  claimType = 0x00030201
  - 0x01 (bits 0-7): 1 field
  - 0x02 (bits 16-23): slot index 2
  - 0x03 (bits 24+): threshold type = greater than

  Means: "I claim slot 2 has value >= threshold"
```

The verifier (off-chain or on-chain) uses this encoding to validate the
claim against the revealed field values. The circuit itself just exposes
`claimType` as a public signal — the semantic interpretation happens in
the backend/verifier.

Actual claim type values for each institution type are stored in the
`claimTypes` JSON field of `CredentialSchema`:

```json
{
  "claimTypes": [
    {
      "code": 16908544,
      "label": "Graduated with First Class",
      "description": "Student graduated with a First Class Honours",
      "fields": [2],
      "thresholdType": 1,
      "thresholdValue": "First Class"
    },
    {
      "code": 16908545,
      "label": "Graduated in Computer Science",
      "description": "Student graduated in Computer Science",
      "fields": [1],
      "thresholdType": 0,
      "thresholdValue": "Computer Science"
    }
  ]
}
```
