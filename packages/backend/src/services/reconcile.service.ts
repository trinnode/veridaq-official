/**
 * Free-verification reconciliation.
 *
 * `SubscriptionManager` is the source of truth for the three free employer
 * checks. The database column is a mirror used to render balances and to avoid
 * an RPC call on every page. Any interrupted request can make the two drift, so
 * the mirror is re-read from the chain on a schedule and on demand.
 *
 * The sync is one-directional: chain → database. A number in the database can
 * never grant a check the contract would refuse.
 */

import type { PrismaClient } from "@prisma/client"
import pino from "pino"
import type { Address } from "viem"
import { BlockchainService } from "./blockchain.service.js"

const log = pino({ name: "reconcile-service" })

export class ReconcileService {
  constructor(
    private prisma: PrismaClient,
    private blockchainSvc: BlockchainService = new BlockchainService()
  ) {}

  async syncEmployer(employerId: string) {
    const employer = await this.prisma.employer.findUnique({
      where: { id: employerId },
      select: { id: true, name: true, walletAddress: true, freeVerificationsRemaining: true },
    })

    if (!employer) return { ok: false as const, error: "NOT_FOUND" as const }
    if (!employer.walletAddress) return { ok: false as const, error: "NO_WALLET" as const }

    const onChain = await this.blockchainSvc.getRemainingFreeVerifications(
      employer.walletAddress as Address
    )

    const updated = onChain !== employer.freeVerificationsRemaining
    if (updated) {
      await this.prisma.employer.update({
        where: { id: employer.id },
        data: { freeVerificationsRemaining: onChain },
      })
    }

    return {
      ok: true as const,
      employerId: employer.id,
      onChain,
      database: employer.freeVerificationsRemaining,
      updated,
    }
  }

  async syncAll(limit = 500) {
    const employers = await this.prisma.employer.findMany({
      where: { active: true, walletAddress: { not: "" } },
      select: { id: true },
      take: limit,
    })

    let checked = 0
    let updated = 0
    let failed = 0

    for (const employer of employers) {
      try {
        const result = await this.syncEmployer(employer.id)
        checked++
        if (result.ok && result.updated) updated++
      } catch (err) {
        failed++
        log.warn({ err, employerId: employer.id }, "free-verification sync failed for employer")
      }
    }

    return { checked, updated, failed }
  }
}
