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
    console.error("Missing NEYNAR_API_KEY env var")
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    )
  }

  const headers = {
    "api_key": NEYNAR_API_KEY,
    "content-type": "application/json",
  }

  async function fetchUserFollow(targetFid: number): Promise<boolean> {
    const url = new URL("https://api.neynar.com/v2/farcaster/user")
    url.searchParams.set("fid", String(targetFid))
    url.searchParams.set("viewer_fid", String(viewerFid))

    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error(
        "Neynar /user error",
        res.status,
        text,
        "for targetFid",
        targetFid,
        "viewerFid",
        viewerFid,
      )
      return false
    }

    const json: any = await res.json()

    // Neynar can return either `viewer_context` at top-level or under `result`
    const viewerCtx =
      json.viewer_context ??
      json.result?.viewer_context ??
      json.user?.viewer_context

    const following = !!viewerCtx?.following
    console.log(
      "Neynar /user follow check",
      "targetFid=",
      targetFid,
      "viewerFid=",
      viewerFid,
      "following=",
      following,
    )

    return following
  }

  async function fetchChannelFollow(): Promise<boolean> {
    const url = new URL(
      "https://api.neynar.com/v2/farcaster/channel/user",
    )
    url.searchParams.set("fid", String(viewerFid))
    url.searchParams.set("channel_id", CLANKTON_CHANNEL_ID)

    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error(
        "Neynar /channel/user error",
        res.status,
        text,
        "viewerFid",
        viewerFid,
      )
      return false
    }

    const json: any = await res.json()

    // Cover the common shapes
    const followChannel =
      !!json.is_following ||
      !!json.result?.is_following ||
      !!json.result?.channel?.following

    console.log(
      "Neynar /channel/user follow check",
      "viewerFid=",
      viewerFid,
      "followChannel=",
      followChannel,
    )

    return followChannel
  }

  try {
    const [followTPC, followStar, followChannel] = await Promise.all([
      fetchUserFollow(PAPERCRANE_FID),
      fetchUserFollow(STARL3XX_FID),
      fetchChannelFollow(),
    ])

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