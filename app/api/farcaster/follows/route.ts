// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

// FIDs we care about
const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500
const CLANKTON_CHANNEL_ID = "clankton"

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
    console.error("[follows] Missing NEYNAR_API_KEY env var")
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    )
  }

  const headers = {
    "api_key": NEYNAR_API_KEY,
    "Content-Type": "application/json",
  }

  try {
    // ---------- 1) Fetch follow status for @thepapercrane + @starl3xx.eth ----------
    // Uses viewer_fid so Neynar returns viewer_context.following for each user
    const bulkUrl =
      `https://api.neynar.com/v2/farcaster/user/bulk` +
      `?fids=${PAPERCRANE_FID},${STARL3XX_FID}` +
      `&viewer_fid=${viewerFid}`

    const usersRes = await fetch(bulkUrl, {
      headers,
      cache: "no-store",
    })

    if (!usersRes.ok) {
      const text = await usersRes.text().catch(() => "")
      console.error("[follows] Neynar user/bulk error", {
        status: usersRes.status,
        body: text,
      })
      throw new Error("Failed to fetch bulk user data")
    }

    const usersJson: any = await usersRes.json()
    const users: any[] = usersJson.users ?? usersJson.result?.users ?? []

    const tpcUser = users.find((u) => u.fid === PAPERCRANE_FID)
    const starUser = users.find((u) => u.fid === STARL3XX_FID)

    const followTPC =
      tpcUser?.viewer_context?.following === true ||
      tpcUser?.viewer_context?.followed_back === true

    const followStar =
      starUser?.viewer_context?.following === true ||
      starUser?.viewer_context?.followed_back === true

    // ---------- 2) Fetch follow status for /clankton channel ----------
    const channelUrl =
      `https://api.neynar.com/v2/farcaster/channel` +
      `?channel_id=${CLANKTON_CHANNEL_ID}` +
      `&viewer_fid=${viewerFid}`

    const channelRes = await fetch(channelUrl, {
      headers,
      cache: "no-store",
    })

    let followChannel = false

    if (channelRes.ok) {
      const channelJson: any = await channelRes.json()
      const viewerCtx =
        channelJson.viewer_context ??
        channelJson.result?.viewer_context ??
        channelJson.result?.channel?.viewer_context

      followChannel = viewerCtx?.following === true
    } else {
      const text = await channelRes.text().catch(() => "")
      console.error("[follows] Neynar channel error", {
        status: channelRes.status,
        body: text,
      })
      // we intentionally do NOT throw here; we just treat channel follow as false
    }

    return NextResponse.json({
      followTPC: !!followTPC,
      followStar: !!followStar,
      followChannel: !!followChannel,
    })
  } catch (err) {
    console.error("/api/farcaster/follows error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}