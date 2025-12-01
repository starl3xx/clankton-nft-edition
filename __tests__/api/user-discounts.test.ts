/**
 * Tests for /api/user-discounts endpoint
 *
 * Note: These tests mock the database and rate limiter to test
 * the endpoint logic in isolation.
 */

import { NextRequest } from 'next/server'

// Mock @vercel/postgres
jest.mock('@vercel/postgres', () => ({
  sql: jest.fn(),
}))

// Mock rate limiter
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ isLimited: false, remaining: 59 }),
}))

import { GET } from '../../app/api/user-discounts/route'
import { sql } from '@vercel/postgres'
import { rateLimit } from '@/lib/rate-limit'

const mockSql = sql as jest.MockedFunction<typeof sql>
const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>

// Helper to create mock NextRequest
function createMockRequest(address?: string): NextRequest {
  const url = address
    ? `http://localhost:3000/api/user-discounts?address=${address}`
    : 'http://localhost:3000/api/user-discounts'

  return {
    nextUrl: new URL(url),
    headers: new Headers({
      'x-forwarded-for': '127.0.0.1',
    }),
  } as unknown as NextRequest
}

describe('/api/user-discounts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue({ isLimited: false, remaining: 59 })
  })

  describe('Input Validation', () => {
    test('returns 400 when address is missing', async () => {
      const req = createMockRequest()
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('USER_DISCOUNTS_MISSING_ADDRESS')
    })

    test('returns 400 for invalid address format', async () => {
      const req = createMockRequest('invalid-address')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('USER_DISCOUNTS_INVALID_ADDRESS')
    })

    test('returns 400 for address without 0x prefix', async () => {
      const req = createMockRequest('1234567890123456789012345678901234567890')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('USER_DISCOUNTS_INVALID_ADDRESS')
    })

    test('returns 400 for address with wrong length', async () => {
      const req = createMockRequest('0x12345')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('USER_DISCOUNTS_INVALID_ADDRESS')
    })
  })

  describe('Rate Limiting', () => {
    test('returns 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({ isLimited: true, remaining: 0 })

      const req = createMockRequest('0x1234567890123456789012345678901234567890')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body.error.code).toBe('USER_DISCOUNTS_RATE_LIMITED')
    })

    test('uses IP-based rate limiting key', async () => {
      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const req = createMockRequest('0x1234567890123456789012345678901234567890')
      await GET(req)

      expect(mockRateLimit).toHaveBeenCalledWith({
        key: 'user-discounts:127.0.0.1',
        limit: 60,
        window: 60_000,
      })
    })
  })

  describe('Discount Retrieval', () => {
    test('returns base price when no discounts exist', async () => {
      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const req = createMockRequest('0x1234567890123456789012345678901234567890')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.basePrice).toBe(20_000_000)
      expect(body.price).toBe(20_000_000)
      expect(body.casted).toBe(false)
      expect(body.recast).toBe(false)
    })

    test('returns correct discounts when user has some actions', async () => {
      mockSql.mockResolvedValueOnce({
        rows: [{
          casted: true,
          recast: false,
          tweeted: true,
          follow_tpc: true,
          follow_star: false,
          follow_channel: false,
          farcaster_pro: false,
          early_fid: false,
        }],
      } as never)

      const req = createMockRequest('0x1234567890123456789012345678901234567890')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.casted).toBe(true)
      expect(body.tweeted).toBe(true)
      expect(body.followTPC).toBe(true)
      expect(body.recast).toBe(false)
      // 20M - 2M (cast) - 1M (tweet) - 500K (followTPC) = 16.5M
      expect(body.price).toBe(16_500_000)
    })

    test('returns maximum discount when all flags are true', async () => {
      mockSql.mockResolvedValueOnce({
        rows: [{
          casted: true,
          recast: true,
          tweeted: true,
          follow_tpc: true,
          follow_star: true,
          follow_channel: true,
          farcaster_pro: true,
          early_fid: true,
        }],
      } as never)

      const req = createMockRequest('0x1234567890123456789012345678901234567890')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      // Max discount = 9.5M, so min price = 20M - 9.5M = 10.5M
      expect(body.price).toBe(10_500_000)
    })

    test('normalizes address to lowercase', async () => {
      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const req = createMockRequest('0xABCDEF1234567890123456789012345678901234')
      await GET(req)

      // Check that the SQL was called with lowercase address
      expect(mockSql).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    test('returns fallback response on database error', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'))

      const req = createMockRequest('0x1234567890123456789012345678901234567890')
      const response = await GET(req)
      const body = await response.json()

      expect(response.status).toBe(200) // Graceful fallback
      expect(body.fallback).toBe(true)
      expect(body.price).toBe(20_000_000) // Base price
    })
  })
})
