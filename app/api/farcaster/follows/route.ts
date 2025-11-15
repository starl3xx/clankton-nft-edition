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

  try {
    const headers = {
      "api-key": NEYNAR_API_KEY,
    }

    // ---- 1) User → user follow relationships via /user/bulk ----
    const bulkUrl = new URL(
      "https://api.neynar.com/v2/farcaster/user/bulk",
    )
    // We care about TPC + STARL3XX
    bulkUrl.searchParams.set(
      "fids",
      [PAPERCRANE_FID, STARL3XX_FID].join(","),
    )
    bulkUrl.searchParams.set("viewer_fid", String(viewerFid))

    const bulkRes = await fetch(bulkUrl.toString(), {
      headers,
      cache: "no-store",
    })

    if (!bulkRes.ok) {
      const text = await bulkRes.text().catch(() => "")
      console.error("Neynar user/bulk error", bulkRes.status, text)
      throw new Error("Failed to fetch user relationships")
    }

    const bulkJson: any = await bulkRes.json()
    const users: any[] = bulkJson.users ?? bulkJson.result?.users ?? []

    const findUser = (fid: number) =>
      users.find((u) => Number(u.fid ?? u.user?.fid) === fid) ?? null

    const tpcUser = findUser(PAPERCRANE_FID)
    const starUser = findUser(STARL3XX_FID)

    const followTPC = !!(
      tpcUser?.viewer_context?.following ??
      tpcUser?.user?.viewer_context?.following
    )

    // If the viewer *is* STARL3XX, treat as following themselves
    const followStar =
      viewerFid === STARL3XX_FID ||
      !!(
        starUser?.viewer_context?.following ??
        starUser?.user?.viewer_context?.following
      )

    // ---- 2) Channel → is viewer following /clankton? ----
    let followChannel = false

    try {
      const channelRes = await fetch(
        `https://api.neynar.com/v2/farcaster/channel/user?fid=${viewerFid}&channel_id=${CLANKTON_CHANNEL_ID}`,
        { headers, cache: "no-store" },
      )

      if (channelRes.ok) {
        const channelJson: any = await channelRes.json()
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
    } catch (e) {
      console.error("Neynar channel/user exception", e)
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