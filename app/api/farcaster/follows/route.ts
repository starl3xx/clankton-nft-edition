// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

// FIDs we care about
const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500
const CLANKTON_CHANNEL_ID = "clankton"

type NeynarBulkUser = {
  fid: number
  viewer_context?: {
    following?: boolean
  }
}

export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid")
  const viewerFid = fidParam ? Number(fidParam) : NaN

  if (!fidParam || Number.isNaN(viewerFid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid" },
      { status: 400 },
    )
  }

  if (!NEYNAR_API_KEY) {
    console.error("NEYNAR_API_KEY not configured")
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    )
  }

  const headers = {
    accept: "application/json",
    "x-api-key": NEYNAR_API_KEY,
  }

  try {
    // ---------- 1) user/bulk to see follow state for @thepapercrane & @starl3xx.eth ----------
    const bulkUrl =
      "https://api.neynar.com/v2/farcaster/user/bulk" +
      `?fids=${PAPERCRANE_FID},${STARL3XX_FID}` +
      `&viewer_fid=${viewerFid}`

    const usersRes = await fetch(bulkUrl, {
      headers,
      cache: "no-store",
    })

    if (!usersRes.ok) {
      const text = await usersRes.text().catch(() => "")
      console.error("Neynar user/bulk error", {
        status: usersRes.status,
        body: text,
      })
      throw new Error("Failed to call Neynar user/bulk")
    }

    const usersJson: any = await usersRes.json()
    const users: NeynarBulkUser[] =
      (usersJson.users ?? usersJson.result?.users ?? []) as NeynarBulkUser[]

    const tpc = users.find((u: NeynarBulkUser) => u.fid === PAPERCRANE_FID)
    const star = users.find((u: NeynarBulkUser) => u.fid === STARL3XX_FID)

    const followTPC = !!tpc?.viewer_context?.following
    const followStar = !!star?.viewer_context?.following

    // ---------- 2) channel/user to see if viewer follows /clankton ----------
    const channelUrl =
      "https://api.neynar.com/v2/farcaster/channel/user" +
      `?channel_id=${CLANKTON_CHANNEL_ID}&fid=${viewerFid}`

    const channelRes = await fetch(channelUrl, {
      headers,
      cache: "no-store",
    })

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