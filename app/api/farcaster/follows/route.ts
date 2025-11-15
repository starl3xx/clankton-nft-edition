// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500
const CLANKTON_CHANNEL_ID = "clankton"

export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid")
  const viewerFid = fidParam ? Number(fidParam) : NaN

  if (!fidParam || Number.isNaN(viewerFid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid" },
      { status: 400 }
    )
  }

  if (!NEYNAR_API_KEY) {
    return NextResponse.json(
      { error: "Missing NEYNAR_API_KEY" },
      { status: 500 }
    )
  }

  const headers = {
    "api_key": NEYNAR_API_KEY,
    "Content-Type": "application/json",
  }

  try {
    // ------------------------------------------------------------
    // 1) Use the ONLY endpoint that returns viewer follow context
    // ------------------------------------------------------------
    const bulkUrl =
      `https://api.neynar.com/v2/farcaster/user/bulk-by-viewer` +
      `?viewer_fid=${viewerFid}` +
      `&fids=${PAPERCRANE_FID},${STARL3XX_FID}`

    const usersRes = await fetch(bulkUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    if (!usersRes.ok) {
      const text = await usersRes.text().catch(() => "")
      console.error("[follows] bulk-by-viewer failed", {
        status: usersRes.status,
        text,
      })
      throw new Error("bulk-by-viewer failed")
    }

    const usersJson = await usersRes.json()
    const users = usersJson.users ?? []

    const tpc = users.find(u => u.fid === PAPERCRANE_FID)
    const star = users.find(u => u.fid === STARL3XX_FID)

    const followTPC = tpc?.viewer_context?.following === true
    const followStar = star?.viewer_context?.following === true

    // ------------------------------------------------------------
    // 2) Channel follow detection
    // ------------------------------------------------------------
    const channelUrl =
      `https://api.neynar.com/v2/farcaster/channel` +
      `?channel_id=${CLANKTON_CHANNEL_ID}` +
      `&viewer_fid=${viewerFid}`

    const channelRes = await fetch(channelUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    let followChannel = false

    if (channelRes.ok) {
      const channelJson = await channelRes.json()
      followChannel =
        channelJson.viewer_context?.following === true ||
        channelJson.result?.viewer_context?.following === true
    }

    // ------------------------------------------------------------
    // Return final result
    // ------------------------------------------------------------
    return NextResponse.json({
      followTPC,
      followStar,
      followChannel,
    })
  } catch (err) {
    console.error("FOLLOW ROUTE ERROR", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}