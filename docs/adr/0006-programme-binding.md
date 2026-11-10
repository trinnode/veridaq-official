# ADR 0006 — Programme Completion is bound to the recorded course hash

**Status:** accepted (November 2026)

## Context

Claim 6 ("Programme Completion") is a manual review: the employer types a
programme name and the institution confirms it. The credential already stores
`courseHash = keccak(courseName.trim().toLowerCase()) mod p`, but nothing
compared the typed name to it. An employer could type anything and ask a
registrar to confirm it, and a busy reviewer might.

## Decision

Before a credit is spent, hash the typed programme the same way issuance did and
compare it to the stored `courseHash`. On mismatch return `PROGRAMME_MISMATCH`
(HTTP 400), spend nothing, create nothing.

The review sheet still computes and displays the verdict, so the reviewer is not
expected to trust the employer silently. The reviewer may still choose to
approve a mismatch; the system does not pretend to remove human judgement, only
to inform it.

Whitespace is normalised (trim, lower, collapse internal runs) so that a double
space does not create a false mismatch. A stored `courseHash` of `0` means the
credential predates programme capture and is rejected with
`PROGRAMME_NOT_RECORDED`.

## Alternatives

- **Let the institution decide with no assistance.** That is what the system did
  before; it is a manual review with no evidence on screen.
- **Reject any mismatch at the database layer.** Overreaches: a legitimate
  correction to a programme name would require a migration.
- **Add a column for the typed programme and compare later.** A schema migration
  for something that can be computed on read.

## Consequences

- A typo in a programme name now fails fast, before money moves, with a message
  that tells the employer to copy the name exactly as recorded.
- Credentials issued before programme capture cannot be used with claim 6 until
  the programme is recorded; this is visible in the UI as "not recorded".
- Tests in `programme-binding.test.ts` cover exact, case-insensitive,
  whitespace-collapsed and mismatched cases.
