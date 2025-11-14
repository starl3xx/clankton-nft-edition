import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

export const runtime = "nodejs"

// Keep these in sync with your page.tsx constants
const BASE_PRICE = 20_000_000
const CAST_DISCOUNT = 2_000_000
const TWEET_DISCOUNT = 1_000_000
const FOLLOW_DISCOUNT = 500_000

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address")

    if (!address) {
      return NextResponse.json(
        { error: "Missing address" },
        { status: 400 },
      )
    }

    const result =
      await sql`SELECT * FROM user_discounts WHERE address = ${address} LIMIT 1;`

    if (result.rowCount === 0) {
      // No record yet: no discounts, base price
      return NextResponse.json({
        casted: false,
        tweeted: false,
        followTPC: false,
        followStar: false,
        followChannel: false,
        price: BASE_PRICE.toString(),
      })
    }

    const row = result.rows[0] as {
      casted: boolean
      tweeted: boolean
      follow_tpc: boolean
      follow_star: boolean
      follow_channel: boolean
    }

    let discount = 0
    if (row.casted) discount += CAST_DISCOUNT
    if (row.tweeted) discount += TWEET_DISCOUNT
    if (row.follow_tpc) discount += FOLLOW_DISCOUNT
    if (row.follow_star) discount += FOLLOW_DISCOUNT
    if (row.follow_channel) discount += FOLLOW_DISCOUNT

    const price = Math.max(BASE_PRICE - discount, 0)

    return NextResponse.json({
      casted: row.casted,
      tweeted: row.tweeted,
      followTPC: row.follow_tpc,
      followStar: row.follow_star,
      followChannel: row.follow_channel,
      price: price.toString(),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    )
  }
}