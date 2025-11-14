import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { BASE_PRICE, computePrice, type DiscountFlags } from "@/app/lib/pricing"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const address = typeof body?.address === "string" ? body.address : null
    const fid = typeof body?.fid === "number" ? body.fid : null

    if (!address || !fid) {
      return NextResponse.json(
        { error: "Missing address or fid" },
        { status: 400 },
      )
    }

    const normalized = address.toLowerCase()

    // 1) Ask Farcaster if `fid` already follows the accounts / channel
    // Pseudocode – you’ll plug in the real Farcaster API calls here.
    const alreadyFollowsTPC = await isFollowing(fid, PAPERCRANE_FID)
    const alreadyFollowsStar = await isFollowing(fid, STARL3XX_FID)
    const alreadyInChannel = await isInChannel(fid, "clankton")

    const flags: DiscountFlags = {
      casted: false,
      tweeted: false,
      followTPC: alreadyFollowsTPC,
      followStar: alreadyFollowsStar,
      followChannel: alreadyInChannel,
    }

    // 2) Upsert into clankton_discounts
    await sql`
      INSERT INTO clankton_discounts (
        address,
        casted,
        tweeted,
        follow_tpc,
        follow_star,
        follow_channel
      )
      VALUES (
        ${normalized},
        ${flags.casted},
        ${flags.tweeted},
        ${flags.followTPC},
        ${flags.followStar},
        ${flags.followChannel}
      )
      ON CONFLICT (address) DO UPDATE SET
        follow_tpc     = EXCLUDED.follow_tpc,
        follow_star    = EXCLUDED.follow_star,
        follow_channel = EXCLUDED.follow_channel,
        updated_at     = NOW();
    `

    const price = computePrice(flags)

    return NextResponse.json({
      basePrice: BASE_PRICE,
      price,
      ...flags,
    })
  } catch (err) {
    console.error("bootstrap-discounts error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

/**
 * These helpers should call the Farcaster API or Hub to check relationships.
 * Implement them with your preferred HTTP client / hub SDK.
 */
async function isFollowing(viewerFid: number, targetFid: number): Promise<boolean> {
  // TODO: replace with real Farcaster call
  return false
}

async function isInChannel(viewerFid: number, channelKey: string): Promise<boolean> {
  // TODO: replace with real Farcaster call
  return false
}