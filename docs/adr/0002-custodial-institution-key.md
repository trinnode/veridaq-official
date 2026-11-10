# ADR 0002 — The institution key is custodial and encrypted at rest

**Status:** accepted (November 2026)

## Context

The nullifier binds a credential to its institution:
`Poseidon(matricHash, institutionKey)`. That key has to be available at batch
time and at proof time. Requiring a registrar to hold it in a wallet makes batch
uploads and manual review dependent on a browser extension and a key the
institution may lose.

## Decision

The platform generates the key on approval and stores it AES-256-GCM encrypted
in the institution row, with the encryption key derived from the backend secret.
The account is created as an ERC-4337 simple account so its address is stable
and usable with the paymaster.

## Alternatives

- **Institution-held key.** Stronger custody, but every batch upload becomes a
  signing ceremony and a lost key permanently breaks that institution's
  credentials.
- **Per-batch key.** Reduces blast radius, but nullifiers become batch-scoped,
  which breaks the "same student, same institution" property.

## Consequences

- Compromise of the backend host compromises every institution key. This is
  stated in `TRUST-MODEL.md` rather than hidden.
- Rotating a key invalidates every issued credential's nullifier. The seed
  script is written to never regenerate keys on re-run for this reason.
- A future self-custody mode would need a migration path that re-issues
  nullifiers, not a key rotation in place.
