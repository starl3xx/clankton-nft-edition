import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

/**
 * POST /api/notifications/trigger
 *
 * Sends notifications to all users who have added the miniapp.
 * Uses Neynar's notification API which handles token management automatically.
 *
 * Requires an admin secret for security.
 */
export async function POST(req: NextRequest) {
  try {
    // Basic auth check
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

    const neynarApiKey = process.env.NEYNAR_API_KEY
    if (!neynarApiKey) {
      return NextResponse.json(
        { error: "Neynar API key not configured" },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { notificationType = "mint_live" } = body

    // Optional: Get FIDs of users who have logged discount actions
    // to only notify engaged users
    const engagedUsers = await sql`
      SELECT DISTINCT fid
      FROM clankton_discount_actions
      WHERE fid IS NOT NULL
    `

    const targetFids = engagedUsers.rows
      .map((row) => parseInt(row.fid))
      .filter((fid) => !isNaN(fid))

    console.log(
      `[notifications trigger] Targeting ${targetFids.length} engaged users (empty = all miniapp users)`
    )

    // Send notification via Neynar's API
    // Empty target_fids array = send to all users who added the miniapp
    const response = await fetch(
      "https://api.neynar.com/v2/farcaster/frame/notifications",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api_key": neynarApiKey,
          accept: "application/json",
        },
        body: JSON.stringify({
          notification: {
            title: "🎉 CLANKTON Mint is LIVE!",
            body: "The thepapercrane × $CLANKTON NFT mint is now live! Your discounts are ready.",
            target_url: "https://clankton-nft-edition.vercel.app",
          },
          target_fids: targetFids.length > 0 ? targetFids : [], // Empty = all users
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[notifications] Neynar API error:", errorText)
      return NextResponse.json(
        { error: "Failed to send notifications", details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    // Track that we sent this notification type
    await sql`
      INSERT INTO sent_notifications (fid, notification_type)
      SELECT DISTINCT fid::BIGINT, ${notificationType}
      FROM clankton_discount_actions
      WHERE fid IS NOT NULL
      ON CONFLICT (fid, notification_type) DO NOTHING
    `

    console.log("[notifications] Successfully sent via Neynar:", result)

    return NextResponse.json({
      success: true,
      message: `Notifications sent to ${targetFids.length > 0 ? targetFids.length : "all"} users`,
      neynarResponse: result,
    })
  } catch (err) {
    console.error("[notifications trigger] Error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
