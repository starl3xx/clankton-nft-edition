// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getViewerFollowStatus } from "@/lib/farcaster"
import { rateLimit } from "@/lib/rate-limit"
import { apiError } from "@/lib/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // Basic IP-based rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  try {
    const { isLimited } = await rateLimit({
      key: `follows:${ip}`,
      limit: 30, // 30 requests
      window: 60_000, // per 60 seconds
    })

    if (isLimited) {
      return apiError(
        "FOLLOW_RATE_LIMITED",
        "Too many follow checks, please try again shortly",
        429,
      )
    }
  } catch (e) {
    // If rate limiter itself fails, log but don't block the user
    console.error("[api/farcaster/follows] rateLimit error", e)
  }

  const fidParam = req.nextUrl.searchParams.get("fid")
  const viewerFid = fidParam ? Number(fidParam) : NaN

  if (!fidParam || Number.isNaN(viewerFid) || viewerFid <= 0) {
    return apiError(
      "FOLLOW_INVALID_FID",
      "Missing or invalid Farcaster ID for follow check",
      400,
    )
  }

  try {
    const { followTPC, followStar, followChannel } =
      await getViewerFollowStatus(viewerFid)

    return NextResponse.json(
      {
        followTPC,
        followStar,
        followChannel,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error(
      "[api/farcaster/follows] error",
      JSON.stringify({ viewerFid, err }, null, 2),
    )

    return apiError(
      "FOLLOW_INTERNAL_ERROR",
      "Could not verify your Farcaster follows right now",
      500,
    )
  }
}