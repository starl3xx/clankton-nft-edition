import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

/**
 * POST /api/notifications/trigger
 *
 * Triggers notifications to all users who have:
 * 1. Granted notification permission (have a token)
 * 2. Logged any discount actions
 *
 * This should be called when the mint goes live.
 *
 * Requires an admin secret for security.
 */
export async function POST(req: NextRequest) {
  try {
    // Basic auth check - you should use a secure secret
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

    const body = await req.json()
    const { notificationType = "mint_live" } = body

    // Get all users who have:
    // 1. A notification token (opted in)
    // 2. At least one discount action logged
    const eligibleUsers = await sql`
      SELECT DISTINCT nt.fid, nt.token
      FROM notification_tokens nt
      INNER JOIN clankton_discount_actions cda
        ON nt.fid::TEXT = cda.fid OR nt.address = cda.address
      WHERE NOT EXISTS (
        SELECT 1 FROM sent_notifications sn
        WHERE sn.fid = nt.fid
        AND sn.notification_type = ${notificationType}
      )
    `

    if (eligibleUsers.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible users to notify",
        count: 0,
      })
    }

    console.log(
      `[notifications trigger] Found ${eligibleUsers.rows.length} eligible users`
    )

    // Send notifications via Farcaster API
    const neynarApiKey = process.env.NEYNAR_API_KEY
    if (!neynarApiKey) {
      return NextResponse.json(
        { error: "Neynar API key not configured" },
        { status: 500 }
      )
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://clankton-nft-edition.vercel.app"}/api/notifications/webhook`

    // Send batch notification request to Farcaster/Neynar
    const notificationPromises = eligibleUsers.rows.map(async (user) => {
      try {
        const response = await fetch(
          "https://api.neynar.com/v2/farcaster/notifications",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": neynarApiKey,
            },
            body: JSON.stringify({
              fid: user.fid,
              token: user.token,
              title: "🎉 CLANKTON Mint is LIVE!",
              body: "The thepapercrane × $CLANKTON NFT mint is now live! Your discounts are ready.",
              targetUrl: webhookUrl,
            }),
          }
        )

        if (!response.ok) {
          console.error(
            `[notifications] Failed to send to FID ${user.fid}:`,
            await response.text()
          )
          return { fid: user.fid, success: false }
        }

        // Mark as sent
        await sql`
          INSERT INTO sent_notifications (fid, notification_type)
          VALUES (${user.fid}, ${notificationType})
          ON CONFLICT (fid, notification_type) DO NOTHING
        `

        return { fid: user.fid, success: true }
      } catch (err) {
        console.error(
          `[notifications] Error sending to FID ${user.fid}:`,
          err
        )
        return { fid: user.fid, success: false }
      }
    })

    const results = await Promise.all(notificationPromises)
    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Sent notifications to ${successCount}/${eligibleUsers.rows.length} users`,
      totalEligible: eligibleUsers.rows.length,
      sent: successCount,
      failed: eligibleUsers.rows.length - successCount,
    })
  } catch (err) {
    console.error("[notifications trigger] Error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
      )
  }
}
