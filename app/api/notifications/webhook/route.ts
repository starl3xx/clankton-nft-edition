import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/notifications/webhook
 *
 * Farcaster calls this endpoint to get notification content for each user.
 * This is called when you trigger notifications via the Farcaster API.
 *
 * Request body from Farcaster:
 * {
 *   "notificationId": "string",
 *   "fid": number,
 *   "token": "string"
 * }
 *
 * Response format:
 * {
 *   "title": "string",
 *   "body": "string",
 *   "targetUrl": "string (optional)",
 *   "tokens": ["string"] (array of tokens to send to)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { notificationId, fid, token } = body

    console.log("[notifications webhook] Received request", {
      notificationId,
      fid,
    })

    // Define notification content based on notification type
    // You can customize this based on the notificationId or user data
    const notification = {
      title: "🎉 CLANKTON Mint is LIVE!",
      body: "The thepapercrane × $CLANKTON NFT mint is now live! Your discounts are ready.",
      targetUrl: "https://clankton-nft-edition.vercel.app",
      tokens: [token], // Send to this specific user's token
    }

    return NextResponse.json(notification)
  } catch (err) {
    console.error("[notifications webhook] Error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
