/**
 * Verification-credit spending.
 *
 * Every spend is a guarded update: `updateMany` with a `> 0` predicate is
 * atomic, so two concurrent verification requests cannot both consume the same
 * credit. The previous read-then-write pattern let two requests pass the
 * `> 0` check and then both decrement, serving two checks for one credit.
 */

import type { PrismaClient } from "@prisma/client"

export async function spendPaidCredit(
  prisma: PrismaClient,
  employerId: string
): Promise<boolean> {
  const result = await prisma.employer.updateMany({
    where: { id: employerId, verificationCredits: { gt: 0 } },
    data: { verificationCredits: { decrement: 1 } },
  })
  return result.count === 1
}

export async function spendFreeVerification(
  prisma: PrismaClient,
  employerId: string
): Promise<boolean> {
  const result = await prisma.employer.updateMany({
    where: { id: employerId, freeVerificationsRemaining: { gt: 0 } },
    data: { freeVerificationsRemaining: { decrement: 1 } },
  })
  return result.count === 1
}

/** Put a paid credit back when a downstream step fails before any work is done. */
export async function refundPaidCredit(
  prisma: PrismaClient,
  employerId: string
): Promise<void> {
  await prisma.employer.update({
    where: { id: employerId },
    data: { verificationCredits: { increment: 1 } },
  })
}

/**
 * Whether an employer has anything left to spend, without spending it.
 *
 * Manual (claim 6) requests are charged when the institution reviews them, not
 * when they are submitted — the employer should not pay for a review that may
 * never happen. That leaves a gap: an employer with no balance at all could
 * queue an unlimited number of requests for a registrar to work through. This
 * check closes it, and still refuses nothing that the charge would have
 * allowed.
 *
 * The database mirror answers the common case for free. It is only consulted
 * for a rejection, so a stale mirror can never block someone whose on-chain
 * count is healthy.
 */
export async function hasVerificationUnitAvailable(
  prisma: PrismaClient,
  employerId: string
): Promise<boolean> {
  const employer = await prisma.employer.findUnique({
    where: { id: employerId },
    select: { freeVerificationsRemaining: true, verificationCredits: true },
  })
  if (!employer) return false
  return employer.freeVerificationsRemaining > 0 || employer.verificationCredits > 0
}
