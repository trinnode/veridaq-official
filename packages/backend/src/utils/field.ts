import { randomBytes } from "crypto"
import { keccak256, toUtf8Bytes } from "ethers"

export const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n

export function hashToField(value: string): bigint {
  const hashHex = keccak256(toUtf8Bytes(value))
  return BigInt(hashHex) % FIELD_MODULUS
}

export function hexToField(hex: string): bigint {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex
  if (!normalized) return 0n
  return BigInt("0x" + normalized) % FIELD_MODULUS
}

export function randomFieldElement(byteLength = 16): bigint {
  const bytes = randomBytes(byteLength)
  return hexToField(bytes.toString("hex"))
}
