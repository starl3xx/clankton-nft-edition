import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import {
  BASE_PRICE,
  computePrice,
  type DiscountFlags,
} from "@/app/lib/pricing"
import { apiError } from "@/lib/api"

export const runtime = "nodejs"

type DbRow = {
  casted: boolean | null
  recast: boolean | null
  tweeted: boolean | null
  follow_tpc: boolean | null
  follow_star: boolean | null
  follow_channel: boolean | null
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")

  if (!address) {
    return apiError(
      "USER_DISCOUNTS_MISSING_ADDRESS",
      "Missing or invalid wallet address",
      400,
    )
  }

  const normalized = address.toLowerCase()

  try {
    const result = await sql<DbRow>`
      SELECT casted, recast, tweeted, follow_tpc, follow_star, follow_channel
      FROM clankton_discounts
      WHERE address = ${normalized}
      LIMIT 1;
    `

    const row = result.rows[0]

    const flags: DiscountFlags = {
      casted: !!row?.casted,
      recast: !!row?.recast,
      tweeted: !!row?.tweeted,
      followTPC: !!row?.follow_tpc,
      followStar: !!row?.follow_star,
      followChannel: !!row?.follow_channel,
      farcasterPro: false, // Not stored in DB, fetched from Farcaster API
      earlyFid: false, // Not stored in DB, computed from FID
    }

    const price = computePrice(flags)

    return NextResponse.json({
      basePrice: BASE_PRICE,
      price,
      ...flags,
    })
  } catch (err) {
    console.error("/api/user-discounts DB error", err)

    // Safe fallback: no discounts, just base price
    const flags: DiscountFlags = {
      casted: false,
      recast: false,
      tweeted: false,
      followTPC: false,
      followStar: false,
      followChannel: false,
      farcasterPro: false,
      earlyFid: false,
    }

    const price = computePrice(flags)

    return NextResponse.json(
      {
        basePrice: BASE_PRICE,
        price,
        ...flags,
        fallback: true, // optional flag so you know it came from fallback
      },
      { status: 200 },
    )
  }
}