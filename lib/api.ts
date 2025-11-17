// lib/api.ts
import { NextResponse } from "next/server"

export type ApiErrorObject = {
  code: string
  message: string
}

/**
 * Canonical error body shape for all API routes.
 * HTTP status still matters (400/429/500/etc).
 */
export type ApiErrorResponse = {
  error: ApiErrorObject
}

/**
 * Helper to return a normalized error JSON.
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: { code, message },
    },
    { status },
  )
}