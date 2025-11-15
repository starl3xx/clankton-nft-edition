// app/api/farcaster/follows/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getViewerFollowStatus } from "@/lib/farcaster"

export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid")
  const viewerFid = fidParam ? Number(fidParam) : NaN

  if (!fidParam || Number.isNaN(viewerFid)) {
    return NextResponse.json(
      { error: "Missing or invalid fid" },
      { status: 400 },
    )
  }

  try {
    const { followTPC, followStar, followChannel } =
      await getViewerFollowStatus(viewerFid)

    return NextResponse.json({
      followTPC,
      followStar,
      followChannel,
    })
  } catch (err) {
    console.error(
      "[api/farcaster/follows] error",
      JSON.stringify({ viewerFid, err }, null, 2),
    )

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}