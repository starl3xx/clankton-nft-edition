// lib/farcaster.ts
import "server-only"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!
const TPC_FID = 249958
const STAR_FID = 6500
const CHANNEL_ID = "clankton"

export async function getViewerFollowStatus(viewerFid: number) {
  if (!NEYNAR_API_KEY) {
    throw new Error("Missing NEYNAR_API_KEY")
  }

  // ---- 1) Check if viewer follows @thepapercrane ----
  const followTPC = await checkUserFollows(viewerFid, TPC_FID)

  // ---- 2) Check if viewer follows @starl3xx ----
  const followStar = await checkUserFollows(viewerFid, STAR_FID)

  // ---- 3) Check if viewer is a member/follower of /clankton ----
  const followChannel = await checkChannelMembership(viewerFid, CHANNEL_ID)

  return { followTPC, followStar, followChannel }
}

/* ---------------------------------------------
   USER FOLLOW CHECK
------------------------------------------------ */
async function checkUserFollows(viewerFid: number, targetFid: number) {
  const url =
    `https://api.neynar.com/v2/farcaster/user/following` +
    `?fid=${viewerFid}&target_fid=${targetFid}`

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": NEYNAR_API_KEY },
      cache: "no-store",
    })

    if (!res.ok) {
      console.error("[farcaster] follow user error", res.status, await safeText(res))
      return false
    }

    const json = await res.json()
    // Neynar uses: { result: { following: boolean } }
    return json?.result?.following === true
  } catch (err) {
    console.error("[farcaster] follow user catch", err)
    return false
  }
}

/* ---------------------------------------------
   CHANNEL MEMBERSHIP CHECK
------------------------------------------------ */
async function checkChannelMembership(viewerFid: number, channelId: string) {
  const url =
    `https://api.neynar.com/v2/farcaster/channel/user` +
    `?id=${channelId}&fid=${viewerFid}`

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": NEYNAR_API_KEY },
      cache: "no-store",
    })

    if (!res.ok) {
      console.error("[farcaster] channel error", res.status, await safeText(res))
      return false
    }

    const json = await res.json()

    console.log("[farcaster] channel raw json:", JSON.stringify(json))

    // Support BOTH shapes Neynar uses:
    //
    // 1. { result: { is_member: true, is_follower: true } }
    // 2. { is_member: true } (older beta)
    //
    return (
      json?.result?.is_member === true ||
      json?.result?.is_follower === true ||
      json?.is_member === true ||
      json?.is_follower === true
    )
  } catch (err) {
    console.error("[farcaster] channel catch", err)
    return false
  }
}

/* Utility to safely extract text */
async function safeText(res: Response) {
  try {
    return await res.text()
  } catch {
    return ""
  }
}