# ADR 0004 — Local development uses offset ports

**Status:** accepted (November 2026)

## Context

The repository is developed alongside several other Node projects on the same
machine. The default ports (3000, 4000, 5432, 6379) collide constantly, and a
collision looks like an application bug — a stale server on 4000 answers with
the wrong API, or a leftover Postgres on 5432 serves the wrong schema.

## Decision

The local stack uses offset ports:

| Service | Port |
| --- | --- |
| Next.js | 3000 |
| Fastify | 4100 |
| Postgres | 5433 |
| Redis | 6380 |

Test containers are named `veridaq-test-pg` and `veridaq-test-redis`.
Commands in the docs use these ports explicitly rather than relying on `.env`,
because `.env` is often the thing that is wrong.

## Alternatives

- **Default ports.** Zero configuration, constant collisions.
- **Random ports per run.** No collisions, but every command and every
  documented URL changes, which makes debugging harder than the collision it
  avoids.

## Consequences

- `docker-compose.yml` publishes 5433/6380.
- `DATABASE_URL` and `REDIS_URL` in local `.env` must match; a mismatch produces
  a connection error rather than silently using another database.
- CI can use the defaults without caring, since it does not share a host.
