// app/api/register-discount-action/route.ts
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type DiscountAction =
  | "cast"
  | "tweet"
  | "follow_tpc"
  | "follow_star"
  | "follow_channel"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    console.log("[register-discount-action] raw body:", body)

    const address = typeof body?.address === "string" ? body.address : null
    const action = body?.action as DiscountAction | undefined

    if (!address || !action) {
      console.warn(
        "[register-discount-action] missing address or action",
        { address, action },
      )
      return NextResponse.json(
        { error: "Missing address or action", received: body },
        { status: 400 },
      )
    }

    // No DB here — just echo back what we received
    return NextResponse.json({
      ok: true,
      address,
      action,
    })
  } catch (err) {
    console.error("[register-discount-action] unexpected error", err)
    return NextResponse.json(
      {
        error: "Internal error",
        // keep this for debugging only; remove in production
        details: (err as Error).message,
      },
      { status: 500 },
    )
  }
}