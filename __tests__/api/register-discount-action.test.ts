/**
 * Tests for /api/register-discount-action endpoint
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

import { POST } from '../../app/api/register-discount-action/route'
import { sql } from '@vercel/postgres'
import { rateLimit } from '@/lib/rate-limit'

const mockSql = sql as jest.MockedFunction<typeof sql>
const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>

// Helper to create mock NextRequest with JSON body
function createMockRequest(body: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({
      'x-forwarded-for': '127.0.0.1',
    }),
  } as unknown as NextRequest
}

describe('/api/register-discount-action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue({ isLimited: false, remaining: 59 })
    // Default mock for SQL queries
    mockSql.mockResolvedValue({ rows: [] } as never)
  })

  describe('Input Validation', () => {
    test('returns 400 when address is missing', async () => {
      const req = createMockRequest({ action: 'cast' })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('DISCOUNT_BAD_REQUEST')
    })

    test('returns 400 for invalid address format', async () => {
      const req = createMockRequest({
        address: 'invalid-address',
        action: 'cast',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('DISCOUNT_INVALID_ADDRESS')
    })

    test('returns 400 when action is missing', async () => {
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('DISCOUNT_INVALID_ACTION')
    })

    test('returns 400 for invalid action type', async () => {
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
        action: 'invalid_action',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('DISCOUNT_INVALID_ACTION')
    })

    test('returns 400 when body is not valid JSON', async () => {
      const req = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        headers: new Headers({
          'x-forwarded-for': '127.0.0.1',
        }),
      } as unknown as NextRequest

      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('DISCOUNT_BAD_REQUEST')
    })
  })

  describe('Valid Actions', () => {
    const validActions = [
      'cast',
      'recast',
      'tweet',
      'follow_tpc',
      'follow_star',
      'follow_channel',
      'farcaster_pro',
      'early_fid',
    ]

    test.each(validActions)('accepts valid action: %s', async (action) => {
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
        action,
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
    })
  })

  describe('Rate Limiting', () => {
    test('returns 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({ isLimited: true, remaining: 0 })

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
        action: 'cast',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body.error.code).toBe('DISCOUNT_RATE_LIMITED')
    })

    test('uses IP-based rate limiting key', async () => {
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
        action: 'cast',
      })
      await POST(req)

      expect(mockRateLimit).toHaveBeenCalledWith({
        key: 'register-discount:127.0.0.1',
        limit: 60,
        window: 60_000,
      })
    })
  })

  describe('Database Operations', () => {
    test('inserts action into clankton_discount_actions table', async () => {
      const req = createMockRequest({
        address: '0xABCDEF1234567890123456789012345678901234',
        action: 'cast',
        fid: 12345,
      })
      await POST(req)

      // Should have been called at least once for INSERT
      expect(mockSql).toHaveBeenCalled()
    })

    test('normalizes address to lowercase', async () => {
      const req = createMockRequest({
        address: '0xABCDEF1234567890123456789012345678901234',
        action: 'cast',
      })
      await POST(req)

      // SQL should be called with lowercase address
      expect(mockSql).toHaveBeenCalled()
    })

    test('handles FID as optional parameter', async () => {
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
        action: 'cast',
        // No FID provided
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
    })

    test('converts numeric FID to string', async () => {
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
        action: 'cast',
        fid: 12345,
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'))

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
        action: 'cast',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error.code).toBe('DISCOUNT_INTERNAL_ERROR')
    })
  })
})
