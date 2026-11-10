# VERIDAQ — Flows

The sequences below are the ones a change is most likely to break. Each ends
with the failure behaviour, because that is where the money and trust are.

---

## 1. Institution onboarding

```
registrar registers
  → Institution row created, kycApproved = false, blockchainStatus = "NOT_STARTED"
  → verification email sent
  → registrar verifies address
admin opens Institutions
  → sees KYC pending
  → (optional) corrects the admin wallet
  → approves
      → kycApproved = true
      → blockchainStatus = "PENDING"
      → registerInstitution(onChainId, name, adminWallet, publicKey)
      → tier aligned with the subscription contract
      → blockchainStatus = "REGISTERED"
```

If the chain call fails, KYC stays approved and `blockchainStatus` becomes
`FAILED`. The admin sees a Re-register action which calls
`POST /api/admin/institutions/:id/retry-registration`. That endpoint re-runs
only the chain half; it cannot change KYC state, so a retry cannot approve an
account by accident.

---

## 2. Batch upload

```
registrar selects XLSX
  → POST /api/institution/batch/upload (multipart)
  → row validation (matric, name, CGPA 0–500, classification 0–4, course, year)
  → Batch row created, status = "PENDING"
  → BullMQ job enqueued
worker:
  → for each row: encrypt payload (AES-256-GCM)
  → commitment  = Poseidon(nameHash, matricHash, cgpa, classification,
                           courseHash, graduationYear, blindingFactor)
  → nullifier   = Poseidon(matricHash, institutionKey)
  → Credential rows written, status = "ACTIVE"
  → CredentialRegistry.registerBatch(commitments, nullifiers)
  → Batch status = "CONFIRMED", tx hash stored
```

A row that fails validation is reported with its spreadsheet line number; the
batch is not silently truncated. A chain failure leaves the batch `FAILED` with
the credentials present locally, so the batch can be submitted again without
re-uploading.

---

## 3. Employer verification — automatic claim

```
employer picks institution, matric, claim, threshold
  → POST /api/verify/request
  → institution must exist and have kycApproved = true
  → 60-second dedupe: identical employer + institution + matric + claim +
    threshold + programme returns the existing request, no second charge
  → claim 6: courseHash(courseName) must equal the credential's courseHash
  → credential located by decrypting candidates and matching matricHash
  → credit spent (guarded update; free first, then paid)
  → VerificationRequest status = "PROCESSING"
  → 202 { requestId }
  → background: decrypt, fullProve, verifyProof on chain
  → status = "COMPLETED", result = VERIFIED | CLAIM_NOT_SATISFIED
  → earnings credited (70/20/10) for a paid check
client:
  → polls GET /api/verify/request/:id every 2 s
  → renders result and offers the PDF report
```

If proof generation throws, the request is marked `FAILED` and the error is
logged with the request ID. The exception is a proof that verifies as false,
which is a legitimate `CLAIM_NOT_SATISFIED`, not an error.

---

## 4. Employer verification — manual claim (Programme Completion)

```
employer submits claim 6 with a programme name
  → pre-check: the employer must have a unit available (database mirror first,
    the chain only before a refusal). Manual claims are charged at review, and
    without this a zero-balance account could queue unlimited work
      → nothing available: 402, no request created
  → programme name hashed and compared with the credential
      → mismatch: 400 PROGRAMME_MISMATCH, nothing spent, nothing created
  → request created, status = "AWAITING_INSTITUTION"
  → institution sees the request, with:
      • employer name and email
      • matriculation number
      • the programme the employer typed
      • whether it matches the credential's recorded programme
      • batch reference
  → approve
      → charge the employer (free check first, then a paid credit)
          → nothing to charge: 400 telling the registrar the request stays
            pending until the employer tops up; nothing is charged
      → proof generated with skipEarningsCredit (earnings credited here)
      → status = "COMPLETED"
  → decline with a reason
      → charge the employer; if the charge succeeds, credit earnings
          → charge fails: the decline still completes, but no earnings are
            credited, because no money moved
      → status = "COMPLETED", result = "RECORD_NOT_FOUND"
      → reason stored in institutionNote and shown to the employer
```

The match verdict is advisory: the reviewer can still approve a mismatch, but
they cannot do so without seeing it.

The charge happens at review, not at submission, so an employer is not billed
for a review that never happens. The cost of that choice is the pre-check at
submission and the "cannot charge" branch at approval; both are explicit above
rather than left to chance.

---

## 5. Free checks and reconciliation

```
employer makes a check
  → backend asks SubscriptionManager for the remaining count
  → if > 0: consume on chain; database mirror follows
  → if 0: spend a database free check, then a paid credit
```

`SubscriptionManager` is authoritative. Every `FREE_VERIFICATION_SYNC_MINUTES`
(default 360, `0` disables) the API reads each active employer's on-chain count
and writes it into the database mirror. Only differences are written. Admins can
run the same sync for one employer
(`POST /api/admin/employers/:id/sync-free`) or all of them
(`POST /api/admin/employers/sync-free`).

The sync only ever copies chain → database. A stale database value therefore
cannot grant a free check that the contract would refuse.

---

## 6. Withdrawal

```
institution requests $X
  → $X ≥ 10
  → CRYPTO:
      → ETH/USD quote (live, cached, fallback recorded)
      → reserve $X with a guarded update (availableUsd ≥ X)
          → fails: "insufficient balance", nothing sent
      → send ETH
          → throws: release the reservation, rethrow
          → succeeds: write EarningTransaction with tx hash, rate, source
              → write fails: log loudly with the hash, do NOT refund
  → FIAT:
      → reservation and ledger row inside one Prisma transaction
      → status PENDING for manual settlement
```

The rule is simple and is enforced in code: money is refunded only when it never
left the wallet.

---

## 7. Login

```
POST /api/auth/<portal>/login
  → per-IP limit: 10 attempts / 15 min (shared NAT stays usable)
  → per-account counter in Redis: 10 failures / 15 min
      → at or above: 429 with a plain "try again in 15 minutes"
  → password checked with bcrypt cost 12
  → on success: counter cleared, access + refresh cookies set
  → token also returned in the body for the SPA's in-memory copy
```

The per-account counter is what stops a distributed spray against one known
address; the IP limit alone would not.

---

## 8. Currency display

```
app mounts
  → GET /api/fx/rate
      → median of every keyless provider that answers
      → cached in Redis for FX_REFRESH_MINUTES (30)
      → stale flag + fetchedAt returned
  → user sees Naira by default, can switch to USD
  → header shows the rate and its freshness; a stale rate is marked
backend:
  → all amounts remain USD, always
```

If every provider fails and no cache exists, a configured constant is used and
flagged stale. The interface says the rate is stale rather than silently showing
a number that may be wrong.
