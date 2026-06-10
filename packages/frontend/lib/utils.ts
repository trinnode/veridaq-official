/**
 * Utility functions used across the frontend.
 * cn() merges Tailwind class names safely, preventing duplicates.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a date string to a readable local date. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-NG", {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  })
}

/** Format a date string to include time. */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-NG", {
    year:   "numeric",
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

/** Shorten a blockchain address or tx hash for display. */
export function truncateHash(hash: string, chars = 6): string {
  if (!hash) return ""
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`
}

/** Open BaseScan for a transaction hash. */
export function explorerUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`
}

/** Sleep for a given number of milliseconds. Useful for polling loops. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
