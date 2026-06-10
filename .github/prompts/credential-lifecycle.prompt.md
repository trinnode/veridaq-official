---
mode: agent
description: Trace the full credential lifecycle from upload to verification
---

# Full credential lifecycle

Use this prompt when you need to understand or debug the entire flow from
institution batch upload through to employer verification.

## Phase 1: Institution uploads a batch

1. Institution logs into the portal at `/institution/login`
2. Goes to Batches, clicks Upload, selects an XLSX file
3. Frontend calls `POST /api/institution/batch/upload` with multipart/form-data
4. Backend route `packages/backend/src/routes/institution.ts` receives the file
5. Route creates a `Batch` record in the database with status `PENDING`
6. Route adds a job to the BullMQ batch queue (`packages/backend/src/workers/batch.queue.ts`)
7. The BullMQ worker `packages/backend/src/workers/batch.processor.ts` picks up the job
8. Worker reads each row from the XLSX (matricNumber, secret, nullifierSeed, programme, cgpa, etc.)
9. For each row, worker computes:
   - commitment = Poseidon(secret, nullifierSeed)
   - nullifier = Poseidon(nullifierSeed, institutionId)
10. Worker encrypts the plaintext row with AES-256-GCM (see `src/utils/crypto.ts`)
11. Worker calls `BlockchainService.registerBatch()` which writes commitments and nullifiers on-chain
12. Worker creates `Credential` records in the database with the encrypted plaintext
13. Worker sends a credential-issued email to each student via `EmailService`
14. Batch status is updated to `COMPLETED`

## Phase 2: Employer requests verification

1. Employer logs into the portal at `/employer/login`
2. Goes to Verify
3. Selects institution, enters matriculation number, selects claim type
4. Frontend calls `POST /api/verify/request`
5. Backend route `packages/backend/src/routes/verification.ts` receives request
6. Route creates a `VerificationRequest` record with status `PENDING`
7. `VerificationService.process()` is called:
   a. Finds the matching `Credential` record by (institutionId + matricNumber)
   b. If not found: returns NOT_VERIFIED
   c. Decrypts the credential plaintext using `crypto.ts`
   d. Calls `BlockchainService.isRevoked()` — if revoked: returns NOT_VERIFIED
   e. Status → PROOF_GENERATING
   f. Calls `ProofService.generate()` with the private inputs
   g. ProofService calls SnarkJS fullProve with the circuit WASM and zkey
   h. Clears private inputs from memory immediately after proof generation
   i. Status → PROOF_READY
   j. Calls `BlockchainService.verifyProof()` with the proof and public signals
   k. Status → VERIFIED or NOT_VERIFIED
8. Frontend polls `GET /api/verify/request/:id` every 2 seconds until terminal status
9. Result is shown to the employer

## Key files to look at when debugging

| File                                            | What it does                                    |
| ----------------------------------------------- | ----------------------------------------------- |
| `src/services/verification.service.ts`          | Main orchestration logic for phase 2            |
| `src/services/proof.service.ts`                 | SnarkJS wrapper — generates and verifies proofs |
| `src/services/blockchain.service.ts`            | All on-chain reads and writes via viem          |
| `src/workers/batch.processor.ts`                | Processes uploaded XLSX files                   |
| `packages/circuits/credential.circom`           | The ZKP circuit                                 |
| `packages/contracts/src/CredentialRegistry.sol` | Stores commitments on-chain                     |

## Common failure points

- Proof generation fails with "CIRCUIT_WASM_PATH is not set" — circuit setup
  was not run. See GUIDE.md Step 7.
- `BlockchainService.verifyProof` returns false on valid credentials — the
  deployed Groth16Verifier is out of sync with the current circuit. Re-run
  `pnpm circuit:setup` and redeploy the verifier.
- Batch processing fails silently — check `docker compose logs` for the Redis
  connection. BullMQ needs Redis to be running.
