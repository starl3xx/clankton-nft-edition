import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

export const runtime = "nodejs"

type ActionKey =
  | "casted"
  | "tweeted"
  | "followTPC"
  | "followStar"
  | "followChannel"

export async function POST(req: NextRequest) {
  try {
    const { address, action } = (await req.json()) as {
      address?: string
      action?: ActionKey
    }

    if (!address || !action) {
      return NextResponse.json(
        { error: "Missing address or action" },
        { status: 400 },
      )
    }

    // Map TS key → DB column
    const actionToColumn: Record<ActionKey, string> = {
      casted: "casted",
      tweeted: "tweeted",
      followTPC: "follow_tpc",
      followStar: "follow_star",
      followChannel: "follow_channel",
    }

    const column = actionToColumn[action]

    // For safety, ensure our mapping didn't get messed up
    if (!column) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 },
      )
    }

    // Verbose but simple: one branch per column using UPSERT
    if (column === "casted") {
      await sql`
        INSERT INTO user_discounts (address, casted)
        VALUES (${address}, TRUE)
        ON CONFLICT (address) DO UPDATE
        SET casted = TRUE, updated_at = NOW();
      `
    } else if (column === "tweeted") {
      await sql`
        INSERT INTO user_discounts (address, tweeted)
        VALUES (${address}, TRUE)
        ON CONFLICT (address) DO UPDATE
        SET tweeted = TRUE, updated_at = NOW();
      `
    } else if (column === "follow_tpc") {
      await sql`
        INSERT INTO user_discounts (address, follow_tpc)
        VALUES (${address}, TRUE)
        ON CONFLICT (address) DO UPDATE
        SET follow_tpc = TRUE, updated_at = NOW();
      `
    } else if (column === "follow_star") {
      await sql`
        INSERT INTO user_discounts (address, follow_star)
        VALUES (${address}, TRUE)
        ON CONFLICT (address) DO UPDATE
        SET follow_star = TRUE, updated_at = NOW();
      `
    } else if (column === "follow_channel") {
      await sql`
        INSERT INTO user_discounts (address, follow_channel)
        VALUES (${address}, TRUE)
        ON CONFLICT (address) DO UPDATE
        SET follow_channel = TRUE, updated_at = NOW();
      `
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    )
  }
}