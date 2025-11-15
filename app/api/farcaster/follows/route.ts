// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

// FIDs we care about
const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500
const CLANKTON_CHANNEL_ID = "clankton"

type NeynarUserResponse = {
  user?: any
  result?: { user?: any }
}

async function checkUserFollowing(
  targetFid: number,
  viewerFid: number,
  headers: Record<string, string>,
): Promise<boolean> {
  const url = `https://api.neynar.com/v2/farcaster/user?fid=${targetFid}&viewer_fid=${viewerFid}`

  const res = await fetch(url, {
    headers,
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    console.error("Neynar /user error", res.status, body)
    throw new Error("Failed Neynar user request")
  }

  const json = (await res.json()) as NeynarUserResponse
  const user = json.user ?? json.result?.user
  const following = !!user?.viewer_context?.following

  return following
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
    // Do NOT 500 the client – just say “no follows”
    return NextResponse.json({
      followTPC: false,
      followStar: false,
      followChannel: false,
      error: "Server not configured",
    })
  }

  const headers = { "api-key": NEYNAR_API_KEY }

  let followTPC = false
  let followStar = false
  let followChannel = false

  try {
    // 1) Does viewer follow @thepapercrane?
    try {
      followTPC = await checkUserFollowing(PAPERCRANE_FID, fid, headers)
    } catch (e) {
      console.error("checkUserFollowing PAPERCRANE_FID failed", e)
    }

    // 2) Does viewer follow @starl3xx.eth?
    try {
      followStar = await checkUserFollowing(STARL3XX_FID, fid, headers)
    } catch (e) {
      console.error("checkUserFollowing STARL3XX_FID failed", e)
    }

    // 3) Is viewer following the /clankton channel?
    try {
      const channelUrl = `https://api.neynar.com/v2/farcaster/channel/user?fid=${fid}&channel_id=${CLANKTON_CHANNEL_ID}`

      const channelRes = await fetch(channelUrl, {
        headers,
        cache: "no-store",
      })

      if (channelRes.ok) {
        const channelJson: any = await channelRes.json()
        followChannel =
          !!channelJson.is_following ||
          !!channelJson.result?.is_following ||
          !!channelJson.result?.channel?.following
      } else {
        const body = await channelRes.text().catch(() => "")
        console.error("Neynar channel/user error", channelRes.status, body)
      }
    } catch (e) {
      console.error("check channel/user failed", e)
    }

    // Always return 200 – errors are encoded in the booleans/logs
    return NextResponse.json({
      followTPC,
      followStar,
      followChannel,
    })
  } catch (err) {
    console.error("/api/farcaster/follows unexpected error", err)
    // Final safety net – still 200 with all-false so UI doesn’t break
    return NextResponse.json({
      followTPC: false,
      followStar: false,
      followChannel: false,
    })
  }
}