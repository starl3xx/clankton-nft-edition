// lib/farcaster.ts
import "server-only"

const NEYNAR_API_BASE = "https://api.neynar.com/v2"
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY

// Farcaster FIDs we care about
const PAPERCRANE_FID = 249958
const STARL3XX_FID = 6500

if (!NEYNAR_API_KEY) {
  // Fail fast on the server if misconfigured
  console.error("[farcaster] NEYNAR_API_KEY is not set")
}

type NeynarUser = {
  fid: number
  viewer_context?: {
    following?: boolean
    followed_by?: boolean
    blocking?: boolean
    blocked_by?: boolean
  }
}

type NeynarUserBulkResponse = {
  users?: NeynarUser[]
}

type NeynarChannelUserResponse = {
  user?: {
    is_member?: boolean
    role?: string
  }
  // some older shapes might put this at top-level
  is_member?: boolean
}

/**
 * Low-level Neynar GET helper.
 */
async function neynarGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    search.set(k, String(v))
  }

  const url = `${NEYNAR_API_BASE}${path}?${search.toString()}`
  const res = await fetch(url, {
    method: "GET",
    headers: {
      // Neynar expects this header name exactly
      api_key: NEYNAR_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    // Always hit the live Neynar API, never ISR cache
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.error("[farcaster] Neynar non-OK response", {
      path,
      status: res.status,
      body: text.slice(0, 500),
    })
    throw new Error(`Neynar error ${res.status} for ${path}`)
  }

  return (await res.json()) as T
}

/**
 * Returns whether `viewerFid`:
 *  - follows @thepapercrane
 *  - follows @starl3xx.eth
 *  - is a member of /clankton
 */
export async function getViewerFollowStatus(viewerFid: number) {
  if (!NEYNAR_API_KEY) {
    // Hard fail rather than silently returning false for everything
    throw new Error("NEYNAR_API_KEY is not configured")
  }

  // ---- 1. User follows via /user/bulk + viewer_context ---------------------

  const bulk = await neynarGet<NeynarUserBulkResponse>(
    "/farcaster/user/bulk",
    {
      // we only need the 2 accounts to check viewer_context.following
      fids: `${PAPERCRANE_FID},${STARL3XX_FID}`,
      viewer_fid: viewerFid,
    },
  )

  const users = bulk.users ?? []

  const tpc = users.find((u) => u.fid === PAPERCRANE_FID)
  const star = users.find((u) => u.fid === STARL3XX_FID)

  const followTPC = !!tpc?.viewer_context?.following
  const followStar = !!star?.viewer_context?.following

  console.log("[farcaster] bulk follow status", {
    viewerFid,
    tpcFid: PAPERCRANE_FID,
    tpcFollowing: tpc?.viewer_context?.following ?? null,
    starFid: STARL3XX_FID,
    starFollowing: star?.viewer_context?.following ?? null,
  })

  // ---- 2. Channel membership via /channel/user -----------------------------

  let followChannel = false

  try {
    const channel = await neynarGet<NeynarChannelUserResponse>(
      "/farcaster/channel/user",
      {
        channel_id: "clankton",
        fid: viewerFid,
      },
    )

    const isMember =
      channel.user?.is_member ??
      channel.is_member ??
      false

    followChannel = !!isMember

    console.log("[farcaster] channel user status", {
      viewerFid,
      channel: "clankton",
      isMember,
      raw: {
        hasUser: !!channel.user,
        userRole: channel.user?.role ?? null,
      },
    })
  } catch (err) {
    console.error("[farcaster] channel user lookup failed", {
      viewerFid,
      channel: "clankton",
      err,
    })
    // swallow error – app should still work for account follows
  }

  return {
    followTPC,
    followStar,
    followChannel,
  }
}