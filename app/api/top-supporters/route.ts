// app/api/top-supporters/route.ts
import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { apiError } from "@/lib/api"

export const runtime = "nodejs"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY as string
const NEYNAR_BASE_URL = "https://api.neynar.com"

type NeynarUser = {
  fid: number
  username: string
}

type NeynarBulkUserResponse = {
  users: NeynarUser[]
}

async function getUsernamesByFids(fids: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>()

  if (fids.length === 0) return result

  // Neynar bulk endpoint accepts up to 100 FIDs at a time
  const chunks: number[][] = []
  for (let i = 0; i < fids.length; i += 100) {
    chunks.push(fids.slice(i, i + 100))
  }

  for (const chunk of chunks) {
    try {
      const url = new URL("/v2/farcaster/user/bulk", NEYNAR_BASE_URL)
      url.searchParams.set("fids", chunk.join(","))

      const res = await fetch(url.toString(), {
        headers: {
          "x-api-key": NEYNAR_API_KEY,
          accept: "application/json",
        },
      })

      if (!res.ok) {
        console.error("[top-supporters] Neynar error", res.status)
        continue
      }

      const data = (await res.json()) as NeynarBulkUserResponse

      for (const user of data.users ?? []) {
        if (user.fid && user.username) {
          result.set(user.fid, user.username)
        }
      }
    } catch (err) {
      console.error("[top-supporters] Failed to fetch chunk", err)
    }
  }

  return result
}

export async function GET(req: NextRequest) {
  // Optional: require a secret to prevent public access
  const secret = req.nextUrl.searchParams.get("secret")
  const expectedSecret = process.env.ADMIN_SECRET

  if (expectedSecret && secret !== expectedSecret) {
    return apiError("UNAUTHORIZED", "Invalid or missing secret", 401)
  }

  const minActions = parseInt(req.nextUrl.searchParams.get("min") ?? "3", 10)

  try {
    // Query FIDs with at least N distinct actions
    const result = await sql<{ fid: string }>`
      SELECT fid
      FROM clankton_discount_actions
      WHERE fid IS NOT NULL
      GROUP BY fid
      HAVING COUNT(DISTINCT action) >= ${minActions};
    `

    const fids = result.rows
      .map((r) => parseInt(r.fid, 10))
      .filter((fid) => !isNaN(fid) && fid > 0)

    if (fids.length === 0) {
      return NextResponse.json({
        count: 0,
        usernames: [],
        formatted: "",
        message: `No users found with ${minActions}+ actions`,
      })
    }

    // Look up usernames via Neynar
    const usernameMap = await getUsernamesByFids(fids)

    const usernames = fids
      .map((fid) => usernameMap.get(fid))
      .filter((u): u is string => !!u)
      .sort()

    // Format for easy copy/paste into a cast
    const formatted = usernames.map((u) => `@${u}`).join(" ")

    return NextResponse.json({
      count: usernames.length,
      minActions,
      usernames,
      formatted,
    })
  } catch (err) {
    console.error("[top-supporters] DB error", err)
    return apiError("INTERNAL_ERROR", "Failed to fetch supporters", 500)
  }
}
