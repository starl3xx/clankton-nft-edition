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
    const headers: Record<string, string> = {
      "x-api-key": NEYNAR_API_KEY,
      accept: "application/json",
    }

    // 1) User follows (TPC + Star) via user/bulk + viewer_fid
    const bulkUrl = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${PAPERCRANE_FID},${STARL3XX_FID}&viewer_fid=${fid}`
    const bulkRes = await fetch(bulkUrl, {
      headers,
      cache: "no-store",
    })

    if (!bulkRes.ok) {
      const text = await bulkRes.text().catch(() => "")
      console.error("Neynar user/bulk error", {
        status: bulkRes.status,
        body: text,
      })
      return NextResponse.json(
        { error: "Neynar user/bulk error", status: bulkRes.status, body: text },
        { status: 500 },
      )
    }

    const bulkJson: any = await bulkRes.json()
    const users: any[] =
      bulkJson.users ?? bulkJson.result?.users ?? []

    const tpcUser = users.find((u) => u.fid === PAPERCRANE_FID)
    const starUser = users.find((u) => u.fid === STARL3XX_FID)

    const followTPC = !!(
      tpcUser?.viewer_context?.following ??
      tpcUser?.viewerContext?.following
    )
    const followStar = !!(
      starUser?.viewer_context?.following ??
      starUser?.viewerContext?.following
    )

    // 2) Channel follow via /channel?id=...&viewer_fid=...
    const channelUrl = `https://api.neynar.com/v2/farcaster/channel?id=${CLANKTON_CHANNEL_ID}&viewer_fid=${fid}`
    const channelRes = await fetch(channelUrl, {
      headers,
      cache: "no-store",
    })

    let followChannel = false

    if (channelRes.ok) {
      const channelJson: any = await channelRes.json()

      // Safely probe multiple possible shapes
      const vc =
        channelJson.viewer_context ??
        channelJson.channel?.viewer_context ??
        channelJson.result?.viewer_context ??
        channelJson.result?.channel?.viewer_context

      followChannel = !!vc?.following
    } else {
      const text = await channelRes.text().catch(() => "")
      console.error("Neynar channel error", {
        status: channelRes.status,
        body: text,
      })
      // we just treat channel as not-followed on error rather than failing the whole request
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