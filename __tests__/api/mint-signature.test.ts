/**
 * Tests for /api/mint-signature endpoint
 *
 * Note: These tests mock the database, rate limiter, and ethers
 * to test the endpoint logic in isolation.
 */

import { NextRequest } from 'next/server'

// Mock @vercel/postgres
jest.mock('@vercel/postgres', () => ({
  sql: jest.fn(),
}))

// Mock rate limiter
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ isLimited: false, remaining: 9 }),
}))

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    parseUnits: jest.fn((value: string) => BigInt(value) * BigInt(10 ** 18)),
    Wallet: jest.fn().mockImplementation(() => ({
      signTypedData: jest.fn().mockResolvedValue('0xmocksignature123'),
    })),
  },
}))

// Set up environment variables before importing the route
const originalEnv = process.env

beforeEach(() => {
  process.env = {
    ...originalEnv,
    SIGNER_PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    NEXT_PUBLIC_NFT_CONTRACT_ADDRESS: '0xContractAddress1234567890123456789012',
  }
})

afterEach(() => {
  process.env = originalEnv
})

import { POST } from '../../app/api/mint-signature/route'
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

describe('/api/mint-signature', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue({ isLimited: false, remaining: 9 })
    mockSql.mockResolvedValue({ rows: [] } as never)
  })

  describe('Input Validation', () => {
    test('returns 400 when address is missing', async () => {
      const req = createMockRequest({})
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('MINT_SIG_MISSING_ADDRESS')
    })

    test('returns 400 for invalid address format', async () => {
      const req = createMockRequest({
        address: 'invalid-address',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('MINT_SIG_INVALID_ADDRESS')
    })

    test('returns 400 for address without 0x prefix', async () => {
      const req = createMockRequest({
        address: '1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('MINT_SIG_INVALID_ADDRESS')
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
      expect(body.error.code).toBe('MINT_SIG_MISSING_ADDRESS')
    })
  })

  describe('Rate Limiting', () => {
    test('returns 429 when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({ isLimited: true, remaining: 0 })

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body.error.code).toBe('MINT_SIG_RATE_LIMITED')
    })

    test('uses stricter rate limit (10 requests per minute)', async () => {
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      await POST(req)

      expect(mockRateLimit).toHaveBeenCalledWith({
        key: 'mint-signature:127.0.0.1',
        limit: 10, // Stricter limit
        window: 60_000,
      })
    })
  })

  describe('Signature Generation', () => {
    test('returns signature for valid address with no discounts', async () => {
      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.signature).toBeDefined()
      expect(body.nonce).toBeDefined()
      expect(body.deadline).toBeDefined()
      expect(body.price).toBeDefined()
    })

    test('returns correct human readable price format', async () => {
      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(body.humanReadablePrice).toContain('CLANKTON')
    })

    test('returns discounts object in response', async () => {
      mockSql.mockResolvedValueOnce({
        rows: [{
          casted: true,
          recast: false,
          tweeted: false,
          follow_tpc: false,
          follow_star: false,
          follow_channel: false,
          farcaster_pro: false,
          early_fid: false,
        }],
      } as never)

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(body.discounts).toBeDefined()
      expect(body.discounts.casted).toBe(true)
    })

    test('deadline is set to 5 minutes in the future', async () => {
      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const beforeRequest = Math.floor(Date.now() / 1000)
      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()
      const afterRequest = Math.floor(Date.now() / 1000)

      // Deadline should be ~5 minutes (300 seconds) from now
      expect(body.deadline).toBeGreaterThanOrEqual(beforeRequest + 299)
      expect(body.deadline).toBeLessThanOrEqual(afterRequest + 301)
    })

    test('nonce is unique per request', async () => {
      mockSql.mockResolvedValue({ rows: [] } as never)

      const req1 = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const req2 = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })

      const response1 = await POST(req1)
      const body1 = await response1.json()

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10))

      const response2 = await POST(req2)
      const body2 = await response2.json()

      // Nonces should be different (or at least have very low collision chance)
      expect(body1.nonce).not.toBe(body2.nonce)
    })
  })

  describe('Price Calculation', () => {
    test('calculates base price with no discounts', async () => {
      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      // Price should be 20M * 10^18 (in wei)
      expect(body.humanReadablePrice).toBe('20,000,000 CLANKTON')
    })

    test('applies cast discount correctly', async () => {
      mockSql.mockResolvedValueOnce({
        rows: [{
          casted: true,
          recast: false,
          tweeted: false,
          follow_tpc: false,
          follow_star: false,
          follow_channel: false,
          farcaster_pro: false,
          early_fid: false,
        }],
      } as never)

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      // 20M - 2M = 18M
      expect(body.humanReadablePrice).toBe('18,000,000 CLANKTON')
    })

    test('applies all discounts correctly', async () => {
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

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      // Max discount = 9.5M, so min price = 20M - 9.5M = 10.5M
      expect(body.humanReadablePrice).toBe('10,500,000 CLANKTON')
    })
  })

  describe('Configuration Errors', () => {
    test('returns 500 when SIGNER_PRIVATE_KEY is not set', async () => {
      const currentKey = process.env.SIGNER_PRIVATE_KEY
      delete process.env.SIGNER_PRIVATE_KEY

      mockSql.mockResolvedValueOnce({ rows: [] } as never)

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error.code).toBe('MINT_SIG_CONFIG_ERROR')

      // Restore
      process.env.SIGNER_PRIVATE_KEY = currentKey
    })
  })

  describe('Error Handling', () => {
    test('returns 500 on database error', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'))

      const req = createMockRequest({
        address: '0x1234567890123456789012345678901234567890',
      })
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error.code).toBe('MINT_SIG_INTERNAL_ERROR')
    })
  })
})
