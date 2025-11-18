import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

/**
 * POST /api/notifications/register
 *
 * Stores a notification token for a user who has granted permission.
 * Called from the frontend after sdk.actions.requestNotificationPermission()
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid, token, address } = body

    if (!fid || typeof fid !== "number") {
      return NextResponse.json(
        { error: "Invalid FID" },
        { status: 400 }
      )
    }

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    // Store or update the notification token
    await sql`
      INSERT INTO notification_tokens (fid, token, address, updated_at)
      VALUES (${fid}, ${token}, ${address || null}, NOW())
      ON CONFLICT (fid)
      DO UPDATE SET
        token = EXCLUDED.token,
        address = COALESCE(EXCLUDED.address, notification_tokens.address),
        updated_at = NOW()
    `

    console.log("[notifications] Registered token for FID", fid)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[notifications] Failed to register token", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
