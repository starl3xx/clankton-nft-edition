import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

export const runtime = "nodejs"

// Sync with page.tsx & your on-chain logic
const BASE_PRICE = 20_000_000
const CAST_DISCOUNT = 2_000_000
const TWEET_DISCOUNT = 1_000_000
const FOLLOW_DISCOUNT = 500_000
const MAX_SUPPLY = 50

// Mint window (same as in page.tsx)
const MINT_START = Math.floor(Date.UTC(2025, 11, 3, 0, 0, 0) / 1000)
const MINT_END = MINT_START + 7 * 24 * 60 * 60

export async function POST(req: NextRequest) {
  try {
    const { address } = (await req.json()) as { address?: string }

    if (!address) {
      return NextResponse.json(
        { error: "Missing address" },
        { status: 400 },
      )
    }

    const now = Math.floor(Date.now() / 1000)
    if (now < MINT_START) {
      return NextResponse.json(
        { error: "Mint not live yet" },
        { status: 400 },
      )
    }
    if (now > MINT_END) {
      return NextResponse.json(
        { error: "Mint has ended" },
        { status: 400 },
      )
    }

    const result =
      await sql`SELECT * FROM user_discounts WHERE address = ${address} LIMIT 1;`

    let discount = 0
    let casted = false
    let tweeted = false
    let follow_tpc = false
    let follow_star = false
    let follow_channel = false

    const rowCount = result.rowCount ?? 0

    if (rowCount > 0) {
      const row = result.rows[0] as {
        casted: boolean
        tweeted: boolean
        follow_tpc: boolean
        follow_star: boolean
        follow_channel: boolean
      }
      casted = row.casted
      tweeted = row.tweeted
      follow_tpc = row.follow_tpc
      follow_star = row.follow_star
      follow_channel = row.follow_channel

      if (casted) discount += CAST_DISCOUNT
      if (tweeted) discount += TWEET_DISCOUNT
      if (follow_tpc) discount += FOLLOW_DISCOUNT
      if (follow_star) discount += FOLLOW_DISCOUNT
      if (follow_channel) discount += FOLLOW_DISCOUNT
    }

    const price = Math.max(BASE_PRICE - discount, 0)

    const fakeSignature = "0x" + "00".repeat(65) // placeholder

    return NextResponse.json({
      price: price.toString(),
      signature: fakeSignature,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    )
  }
}