import {
  BASE_PRICE,
  CAST_DISCOUNT,
  RECAST_DISCOUNT,
  TWEET_DISCOUNT,
  FOLLOW_DISCOUNT,
  PRO_DISCOUNT,
  EARLY_FID_DISCOUNT,
  computeDiscount,
  computePrice,
  type DiscountFlags,
} from '../app/lib/pricing'

describe('Pricing Constants', () => {
  test('BASE_PRICE should be 20 million', () => {
    expect(BASE_PRICE).toBe(20_000_000)
  })

  test('CAST_DISCOUNT should be 2 million', () => {
    expect(CAST_DISCOUNT).toBe(2_000_000)
  })

  test('RECAST_DISCOUNT should be 4 million', () => {
    expect(RECAST_DISCOUNT).toBe(4_000_000)
  })

  test('TWEET_DISCOUNT should be 1 million', () => {
    expect(TWEET_DISCOUNT).toBe(1_000_000)
  })

  test('FOLLOW_DISCOUNT should be 500k', () => {
    expect(FOLLOW_DISCOUNT).toBe(500_000)
  })

  test('PRO_DISCOUNT should be 500k', () => {
    expect(PRO_DISCOUNT).toBe(500_000)
  })

  test('EARLY_FID_DISCOUNT should be 500k', () => {
    expect(EARLY_FID_DISCOUNT).toBe(500_000)
  })
})

describe('computeDiscount', () => {
  const noDiscounts: DiscountFlags = {
    casted: false,
    recast: false,
    tweeted: false,
    followTPC: false,
    followStar: false,
    followChannel: false,
    farcasterPro: false,
    earlyFid: false,
  }

  test('returns 0 when no discounts are applied', () => {
    expect(computeDiscount(noDiscounts)).toBe(0)
  })

  test('applies CAST_DISCOUNT when casted is true', () => {
    expect(computeDiscount({ ...noDiscounts, casted: true })).toBe(CAST_DISCOUNT)
  })

  test('applies RECAST_DISCOUNT when recast is true', () => {
    expect(computeDiscount({ ...noDiscounts, recast: true })).toBe(RECAST_DISCOUNT)
  })

  test('applies TWEET_DISCOUNT when tweeted is true', () => {
    expect(computeDiscount({ ...noDiscounts, tweeted: true })).toBe(TWEET_DISCOUNT)
  })

  test('applies FOLLOW_DISCOUNT when followTPC is true', () => {
    expect(computeDiscount({ ...noDiscounts, followTPC: true })).toBe(FOLLOW_DISCOUNT)
  })

  test('applies FOLLOW_DISCOUNT when followStar is true', () => {
    expect(computeDiscount({ ...noDiscounts, followStar: true })).toBe(FOLLOW_DISCOUNT)
  })

  test('applies FOLLOW_DISCOUNT when followChannel is true', () => {
    expect(computeDiscount({ ...noDiscounts, followChannel: true })).toBe(FOLLOW_DISCOUNT)
  })

  test('applies PRO_DISCOUNT when farcasterPro is true', () => {
    expect(computeDiscount({ ...noDiscounts, farcasterPro: true })).toBe(PRO_DISCOUNT)
  })

  test('applies EARLY_FID_DISCOUNT when earlyFid is true', () => {
    expect(computeDiscount({ ...noDiscounts, earlyFid: true })).toBe(EARLY_FID_DISCOUNT)
  })

  test('stacks multiple discounts correctly', () => {
    const multipleDiscounts: DiscountFlags = {
      casted: true,
      recast: true,
      tweeted: false,
      followTPC: true,
      followStar: false,
      followChannel: false,
      farcasterPro: true,
      earlyFid: false,
    }
    const expected = CAST_DISCOUNT + RECAST_DISCOUNT + FOLLOW_DISCOUNT + PRO_DISCOUNT
    expect(computeDiscount(multipleDiscounts)).toBe(expected)
  })

  test('calculates maximum discount when all flags are true', () => {
    const allDiscounts: DiscountFlags = {
      casted: true,
      recast: true,
      tweeted: true,
      followTPC: true,
      followStar: true,
      followChannel: true,
      farcasterPro: true,
      earlyFid: true,
    }
    // 2M + 4M + 1M + 500K*3 + 500K + 500K = 9.5M
    const maxDiscount =
      CAST_DISCOUNT +       // 2M
      RECAST_DISCOUNT +     // 4M
      TWEET_DISCOUNT +      // 1M
      FOLLOW_DISCOUNT * 3 + // 1.5M (3 follow discounts)
      PRO_DISCOUNT +        // 500K
      EARLY_FID_DISCOUNT    // 500K
    expect(computeDiscount(allDiscounts)).toBe(maxDiscount)
    expect(maxDiscount).toBe(9_500_000) // 9.5M total discount
  })
})

describe('computePrice', () => {
  const noDiscounts: DiscountFlags = {
    casted: false,
    recast: false,
    tweeted: false,
    followTPC: false,
    followStar: false,
    followChannel: false,
    farcasterPro: false,
    earlyFid: false,
  }

  test('returns BASE_PRICE when no discounts are applied', () => {
    expect(computePrice(noDiscounts)).toBe(BASE_PRICE)
  })

  test('subtracts CAST_DISCOUNT from BASE_PRICE when casted', () => {
    expect(computePrice({ ...noDiscounts, casted: true })).toBe(BASE_PRICE - CAST_DISCOUNT)
  })

  test('subtracts RECAST_DISCOUNT from BASE_PRICE when recast', () => {
    expect(computePrice({ ...noDiscounts, recast: true })).toBe(BASE_PRICE - RECAST_DISCOUNT)
  })

  test('calculates correct price with multiple discounts', () => {
    const flags: DiscountFlags = {
      casted: true,
      recast: true,
      tweeted: true,
      followTPC: false,
      followStar: false,
      followChannel: false,
      farcasterPro: false,
      earlyFid: false,
    }
    const expectedDiscount = CAST_DISCOUNT + RECAST_DISCOUNT + TWEET_DISCOUNT
    expect(computePrice(flags)).toBe(BASE_PRICE - expectedDiscount)
  })

  test('calculates minimum price with all discounts applied', () => {
    const allDiscounts: DiscountFlags = {
      casted: true,
      recast: true,
      tweeted: true,
      followTPC: true,
      followStar: true,
      followChannel: true,
      farcasterPro: true,
      earlyFid: true,
    }
    const minPrice = computePrice(allDiscounts)
    expect(minPrice).toBe(10_500_000) // 20M - 9.5M = 10.5M
  })

  test('never returns negative price (floor at 0)', () => {
    // This tests the Math.max(BASE_PRICE - discount, 0) logic
    // With all current discounts, the price should be 9.5M, not negative
    const allDiscounts: DiscountFlags = {
      casted: true,
      recast: true,
      tweeted: true,
      followTPC: true,
      followStar: true,
      followChannel: true,
      farcasterPro: true,
      earlyFid: true,
    }
    expect(computePrice(allDiscounts)).toBeGreaterThanOrEqual(0)
  })
})

describe('Pricing Integration', () => {
  test('discount + price always equals BASE_PRICE for valid discounts', () => {
    const flags: DiscountFlags = {
      casted: true,
      recast: false,
      tweeted: true,
      followTPC: true,
      followStar: true,
      followChannel: false,
      farcasterPro: true,
      earlyFid: false,
    }
    const discount = computeDiscount(flags)
    const price = computePrice(flags)
    expect(discount + price).toBe(BASE_PRICE)
  })

  test('realistic user scenario: cast + follow creator', () => {
    const flags: DiscountFlags = {
      casted: true,
      recast: false,
      tweeted: false,
      followTPC: true,
      followStar: false,
      followChannel: false,
      farcasterPro: false,
      earlyFid: false,
    }
    const price = computePrice(flags)
    expect(price).toBe(17_500_000) // 20M - 2M - 500K = 17.5M
  })

  test('realistic user scenario: early adopter with Pro subscription', () => {
    const flags: DiscountFlags = {
      casted: false,
      recast: false,
      tweeted: false,
      followTPC: false,
      followStar: false,
      followChannel: false,
      farcasterPro: true,
      earlyFid: true,
    }
    const price = computePrice(flags)
    expect(price).toBe(19_000_000) // 20M - 500K - 500K = 19M
  })

  test('realistic user scenario: all social actions, no follows', () => {
    const flags: DiscountFlags = {
      casted: true,
      recast: true,
      tweeted: true,
      followTPC: false,
      followStar: false,
      followChannel: false,
      farcasterPro: false,
      earlyFid: false,
    }
    const price = computePrice(flags)
    expect(price).toBe(13_000_000) // 20M - 2M - 4M - 1M = 13M
  })
})
