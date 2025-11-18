// app/api/register-discount-action/route.ts
import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { apiError } from "@/lib/api"

export const runtime = "nodejs"

type Action =
  | "cast"
  | "recast"
  | "tweet"
  | "follow_tpc"
  | "follow_star"
  | "follow_channel"

type DbRow = {
  casted: boolean | null
  recast: boolean | null
  tweeted: boolean | null
  follow_tpc: boolean | null
  follow_star: boolean | null
  follow_channel: boolean | null
}

// Fetch current summary row
async function getSummaryRow(address: string): Promise<DbRow | null> {
  const result = await sql<DbRow>`
    SELECT casted, recast, tweeted, follow_tpc, follow_star, follow_channel
    FROM clankton_discounts
    WHERE address = ${address}
    LIMIT 1;
  `
  return result.rows[0] ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    const address = typeof body?.address === "string" ? body.address : null
    const action = body?.action as Action | undefined

    if (!address || !action) {
      console.warn("[register-discount-action] missing address or action", {
        body,
      })
      return apiError(
        "DISCOUNT_BAD_REQUEST",
        "Missing address or action",
        400,
      )
    }

    const normalized = address.toLowerCase()

    // -------------------------------
    // 1) Insert into event table (idempotent)
    // -------------------------------
    await sql`
      INSERT INTO clankton_discount_actions (address, action)
      VALUES (${normalized}, ${action})
      ON CONFLICT (address, action) DO NOTHING;
    `

    // -------------------------------
    // 2) Update summary table (existing booleans)
    // -------------------------------
    const current = (await getSummaryRow(normalized)) ?? {
      casted: false,
      recast: false,
      tweeted: false,
      follow_tpc: false,
      follow_star: false,
      follow_channel: false,
    }

    const next: DbRow = {
      casted: current.casted ?? false,
      recast: current.recast ?? false,
      tweeted: current.tweeted ?? false,
      follow_tpc: current.follow_tpc ?? false,
      follow_star: current.follow_star ?? false,
      follow_channel: current.follow_channel ?? false,
    }

    // Flip the matching boolean
    if (action === "cast") next.casted = true
    if (action === "recast") next.recast = true
    if (action === "tweet") next.tweeted = true
    if (action === "follow_tpc") next.follow_tpc = true
    if (action === "follow_star") next.follow_star = true
    if (action === "follow_channel") next.follow_channel = true

    // Summary-table upsert
    await sql`
      INSERT INTO clankton_discounts (
        address,
        casted,
        recast,
        tweeted,
        follow_tpc,
        follow_star,
        follow_channel
      )
      VALUES (
        ${normalized},
        ${next.casted},
        ${next.recast},
        ${next.tweeted},
        ${next.follow_tpc},
        ${next.follow_star},
        ${next.follow_channel}
      )
      ON CONFLICT (address) DO UPDATE SET
        casted         = clankton_discounts.casted         OR EXCLUDED.casted,
        recast         = clankton_discounts.recast         OR EXCLUDED.recast,
        tweeted        = clankton_discounts.tweeted        OR EXCLUDED.tweeted,
        follow_tpc     = clankton_discounts.follow_tpc     OR EXCLUDED.follow_tpc,
        follow_star    = clankton_discounts.follow_star    OR EXCLUDED.follow_star,
        follow_channel = clankton_discounts.follow_channel OR EXCLUDED.follow_channel,
        updated_at     = now();
    `

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error("[register-discount-action] fatal error", err)
    return apiError(
      "DISCOUNT_INTERNAL_ERROR",
      "Could not record your discount action. Please try again.",
      500,
    )
  }
}