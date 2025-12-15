// lib/rate-limit.ts
import { kv } from "@vercel/kv"

// Check if KV is configured
const isKvConfigured = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
)

export async function rateLimit({
  key,
  limit = 20,
  window = 60_000, // 60s
}: {
  key: string
  limit?: number
  window?: number
}) {
  // Skip rate limiting if KV is not configured
  if (!isKvConfigured) {
    return { isLimited: false, remaining: limit }
  }

  const now = Date.now()
  const windowKey = `rl:${key}:${Math.floor(now / window)}`

  const current = (await kv.incr(windowKey)) ?? 0

  if (current === 1) {
    await kv.expire(windowKey, Math.ceil(window / 1000))
  }

  const isLimited = current > limit

  return { isLimited, remaining: Math.max(0, limit - current) }
}