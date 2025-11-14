// app/lib/pricing.ts
export const BASE_PRICE = 20_000_000;
export const CAST_DISCOUNT = 2_000_000;
export const TWEET_DISCOUNT = 1_000_000;
export const FOLLOW_DISCOUNT = 500_000;

export type DiscountFlags = {
  casted: boolean;
  tweeted: boolean;
  followTPC: boolean;
  followStar: boolean;
  followChannel: boolean;
};

export function computeDiscount(flags: DiscountFlags): number {
  let d = 0;
  if (flags.casted) d += CAST_DISCOUNT;
  if (flags.tweeted) d += TWEET_DISCOUNT;
  if (flags.followTPC) d += FOLLOW_DISCOUNT;
  if (flags.followStar) d += FOLLOW_DISCOUNT;
  if (flags.followChannel) d += FOLLOW_DISCOUNT;
  return d;
}

export function computePrice(flags: DiscountFlags): number {
  const discount = computeDiscount(flags);
  return Math.max(BASE_PRICE - discount, 0);
}