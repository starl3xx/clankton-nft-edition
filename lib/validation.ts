// lib/validation.ts
// Shared validation utilities for API endpoints

/**
 * Validates an Ethereum address format
 * Accepts both checksummed and lowercase addresses
 */
export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

/**
 * Normalizes an Ethereum address to lowercase for database storage
 * This ensures consistent lookups regardless of how the address is provided
 */
export function normalizeAddress(addr: string): string {
  return addr.toLowerCase()
}

/**
 * Valid discount action types
 */
export const VALID_ACTIONS = [
  "cast",
  "recast",
  "tweet",
  "follow_tpc",
  "follow_star",
  "follow_channel",
  "farcaster_pro",
  "early_fid",
] as const

export type DiscountAction = (typeof VALID_ACTIONS)[number]

/**
 * Validates that an action is a valid discount action type
 */
export function isValidAction(action: unknown): action is DiscountAction {
  return typeof action === "string" && VALID_ACTIONS.includes(action as DiscountAction)
}

/**
 * Validates a Farcaster ID (FID)
 * FIDs are positive integers
 */
export function isValidFid(fid: unknown): boolean {
  if (typeof fid === "number") {
    return Number.isInteger(fid) && fid > 0
  }
  if (typeof fid === "string") {
    const parsed = parseInt(fid, 10)
    return !isNaN(parsed) && parsed > 0 && parsed.toString() === fid
  }
  return false
}

/**
 * Parses and validates a FID from various input types
 * Returns null if invalid
 */
export function parseFid(fid: unknown): number | null {
  if (typeof fid === "number" && Number.isInteger(fid) && fid > 0) {
    return fid
  }
  if (typeof fid === "string") {
    const parsed = parseInt(fid, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}

/**
 * Validates request body contains required fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: unknown,
  fields: (keyof T)[]
): { valid: false; missing: string } | { valid: true; data: T } {
  if (!body || typeof body !== "object") {
    return { valid: false, missing: "body" }
  }

  const obj = body as Record<string, unknown>
  for (const field of fields) {
    if (!(field in obj) || obj[field as string] === undefined || obj[field as string] === null) {
      return { valid: false, missing: String(field) }
    }
  }

  return { valid: true, data: body as T }
}

/**
 * Sanitize a string input by trimming and limiting length
 */
export function sanitizeString(input: unknown, maxLength: number = 1000): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, maxLength)
}
