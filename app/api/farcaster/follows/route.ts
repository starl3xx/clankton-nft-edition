// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

// FIDs we care about
const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500
const CLANKTON_CHANNEL_ID = "clankton"

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
    const headers = {
      "api-key": NEYNAR_API_KEY,
    }

    // 1) Who does this fid follow?
    const followingRes = await fetch(
      `https://api.neynar.com/v2/farcaster/user/following?fid=${fid}&limit=200`,
      {
        headers,
        cache: "no-store",
      },
    )

    if (!followingRes.ok) {
      const text = await followingRes.text().catch(() => "")
      console.error(
        "Neynar user/following error",
        followingRes.status,
        text,
      )
      throw new Error("Failed to fetch following")
    }

    const followingJson: any = await followingRes.json()
    const users: any[] =
      followingJson.users ?? followingJson.result?.users ?? []

    const followTPC = users.some((u) => u.fid === PAPERCRANE_FID)
    const followStar = users.some((u) => u.fid === STARL3XX_FID)

    // 2) Is this fid following the /clankton channel?
    const channelRes = await fetch(
      `https://api.neynar.com/v2/farcaster/channel/user?fid=${fid}&channel_id=${CLANKTON_CHANNEL_ID}`,
      {
        headers,
        cache: "no-store",
      },
    )

    let followChannel = false
    if (channelRes.ok) {
      const channelJson: any = await channelRes.json()
      // Exact shape may vary slightly; these cover common variants
      followChannel =
        !!channelJson.is_following ||
        !!channelJson.result?.is_following ||
        !!channelJson.result?.channel?.following
    } else {
      const text = await channelRes.text().catch(() => "")
      console.error(
        "Neynar channel/user error",
        channelRes.status,
        text,
      )
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