// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

// FIDs we care about
const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500
const CLANKTON_CHANNEL_ID = "clankton"

// Correct Neynar header
const neynarHeaders = {
  "api_key": NEYNAR_API_KEY ?? "",
}

export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid")
  const fid = fidParam ? Number(fidParam) : NaN

  if (!fidParam || Number.isNaN(fid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid" },
      { status: 400 }
    )
  }

  if (!NEYNAR_API_KEY) {
    console.error("Missing NEYNAR_API_KEY env var")
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    )
  }

  try {
    //
    // ------------------------------------------------------------
    // 1) Does the user FOLLOW the accounts? (@thepapercrane / @starl3xx)
    // ------------------------------------------------------------
    //
    // Correct endpoint:
    // GET /v2/farcaster/user/follows?fid=<viewer>
    //
    const followRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/follows?fid=${fid}&limit=5000`,
      { headers: neynarHeaders, cache: "no-store" }
    )

    if (!followRes.ok) {
      const text = await followRes.text().catch(() => "")
      console.error("Neynar follow-list error", followRes.status, text)
      throw new Error("Failed to fetch follow list")
    }

    const followJson = await followRes.json()

    // Correct shape:
    // followJson.result.users = [{ fid: number, ... }]
    const followList: any[] = followJson.result?.users ?? []

    const followTPC = followList.some((u) => u.fid === PAPERCRANE_FID)
    const followStar = followList.some((u) => u.fid === STARL3XX_FID)

    //
    // ------------------------------------------------------------
    // 2) Is the user in the /clankton channel?
    // ------------------------------------------------------------
    //
    // Correct endpoint:
    // GET /v2/farcaster/channel/user?fid=<X>&channel_id=<id>
    //
    const channelRes = await fetch(
      `https://api.neynar.com/v2/farcaster/channel/user?fid=${fid}&channel_id=${CLANKTON_CHANNEL_ID}`,
      { headers: neynarHeaders, cache: "no-store" }
    )

    let followChannel = false

    if (channelRes.ok) {
      const channelJson = await channelRes.json()

      // Neynar returns one of these depending on version:
      followChannel =
        !!channelJson.is_following ||
        !!channelJson.result?.is_following ||
        !!channelJson.result?.channel?.following ||
        false
    } else {
      const text = await channelRes.text().catch(() => "")
      console.error("Neynar channel error", channelRes.status, text)
    }

    //
    // ------------------------------------------------------------
    // Return the combined follow state
    // ------------------------------------------------------------
    //
    return NextResponse.json({
      followTPC,
      followStar,
      followChannel,
    })
  } catch (err) {
    console.error("/api/farcaster/follows error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}