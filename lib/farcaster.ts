// lib/farcaster.ts
import "server-only"

// ---- Neynar base config --------------------------------------------

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY as string
const NEYNAR_BASE_URL = "https://api.neynar.com"

if (!NEYNAR_API_KEY) {
  throw new Error(
    "[farcaster] NEYNAR_API_KEY is not set. Add it to your environment.",
  )
}

type NeynarFetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>
}

/**
 * Low-level Neynar fetch helper.
 * - Always server-side
 * - Always JSON
 * - Caching controlled via `options.next` / `options.cache`
 */
async function neynarFetch<T>(
  path: string, // either "/v2/..." or full URL
  options: NeynarFetchOptions = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${NEYNAR_BASE_URL}${path}`

  const baseHeaders: Record<string, string> = {
    "x-api-key": NEYNAR_API_KEY,
    accept: "application/json",
  }

  const mergedHeaders: Record<string, string> = {
    ...baseHeaders,
    ...(options.headers ?? {}),
  }

  const { headers: _ignored, ...rest } = options

  const res = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.error("[farcaster][neynarFetch] non-OK response", {
      url,
      status: res.status,
      body: text,
    })
    throw new Error(`Neynar error ${res.status} for ${url}`)
  }

  return (await res.json()) as T
}

/**
 * GET helper for Neynar v2 with query params and short-TTL caching.
 *
 * - Attaches `/v2` prefix
 * - Adds a small revalidate window so repeated requests are cheap
 */
async function neynarGet<T>(
  path: string,
  params: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`/v2${path}`, NEYNAR_BASE_URL)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  // 30s cache window per unique URL
  return neynarFetch<T>(url.pathname + url.search, {
    method: "GET",
    next: { revalidate: 30 },
  })
}

// ---- Hard-coded constants for your app ------------------------------

const PAPERCRANE_FID = 249_958
const STARL3XX_FID = 6_500
const CLANKTON_CHANNEL_ID = "clankton" as const

// ---- Types ---------------------------------------------------------

type NeynarBulkUser = {
  fid: number
  viewer_context?: {
    following?: boolean
  }
}

type NeynarBulkUserResponse = {
  users: NeynarBulkUser[]
}

type NeynarChannelUser = {
  id: string
}

type NeynarChannelUserResponse = {
  channels: NeynarChannelUser[]
}

export type ViewerFollowStatus = {
  followTPC: boolean
  followStar: boolean
  followChannel: boolean
}

// ---- Internal helpers ----------------------------------------------

/**
 * Validate a Farcaster FID from untrusted input.
 * Throws if invalid.
 */
function assertValidFid(fid: number, label: string = "fid"): void {
  if (
    typeof fid !== "number" ||
    !Number.isFinite(fid) ||
    !Number.isInteger(fid) ||
    fid <= 0 ||
    fid > Number.MAX_SAFE_INTEGER
  ) {
    throw new Error(`Invalid ${label}: ${fid}`)
  }
}

// ---- Public API ----------------------------------------------------

/**
 * Get whether the viewer:
 * - follows @thepapercrane
 * - follows @starl3xx.eth (or IS starl3xx)
 * - is a member of /clankton
 */
export async function getViewerFollowStatus(
  viewerFid: number,
): Promise<ViewerFollowStatus> {
  assertValidFid(viewerFid, "viewerFid")

  // 1) Bulk follow status (viewer → TPC / Star)
  const bulkPromise = neynarGet<NeynarBulkUserResponse>(
    "/farcaster/user/bulk",
    {
      fids: [viewerFid, PAPERCRANE_FID, STARL3XX_FID].join(","),
      viewer_fid: viewerFid,
    },
  )

  // 2) Channel membership for /clankton
  const channelPromise = neynarGet<NeynarChannelUserResponse>(
    "/farcaster/channel/user",
    {
      channel_id: CLANKTON_CHANNEL_ID,
      fid: viewerFid,
    },
  )

  const [bulk, channel] = await Promise.all([bulkPromise, channelPromise])

  const usersByFid = new Map<number, NeynarBulkUser>()
  for (const u of bulk?.users ?? []) {
    if (typeof u?.fid === "number") {
      usersByFid.set(u.fid, u)
    }
  }

  const tpcUser = usersByFid.get(PAPERCRANE_FID)
  const starUser = usersByFid.get(STARL3XX_FID)

  const followTPC = tpcUser?.viewer_context?.following === true

  // Treat "I am starl3xx" as satisfying the follow condition
  const followStar =
    viewerFid === STARL3XX_FID ||
    starUser?.viewer_context?.following === true

  const followChannel =
    Array.isArray(channel?.channels) &&
    channel.channels.some((ch) => ch.id === CLANKTON_CHANNEL_ID)

  console.info("[farcaster] bulk follow status", {
    viewerFid,
    tpcFid: PAPERCRANE_FID,
    tpcFollowing: followTPC,
    starFid: STARL3XX_FID,
    starFollowing: followStar,
  })

  console.info("[farcaster] channel membership", {
    viewerFid,
    channel: CLANKTON_CHANNEL_ID,
    followChannel,
  })

  return {
    followTPC,
    followStar,
    followChannel,
  }
}