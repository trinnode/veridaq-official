# VERIDAQ — Trust Model

What each party can and cannot do, and what happens when one of them is wrong.

---

## 1. Parties

| Party | Trusted for | Not trusted for |
| --- | --- | --- |
| Institution | Truth of its own student records | Other institutions' records, platform balances |
| Employer | Paying for the checks it requests | Seeing student data, choosing the answer |
| Platform admin | Onboarding, operational recovery | Forging proofs, editing ledger history |
| Backend operator | Availability, correct code | Reading plaintext stored on chain — there is none |
| Base Sepolia | Proof verification, registries | Privacy of commitments (they are public) |
| FX / ETH price providers | A reference number | Any stored amount |

---

## 2. What is public

- Poseidon commitment per credential.
- Nullifier per credential.
- Batch registration transactions.
- Revocation nullifiers.
- For each verification: claim type, threshold, result, transaction hash.

Given a commitment and a candidate record, anyone can test the candidate. That
is the point of a commitment, and it is why the blinding factor and the
institution key exist: without them, a small CGPA/classification space would be
trivially enumerable.

---

## 3. What is private

- Student name, matriculation number, CGPA, classification, graduation year.
- The institution signing key, encrypted with AES-256-GCM under a key derived
  from the backend secret.
- The blinding factor.
- The proof witness — only the proof itself is transmitted.

The database holds ciphertext, not plaintext. Decryption happens in the proof
path, in memory, for the duration of proof generation.

---

## 4. The institution key

`nullifier = Poseidon(matricHash, institutionKey)`.

Consequences:

1. The institution cannot be impersonated without the key.
2. Rotating the key invalidates every credential already issued, because the
   stored nullifier no longer corresponds to the pair. This is why the seed
   script must never regenerate it on a re-run, and why the key is encrypted
   rather than regenerated on approval.
3. A credential belongs to exactly one institution.

---

## 5. Platform admin

An admin can:

- approve or reject KYC, and correct a wallet before registration;
- retry a failed chain registration (without changing KYC);
- change tiers, fund paymaster balances, deactivate accounts;
- read audit logs.

An admin cannot:

- produce a valid proof for a claim the data does not support — that would
  require the circuit to be broken;
- alter a credential's commitment or nullifier without detection, because those
  are on chain;
- change a stored balance without a ledger row, because balances are derived
  from transactions and every mutation is recorded.

Every privileged action writes an `AuditLog` entry with the actor ID.

---

## 6. Money custody

The platform holds institution earnings and the gas pool. That is a custodial
arrangement and is stated as such here rather than implied.

- Balances are USD. ETH settlement uses a live quote, recorded per withdrawal.
- Withdrawal reservations are atomic; only a failed send releases them.
- Payout wallets are controlled by the platform, not by the institution, for
  the crypto path. Institutions that want self-custody should be paid to their
  own address, which is supported by the destination wallet field.

This is the weakest link in the system from a regulatory standpoint: holding
customer funds requires licensing and segregation of accounts that this codebase
does not implement. It is a deployment concern, not a code one, and it is
recorded as such.

---

## 7. Trust boundaries in code

```
browser ──(cookie JWT)──► API ──(Prisma)──► Postgres
                            │
                            ├──(ioredis)──► Redis
                            └──(viem)────► Base Sepolia
```

Every arrow is a boundary:

- **Browser → API**: every body is parsed with Zod; authorisation is checked per
  route; the portal role is checked in the UI *and* in the API.
- **API → Postgres**: queries are parameterised by Prisma. The only raw query
  surface is Prisma's typed API.
- **API → Redis**: session material, counters and cache. A Redis outage degrades
  login limiting and FX caching, and is reported by the health endpoint rather
  than being treated as healthy.
- **API → chain**: read calls are idempotent; write calls are the only place a
  private key is used, and only through `blockchain.service.ts`.

---

## 8. Threat table

| Threat | Mitigated by | Residual |
| --- | --- | --- |
| Forged credential | Poseidon commitment + Groth16 proof | Circuit bug would break everything; hence the test suite and review |
| Fabricated institution | KYC approval before registration | A compromised admin can approve; audit log records it |
| Employer reading student data | Only the result is returned; the proof reveals nothing else | None in the API path |
| Double spending a credit | Guarded `updateMany` | None |
| Double withdrawal | Reserve-before-send + refund only on send failure | A crash between send and ledger write needs manual reconciliation by tx hash |
| Replaying the same check | 60-second dedupe | Outside the window a new charge is allowed, by design |
| Brute-forcing a password | Per-IP and per-account limits, bcrypt cost 12 | Distributed attack across many IPs against many accounts is only slowed |
| Spoofing an FX rate | Median of several providers, cached, flagged stale | A provider returning a plausible wrong number can shift the median |
| Programme mismatch on manual review | Hash comparison before spending, verdict shown to the reviewer | Reviewer can still approve against the verdict |
| Leaked backend secret | Secret lives only in environment/config | Rotation invalidates sessions and decrypts nothing it should not — plan rotation deliberately |

---

## 9. What the system does not claim

- It does not make the institution honest. It makes an institution's claim
  attributable and non-repudiable.
- It does not hide that a verification happened. Timing, claim type and result
  are visible on chain.
- It does not protect a compromised endpoint. If the backend host is taken over,
  the attacker has the decryption key and the payout key.
- It is not a qualified trust service. The PDF is evidence of a platform record,
  not a legal instrument.
