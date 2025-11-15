// lib/farcaster.ts
import "server-only"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster"

// Hard-coded IDs we care about
export const PAPERCRANE_FID = 249958
export const STARL3XX_FID = 6500
export const CLANKTON_CHANNEL_ID = "clankton"

if (!NEYNAR_API_KEY) {
  // Fail fast on the server if the key is missing
  console.error("[farcaster] Missing NEYNAR_API_KEY env var")
}

type NeynarBulkUser = {
  fid: number
  username: string
  viewer_context?: {
    following?: boolean
    followed_by?: boolean
    blocking?: boolean
    blocked_by?: boolean
  }
}

type NeynarBulkResponse = {
  users: NeynarBulkUser[]
}

type NeynarChannelUserResponse = {
  is_following?: boolean
  result?: {
    is_following?: boolean
  }
}

// Simple structured log helper
function log(level: "info" | "error", msg: string, extra?: Record<string, unknown>) {
  const payload = { level, msg, ...extra }
  // Keep it JSON so you can grep/log drain
  console[level === "error" ? "error" : "log"](JSON.stringify(payload))
}

// Generic Neynar fetch with basic caching
async function neynarFetch<T>(
  path: string,
  searchParams: Record<string, string | number>,
): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    qs.set(k, String(v))
  }

  const url = `${NEYNAR_BASE}/${path}?${qs.toString()}`
  log("info", "[farcaster] neynarFetch", { url })

  const res = await fetch(url, {
    headers: {
      "x-api-key": NEYNAR_API_KEY ?? "",
    },
    // Cache per URL for 60s on the server
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    log("error", "[farcaster] Neynar error", {
      url,
      status: res.status,
      body,
    })
    throw new Error(`Neynar ${path} failed with ${res.status}`)
  }

  return (await res.json()) as T
}

/**
 * For a given viewer fid, return whether they:
 *  - follow @thepapercrane
 *  - follow @starl3xx
 *  - follow /clankton channel
 */
export async function getViewerFollowStatus(viewerFid: number) {
  if (!viewerFid || Number.isNaN(viewerFid)) {
    throw new Error("Invalid viewerFid passed to getViewerFollowStatus")
  }

  // 1) Bulk user for TPC + Star, with viewer_fid context
  const bulk = await neynarFetch<NeynarBulkResponse>("user/bulk", {
    fids: `${PAPERCRANE_FID},${STARL3XX_FID}`,
    viewer_fid: viewerFid,
  })

  const tpc = bulk.users.find((u) => u.fid === PAPERCRANE_FID)
  const star = bulk.users.find((u) => u.fid === STARL3XX_FID)

  const followTPC = !!tpc?.viewer_context?.following
  const followStar = !!star?.viewer_context?.following

  // 2) Channel follows for /clankton
  const channel = await neynarFetch<NeynarChannelUserResponse>("channel/user", {
    fid: viewerFid,
    channel_id: CLANKTON_CHANNEL_ID,
  })

  const followChannel =
    !!channel.is_following || !!channel.result?.is_following

  log("info", "[farcaster] getViewerFollowStatus result", {
    viewerFid,
    followTPC,
    followStar,
    followChannel,
  })

  return { followTPC, followStar, followChannel }
}

/**
 * Generic bulk follow status for arbitrary fids
 * Used by optional POST /follow-status batch endpoint
 */
export async function getBulkFollowStatus(
  viewerFid: number,
  targetFids: number[],
) {
  const bulk = await neynarFetch<NeynarBulkResponse>("user/bulk", {
    fids: targetFids.join(","),
    viewer_fid: viewerFid,
  })

  return bulk.users.map((u) => ({
    fid: u.fid,
    following: !!u.viewer_context?.following,
    followed_by: !!u.viewer_context?.followed_by,
  }))
}