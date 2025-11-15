// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

// FIDs we care about
const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500
const CLANKTON_CHANNEL_ID = "clankton"

type NeynarUser = {
  fid: number
  viewer_context?: {
    following?: boolean
  }
}

export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid")
  const fid = fidParam ? Number(fidParam) : NaN

  if (!fidParam || Number.isNaN(fid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid" },
      { status: 400 },
    )
  }

  if (!NEYNAR_API_KEY) {
    console.error("Missing NEYNAR_API_KEY env var")
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    )
  }

  try {
    // ---------- 1) USER FOLLOWS (TPC + STARL3XX) ----------
    const bulkRes = await fetch(
      "https://api.neynar.com/v2/farcaster/user/bulk",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // IMPORTANT: api_key (underscore), not api-key
          api_key: NEYNAR_API_KEY,
        },
        body: JSON.stringify({
          fids: [PAPERCRANE_FID, STARL3XX_FID],
          viewer_fid: fid,
        }),
        cache: "no-store",
      },
    )

    if (!bulkRes.ok) {
      const body = await bulkRes.text().catch(() => "")
      console.error("Neynar user/bulk error", {
        status: bulkRes.status,
        body,
      })
      throw new Error("Failed to fetch bulk users")
    }

    const usersJson: any = await bulkRes.json()
    const users: NeynarUser[] = usersJson.users ?? []

    const tpc = users.find((u: NeynarUser) => u.fid === PAPERCRANE_FID)
    const star = users.find((u: NeynarUser) => u.fid === STARL3XX_FID)

    const followTPC = !!tpc?.viewer_context?.following
    const followStar = !!star?.viewer_context?.following

    // ---------- 2) CHANNEL FOLLOW (/clankton) ----------
    const channelRes = await fetch(
      `https://api.neynar.com/v2/farcaster/channel/user?fid=${fid}&channel_id=${CLANKTON_CHANNEL_ID}`,
      {
        headers: {
          Accept: "application/json",
          api_key: NEYNAR_API_KEY,
        },
        cache: "no-store",
      },
    )

    let followChannel = false
    if (channelRes.ok) {
      const channelJson: any = await channelRes.json()
      followChannel =
        !!channelJson.is_following ||
        !!channelJson.result?.is_following ||
        !!channelJson.result?.channel?.following
    } else {
      const text = await channelRes.text().catch(() => "")
      console.error("Neynar channel/user error", {
        status: channelRes.status,
        body: text,
      })
    }

    return NextResponse.json({
      followTPC,
      followStar,
      followChannel,
    })
  } catch (err) {
    console.error("/api/farcaster/follows error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}