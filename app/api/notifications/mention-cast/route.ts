import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

export const runtime = "nodejs"

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY as string

// Your FID to post from (starl3xx.eth = 6500)
const POSTER_FID = 6500

/**
 * POST /api/notifications/mention-cast
 *
 * Fetches all FIDs who secured discounts, looks up their usernames,
 * and either generates cast text or posts casts mentioning them.
 *
 * Query params:
 *   ?dry_run=true  - Just return the cast text, don't post
 *   ?post=true     - Actually post the casts via Neynar
 *
 * Requires admin secret for security.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get("authorization")
    const adminSecret = process.env.ADMIN_SECRET

    if (!adminSecret) {
      return NextResponse.json(
        { error: "Admin secret not configured" },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: "Neynar API key not configured" },
        { status: 500 }
      )
    }

    const url = new URL(req.url)
    const dryRun = url.searchParams.get("dry_run") === "true"
    const shouldPost = url.searchParams.get("post") === "true"

    // 1. Get distinct FIDs from discount actions
    const result = await sql`
      SELECT DISTINCT fid
      FROM clankton_discount_actions
      WHERE fid IS NOT NULL
    `

    const fids = result.rows
      .map((row) => parseInt(row.fid))
      .filter((fid) => !isNaN(fid) && fid > 0)

    if (fids.length === 0) {
      return NextResponse.json({
        message: "No users with discounts found",
        fids: [],
        casts: [],
      })
    }

    // 2. Look up usernames via Neynar bulk endpoint
    const usernames: string[] = []

    // Neynar allows up to 100 FIDs per request
    const batchSize = 100
    for (let i = 0; i < fids.length; i += batchSize) {
      const batch = fids.slice(i, i + batchSize)
      const neynarRes = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${batch.join(",")}`,
        {
          headers: {
            "x-api-key": NEYNAR_API_KEY,
            accept: "application/json",
          },
        }
      )

      if (!neynarRes.ok) {
        console.error("[mention-cast] Neynar error:", await neynarRes.text())
        continue
      }

      const data = await neynarRes.json()
      for (const user of data.users || []) {
        if (user.username) {
          usernames.push(user.username)
        }
      }
    }

    // 3. Generate cast batches (aim for ~5-8 mentions per cast to stay under 320 chars)
    const castTemplate = `🎉 The Clankton Town mint is LIVE!

Your discounts are locked in 🔒

MENTIONS

Mint now 👇
https://warpcast.com/starl3xx.eth/0x01bfe832`

    const mentionsPerCast = 6
    const casts: string[] = []

    for (let i = 0; i < usernames.length; i += mentionsPerCast) {
      const batch = usernames.slice(i, i + mentionsPerCast)
      const mentions = batch.map((u) => `@${u}`).join(" ")
      const castText = castTemplate.replace("MENTIONS", mentions)

      // Farcaster limit is 320 chars
      if (castText.length <= 320) {
        casts.push(castText)
      } else {
        // If too long, split into smaller batches
        const smallerBatch = batch.slice(0, 4)
        const smallerMentions = smallerBatch.map((u) => `@${u}`).join(" ")
        casts.push(castTemplate.replace("MENTIONS", smallerMentions))
      }
    }

    // 4. If dry run, just return the casts
    if (dryRun || !shouldPost) {
      return NextResponse.json({
        message: `Generated ${casts.length} cast(s) for ${usernames.length} users`,
        fids,
        usernames,
        casts,
        instructions: "Add ?post=true to actually send these casts",
      })
    }

    // 5. Post casts via Neynar
    // Note: You need a signer_uuid for the posting account
    const signerUuid = process.env.NEYNAR_SIGNER_UUID
    if (!signerUuid) {
      return NextResponse.json({
        error: "NEYNAR_SIGNER_UUID not configured - cannot post casts",
        casts,
        instructions: "Set NEYNAR_SIGNER_UUID env var or post these manually",
      }, { status: 500 })
    }

    const postedCasts: string[] = []
    const errors: string[] = []

    for (const castText of casts) {
      try {
        const castRes = await fetch("https://api.neynar.com/v2/farcaster/cast", {
          method: "POST",
          headers: {
            "x-api-key": NEYNAR_API_KEY,
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            text: castText,
          }),
        })

        if (!castRes.ok) {
          const errText = await castRes.text()
          errors.push(`Failed to post cast: ${errText}`)
        } else {
          const castData = await castRes.json()
          postedCasts.push(castData.cast?.hash || "posted")
        }

        // Small delay between casts to avoid rate limits
        await new Promise((r) => setTimeout(r, 1000))
      } catch (err) {
        errors.push(`Cast error: ${err}`)
      }
    }

    return NextResponse.json({
      message: `Posted ${postedCasts.length}/${casts.length} casts`,
      postedCasts,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error("[mention-cast] Error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
