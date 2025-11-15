const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
const NEYNAR_BASE_URL = "https://api.neynar.com"

if (!NEYNAR_API_KEY) {
  throw new Error("Missing NEYNAR_API_KEY in environment")
}

// Make it explicit for TS
const NEYNAR_HEADERS: Record<string, string> = {
  "x-api-key": NEYNAR_API_KEY,
  accept: "application/json",
}

type ViewerFollowStatus = {
  followTPC: boolean
  followStar: boolean
  followChannel: boolean
}

export async function getViewerFollowStatus(
  viewerFid: number,
): Promise<ViewerFollowStatus> {
  const tpcFid = 249958
  const starFid = 6500
  const channelId = "clankton"

  const bulkUrl =
    `${NEYNAR_BASE_URL}/v2/farcaster/user/bulk` +
    `?fids=${tpcFid},${starFid}&viewer_fid=${viewerFid}`

  const channelUrl =
    `${NEYNAR_BASE_URL}/v2/farcaster/channel/user` +
    `?channel_id=${channelId}&fid=${viewerFid}`

  const [bulkRes, channelRes] = await Promise.all([
    fetch(bulkUrl, { headers: NEYNAR_HEADERS }),
    fetch(channelUrl, { headers: NEYNAR_HEADERS }),
  ])

  if (!bulkRes.ok) {
    const text = await bulkRes.text().catch(() => "")
    console.error("[farcaster] bulk user error", bulkRes.status, text)
    throw new Error("Neynar bulk user error")
  }

  if (!channelRes.ok) {
    const text = await channelRes.text().catch(() => "")
    console.error("[farcaster] channel user error", channelRes.status, text)
    throw new Error("Neynar channel user error")
  }

  const bulkJson: any = await bulkRes.json()
  const channelJson: any = await channelRes.json()

  // ----- user follows (TPC + Star) -----
  const users: any[] = bulkJson?.users ?? []

  const tpc = users.find((u) => u.fid === tpcFid)
  const star = users.find((u) => u.fid === starFid)

  const followTPC = !!tpc?.viewer_context?.following
  const followStar = !!star?.viewer_context?.following

  console.log("[farcaster] bulk follow status", {
    viewerFid,
    tpcFid,
    tpcFollowing: followTPC,
    starFid,
    starFollowing: followStar,
  })

  // ----- channel membership (/clankton) -----
  // New Neynar shape: { channels: [ { id: "clankton", ... }, ... ] }
  console.log(
    "[farcaster] channel user raw",
    JSON.stringify(channelJson, null, 2),
  )

  const channels: any[] = channelJson?.channels ?? []
  const clanktonChannel = channels.find((c) => c?.id === channelId)

  // If there is an entry with id === "clankton", treat that as "is in channel"
  const followChannel = !!clanktonChannel

  console.log("[farcaster] channel user derived", {
    viewerFid,
    channel: channelId,
    inList: !!clanktonChannel,
  })

  return {
    followTPC,
    followStar,
    followChannel,
  }
}