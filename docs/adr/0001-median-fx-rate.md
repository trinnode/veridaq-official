# ADR 0001 — Display FX rate is a median across keyless providers

**Status:** accepted (November 2026)

## Context

Prices are set and charged in USD. Nigerian users need a Naira figure. A single
free FX API is a single point of failure, and a paid provider adds a credential
and a billing relationship for a number that is only ever shown, never used to
charge anyone.

## Decision

Query several keyless public providers, take the median of the answers that
return a plausible rate, cache the result in Redis for 30 minutes, and expose
the rate, its timestamp and a `stale` flag. If everything fails, reuse the last
cached value; if there is no cache, use `FX_FALLBACK_USD_NGN` and mark it stale.

## Alternatives

- **One provider.** Simplest, but one bad response or one outage shows a wrong
  price with no way to notice.
- **Paid provider.** Better SLA, but a credential and a subscription for a
  display-only value.
- **Fixed rate.** No network dependency, but wrong within a week.

## Consequences

- A provider returning a plausible but wrong number can shift the median; the
  freshness flag and a visible rate limit the damage.
- The UI must handle `stale` honestly, which it does in the header toggle.
- No stored amount is ever denominated in Naira, so a bad rate can never affect
  a balance or a payout.
