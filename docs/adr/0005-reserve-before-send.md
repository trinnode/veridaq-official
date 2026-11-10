# ADR 0005 — Money moves reserve-first, refund only on a failed send

**Status:** accepted (November 2026)

## Context

Withdrawals originally read the balance, sent the ETH, then wrote the debit.
Two concurrent requests both read the same balance, both passed the check, and
both paid out. The same read-then-write shape existed on verification credits.

## Decision

1. Reserve the balance with a conditional update:
   `updateMany({ where: { id, availableUsd: { gte: amount } } })`, then require
   `count === 1`. This is atomic under any concurrency the database allows.
2. Only after a successful reservation, send the money.
3. If the send throws, release the reservation.
4. If the send succeeds but the ledger write fails, do **not** refund. Log the
   transaction hash at error level and let an operator reconcile. A refund
   would pay the institution twice.

Credits use the same shape: `verificationCredits: { gt: 0 }` in the predicate,
`decrement` in the data, `count === 1` as the verdict.

## Alternatives

- **Serialisable transaction around the send.** Holds a database transaction
  open across a network call to the chain. A slow RPC blocks the whole table.
- **Advisory lock per institution.** Works, but adds a second protocol for
  something the row update already provides.
- **Read, check, write inside a transaction.** Still a lost update unless the
  isolation level is serialisable; the guarded update is cheaper and clearer.

## Consequences

- A crash between a successful send and the ledger write leaves a balance that
  is too high and a transaction that is recorded only on chain. The log line
  includes the hash, and reconciliation is manual. This is the deliberate trade:
  never double-pay, accept a manual fix for a rare failure.
- Tests in `earnings.test.ts` and `credit-race.test.ts` run real parallel
  promises against the real database, so a regression fails the suite rather
  than passing on a mock.
