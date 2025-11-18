// app/api/mint-request/route.ts
import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { computePrice, type DiscountFlags } from "@/app/lib/pricing"
import { apiError } from "@/lib/api"

export const runtime = "nodejs"

type DbRow = {
  casted: boolean | null
  recast: boolean | null
  tweeted: boolean | null
  follow_tpc: boolean | null
  follow_star: boolean | null
  follow_channel: boolean | null
  farcaster_pro: boolean | null
  early_fid: boolean | null
}

function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    const address = typeof body?.address === "string" ? body.address : null
    if (!address) {
      return apiError(
        "MINT_BAD_REQUEST",
        "Missing wallet address",
        400,
      )
    }

    if (!isValidEthAddress(address)) {
      return apiError(
        "MINT_INVALID_ADDRESS",
        "Invalid wallet address format",
        400,
      )
    }

    const normalized = address.toLowerCase()

    const result = await sql<DbRow>`
      SELECT casted, recast, tweeted, follow_tpc, follow_star, follow_channel, farcaster_pro, early_fid
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
      farcasterPro: !!row?.farcaster_pro,
      earlyFid: !!row?.early_fid,
    }

    const price = computePrice(flags)

    // In the future this is where you'd:
    // - construct a transaction
    // - hit a minting contract or third-party API
    return NextResponse.json(
      {
        ok: true,
        address: normalized,
        price,
        discounts: flags,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error("[api/mint-request] fatal error", err)
    return apiError(
      "MINT_INTERNAL_ERROR",
      "Could not prepare your mint. Please try again.",
      500,
    )
  }
}