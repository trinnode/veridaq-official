/**
 * Programme-name binding.
 *
 * A credential stores only `courseHash = keccak(courseName) mod p`. When an
 * employer claims Programme Completion they type a programme name; without
 * comparing it to that hash, the institution is asked to approve an arbitrary
 * string. The comparison is exact and costs nothing, so there is no reason to
 * rely on a human noticing a mismatch.
 *
 * Issuance normalises with `trim().toLowerCase()`. The variants below also
 * collapse internal whitespace, so a double space does not create a false
 * mismatch. The stored hash is written as a decimal string, but a 0x-prefixed
 * value is accepted too so this stays correct if the encoding ever changes.
 */

import { hashToField } from "./field.js"

export function courseHashCandidates(courseName: string): string[] {
  const trimmed = courseName.trim().toLowerCase()
  const collapsed = trimmed.replace(/\s+/g, " ")
  return [...new Set([trimmed, collapsed])]
}

function parseStoredHash(value: string): bigint | null {
  const raw = value.trim()
  if (!raw) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

export function programmeMatchesRecord(courseName: string, courseHash: string): boolean {
  const target = parseStoredHash(courseHash)
  if (target === null || target === 0n) return false
  return courseHashCandidates(courseName).some(
    (candidate) => hashToField(candidate) === target
  )
}
