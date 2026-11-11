# VERIDAQ — hardening and polish workplan

Tracked in git (unlike `docs/plans/`, which is ignored). One line per item,
status-marked, with the evidence recorded beside it once it is proven.

Legend: `[x]` done and verified · `[~]` implemented, verification incomplete ·
`[ ]` not started · `[!]` blocked on something external · `[-]` deliberately
deferred

Local stack for every test below: Postgres 5433, Redis 6380, Next 3000, Base
Sepolia 84532. The Fastify port was 4100 during these runs because 4000 was
occupied at the time; it is 4000 by default. No deployment is involved.

Verification limits for this pass: no browser automation is available, so UI
items are verified at compile and code level only and are marked `[~]` rather
than claimed as visually confirmed. Everything else below was exercised over
HTTP against the running backend, against the database, or by a test.

Final suite state: `pnpm typecheck` clean, `pnpm lint` 0 errors (192
pre-existing warnings), `pnpm test:backend` 11 files / 106 tests passing.

---

## P0 — correctness and money

- [x] P0.1 Withdrawal double-spend: reserve the balance atomically before
      sending (`earnings.service.ts`); reverse the reservation if the send
      fails, never after a successful send.
      *Evidence:* `earnings.test.ts` → "pays out once when two withdrawals race
      for the same balance" (real parallel promises, real database).
- [x] P0.2 Stop pricing payouts with a hardcoded `1669.3`: live ETH/USD with a
      config fallback, rate recorded in the transaction metadata.
      *Evidence:* `eth-price.service.ts`; `programme-binding.test.ts` exercises
      the unreachable-provider path and the fallback is logged and recorded.
- [x] P0.3 Credit double-spend: guarded `updateMany` with
      `verificationCredits > 0` in every spend site; refund only on downstream
      failure.
      *Evidence:* `credit.service.ts`; `credit-race.test.ts` spends the last
      credit and the last free check concurrently.
- [x] P0.4 Bind a Programme Completion request to the credential: compare
      `hashToField(courseName.trim().toLowerCase())` with the stored
      `courseHash`; reject `PROGRAMME_MISMATCH` before spending; show the match
      verdict on the institution review sheet.
      *Evidence (HTTP, seeded credential):* wrong programme → `400` and credits
      unchanged at 46; `"  computer   science  "` → `202 AWAITING_INSTITUTION`;
      no programme → `400 Programme name is required`. The recorded programme
      was confirmed as `Computer Science` by decrypting the seeded credential
      and matching `courseHash`. *Evidence (test):* `programme-binding.test.ts`.
- [x] P0.5 Manual review paid the institution when the employer could not be
      charged: a decline credited earnings regardless of whether any credit was
      spent, and a missing wallet skipped the charge entirely.
      *Evidence:* `institution.test.ts` → "does not credit the institution when
      the employer cannot be charged" and "charges exactly one credit and
      credits earnings once". The first fails against the previous code.

## P1 — handling and robustness

- [x] P1.1 Role-aware portal guards: all three layouts check `user.role` and
      redirect a wrong-role session to its own dashboard; no redirect during
      render.
      *Evidence:* `lib/roles.ts`, the three `layout.tsx` files; typecheck.
- [x] P1.2 Verification idempotency: an identical request inside 60 seconds
      returns the existing request with `deduplicated: true` instead of
      charging again. `FAILED` is excluded so a real retry works.
      *Evidence:* `verification.test.ts` → "returns the same request when the
      same check is submitted twice".
- [x] P1.3 Free-verification reconciliation: chain → database only, in-process
      timer plus admin endpoints.
      *Evidence:* `reconcile.service.ts`; HTTP
      `POST /api/admin/employers/sync-free` → `{checked: 2, updated: 0,
      failed: 0}`.
- [x] P1.4 Login limiting: 10 attempts / 15 min per IP plus 10 failures / 15 min
      per account, cleared on success.
      *Evidence (HTTP):* 10 × `401` then `429 Rate limit exceeded`; a Redis
      counter seeded at 10 returns `429 Too many failed sign-in attempts for
      this account`.
- [x] P1.5 FX freshness: rate and "as of" time in the header toggle, with a
      stale marker.
      *Evidence:* `/api/fx/rate` → `rate 1348.8850952712, stale false, agreement
      4, fetchedAt …`; `/health` reports `fx fresh, ageMinutes 0,
      refreshMinutes 30`.
- [x] P1.6 Chain registration retry: admin action for
      `blockchainStatus = FAILED` that re-runs registration without touching KYC.
      *Evidence:* `registerOnChain` / `retryInstitutionRegistration` in
      `admin.service.ts`; the UI button now calls the retry route rather than
      reopening the approval modal.
- [x] P1.7 A zero-balance employer could queue unlimited manual requests,
      because manual claims are charged at review rather than at submission.
      *Evidence (HTTP):* balance zeroed → `402` with the request refused and no
      row created; balance restored → `46`.

## P2 — UI

- [x] P2.1 Error states (not empty tables) on admin institutions, employer
      history and institution batches: unauthorised, failed and empty are
      distinguished.
      *Evidence:* `components/ui/load-failure.tsx`, wired into all three pages;
      typecheck and lint.
- [x] P2.2 Decline with a reason, surfaced to the employer.
      *Evidence:* the reason is written to `institutionNote` (shown) rather than
      `adminNote` (internal); rendered in the employer history table and in the
      immediate verify result.
- [x] P2.3 Review sheet completeness: recorded programme and match verdict,
      employer name, batch reference.
      *Evidence:* `GET /api/institution/verifications/:id` returns
      `programmeMatches` and `batchId`; the sheet fetches the detail on
      selection instead of trusting the list row.
- [~] P2.4 Mobile pass at 390 px on employer verify and institution tables.
      Scroll containers and column hiding are in place; no visual confirmation
      is possible without a browser.
- [~] P2.5 Accessibility sweep of the three logins and dashboards.
      Labels are bound with `htmlFor`/`id`, the password reveal has
      `aria-label` + `aria-pressed`, toasts carry `role`/`aria-live`, the
      dismiss control is labelled, the failure state is a labelled `alert`.
      Not screen-reader tested.
- [~] P2.6 Currency toggle at 360 px, selected state announced, no wrap.
      The toggle is no longer `hidden sm:flex`; it is `shrink-0` and shows rate
      plus freshness. Not visually confirmed.
- [x] P2.7 PDF report states its currency explicitly.
      *Evidence:* footer note in `report.service.ts` — fees are denominated and
      settled in USD, Naira is an indicative conversion.

## P2 — documentation

- [x] P2.8 `docs/ARCHITECTURE.md` (tracked).
- [x] P2.9 `docs/FLOWS.md` (tracked).
- [x] P2.10 `docs/TRUST-MODEL.md` (tracked).
- [x] P2.11 ADRs under `docs/adr/`: median FX, custodial institution key,
      70/20/10 split, local dev ports, reserve-before-send, programme binding.
- [x] P2.12 README and GUIDE: Naira/FX, local ports, claim-6 rules, seed
      invariance, corrected 70/20/10 split, reconciliation and ETH-price
      variables.
- [x] P2.13 SECURITY.md: findings 8.1–8.7 including the race and
      programme-binding ones, with the open items stated.

## P3 — operations

- [x] P3.1 Health endpoint reports database, Redis, chain RPC and FX freshness;
      `200` when healthy, `503` when degraded.
      *Evidence (HTTP):* `200` with database ok, Redis ok, chain block
      57111497, FX fresh at 1348.885…; the chain probe retries once so the first
      call after a restart no longer reports a cold-connection failure.
- [!] P3.2 Reown allowlist for localhost and production — blocked, the current
      project id is rejected on localhost.
- [!] P3.3 Multisig for `PLATFORM_ADMIN_ROLE` — needs a deployment to exist.
- [-] P3.4 Fly deploy — out of scope for this pass by instruction.
- [-] P3.5 Vercel deploy — blocked until 3 December by the account suspension.
