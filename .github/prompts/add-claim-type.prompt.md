---
mode: agent
description: Add a new claim type to the VERIDAQ system
---

# Add a new claim type

A claim type is an academic assertion an employer can verify (e.g. "Minimum
CGPA 4.0", "First Class Honours"). Adding one requires changes in three places.

## What to do

### 1. Add the claim constant to the circuit

File: `packages/circuits/credential.circom`

In the comment block that lists claim type constants, add:

```
// Claim type N — <description>
```

If the circuit logic needs to change for the new claim, modify the multiplexer
section. After any circuit change, re-run `pnpm circuit:setup` and redeploy
the Groth16Verifier contract.

### 2. Insert the claim definition in the database seed

File: `packages/backend/prisma/seed.ts`

Add an entry to the `claimDefinitions` array:

```typescript
{
  name:        "Claim Name",
  description: "Plain description of what this claim asserts.",
  claimType:   N,  // must match the constant in the circuit
  active:      true,
}
```

Run `pnpm db:seed` to insert it.

### 3. Update the employer verify form

File: `packages/frontend/components/employer/verify-button.tsx`

The claims are fetched dynamically from the API, so no code change is needed
here unless you want to add client-side validation specific to the new type.

## Validation

After adding the claim:

1. `pnpm db:studio` — confirm the ClaimDefinition row exists
2. Log in as the employer, go to Verify, confirm the new claim appears in the
   dropdown
3. Submit a verification request for the new claim and confirm it reaches
   PROOF_GENERATING state
