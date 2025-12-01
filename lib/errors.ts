// lib/errors.ts
// Centralized error handling utilities for frontend

/**
 * API error response format from our backend
 */
export type ApiErrorResponse = {
  error?: {
    code: string
    message: string
  }
}

/**
 * User-friendly error messages mapped from error codes
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Rate limiting errors
  DISCOUNT_RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  USER_DISCOUNTS_RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  MINT_SIG_RATE_LIMITED: "Too many mint attempts. Please wait a minute and try again.",
  FOLLOW_RATE_LIMITED: "Too many follow checks. Please wait a moment.",

  // Validation errors
  DISCOUNT_BAD_REQUEST: "Invalid request. Please refresh and try again.",
  DISCOUNT_INVALID_ADDRESS: "Invalid wallet address. Please reconnect your wallet.",
  DISCOUNT_INVALID_ACTION: "Invalid discount action.",
  USER_DISCOUNTS_MISSING_ADDRESS: "Wallet address required. Please connect your wallet.",
  USER_DISCOUNTS_INVALID_ADDRESS: "Invalid wallet address format.",
  MINT_SIG_MISSING_ADDRESS: "Wallet address required to mint.",
  MINT_SIG_INVALID_ADDRESS: "Invalid wallet address format.",
  FOLLOW_INVALID_FID: "Invalid Farcaster ID. Please refresh the app.",

  // Server errors
  DISCOUNT_INTERNAL_ERROR: "Server error. Please try again later.",
  MINT_SIG_INTERNAL_ERROR: "Could not prepare mint. Please try again.",
  MINT_SIG_CONFIG_ERROR: "Minting is temporarily unavailable. Please try again later.",
  FOLLOW_INTERNAL_ERROR: "Could not verify follows. Please try again.",

  // Network errors
  NETWORK_ERROR: "Network error. Please check your connection.",
  TIMEOUT_ERROR: "Request timed out. Please try again.",
}

/**
 * Parse an API error response and return a user-friendly message
 */
export function parseApiError(response: Response | null, body: unknown): string {
  // Try to extract error from response body
  if (body && typeof body === "object") {
    const errorBody = body as ApiErrorResponse

    // Check for our standard error format
    if (errorBody.error?.code) {
      const friendlyMessage = ERROR_MESSAGES[errorBody.error.code]
      if (friendlyMessage) {
        return friendlyMessage
      }
      // Fall back to the error message from API
      if (errorBody.error.message) {
        return errorBody.error.message
      }
    }

    // Legacy format support (message or error at top level)
    const legacyBody = body as { message?: string; error?: string }
    if (legacyBody.message) return legacyBody.message
    if (legacyBody.error) return legacyBody.error
  }

  // Map HTTP status codes to messages
  if (response) {
    switch (response.status) {
      case 400:
        return "Invalid request. Please try again."
      case 401:
        return "Authentication required. Please reconnect your wallet."
      case 403:
        return "Access denied. Please refresh and try again."
      case 404:
        return "Not found. Please refresh the page."
      case 429:
        return "Too many requests. Please wait a moment."
      case 500:
      case 502:
      case 503:
        return "Server error. Please try again later."
      default:
        return `Error (${response.status}). Please try again.`
    }
  }

  return "Something went wrong. Please try again."
}

/**
 * Fetch wrapper with error handling
 */
export async function safeFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, options)

    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // Response wasn't JSON
    }

    if (!response.ok) {
      return {
        data: null,
        error: parseApiError(response, body),
      }
    }

    return {
      data: body as T,
      error: null,
    }
  } catch (err) {
    // Network error or other fetch failure
    if (err instanceof TypeError && err.message.includes("fetch")) {
      return {
        data: null,
        error: ERROR_MESSAGES.NETWORK_ERROR,
      }
    }
    return {
      data: null,
      error: ERROR_MESSAGES.NETWORK_ERROR,
    }
  }
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(errorCode?: string): boolean {
  if (!errorCode) return false
  return errorCode.includes("RATE_LIMITED")
}
