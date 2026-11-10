# ADR 0003 — Verification revenue splits 70/20/10

**Status:** accepted (November 2026)

## Context

A paid verification costs $1.50. The institution does the work that makes the
credential valuable; the platform runs the network; gas has to be funded.

## Decision

Split each paid verification 70% to the institution, 20% to the platform, 10% to
the gas pool. Free checks are treated the same way for accounting purposes but
with the price set to zero, so the ledger shape does not change.

## Alternatives

- **Flat fee per batch.** Predictable for the institution, but decouples revenue
  from verification volume, which is the thing being paid for.
- **Institution-set price.** Better market fit eventually, but makes gas
  funding and platform revenue depend on each institution's choices.

## Consequences

- The split is a single constant in `verification.service.ts`/`earnings.service.ts`
  and must not be duplicated in the UI; the UI renders whatever the API returns.
- Changing the split is a product decision with an accounting migration, not a
  config toggle. There is no configuration for it on purpose.
