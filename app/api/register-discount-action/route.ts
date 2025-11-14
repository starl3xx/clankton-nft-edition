import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

type Action =
  | "cast"
  | "tweet"
  | "follow_tpc"
  | "follow_star"
  | "follow_channel";

type DbRow = {
  casted: boolean | null;
  tweeted: boolean | null;
  follow_tpc: boolean | null;
  follow_star: boolean | null;
  follow_channel: boolean | null;
};

async function getCurrentRow(address: string): Promise<DbRow | null> {
  const result = await sql<DbRow>`
    SELECT casted, tweeted, follow_tpc, follow_star, follow_channel
    FROM clankton_discounts
    WHERE address = ${address}
    LIMIT 1;
  `;
  return result.rows[0] ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const address = typeof body?.address === "string" ? body.address : null;
  const action = body?.action as Action | undefined;

  if (!address || !action) {
    return NextResponse.json(
      { error: "Missing address or action" },
      { status: 400 },
    );
  }

  const normalized = address.toLowerCase();

  const current = (await getCurrentRow(normalized)) ?? {
    casted: false,
    tweeted: false,
    follow_tpc: false,
    follow_star: false,
    follow_channel: false,
  };

  const updated: DbRow = {
    ...current,
    casted: current.casted ?? false,
    tweeted: current.tweeted ?? false,
    follow_tpc: current.follow_tpc ?? false,
    follow_star: current.follow_star ?? false,
    follow_channel: current.follow_channel ?? false,
  };

  // Flip the appropriate flag to true
  if (action === "cast") updated.casted = true;
  if (action === "tweet") updated.tweeted = true;
  if (action === "follow_tpc") updated.follow_tpc = true;
  if (action === "follow_star") updated.follow_star = true;
  if (action === "follow_channel") updated.follow_channel = true;

  await sql`
    INSERT INTO clankton_discounts (
      address,
      casted,
      tweeted,
      follow_tpc,
      follow_star,
      follow_channel
    )
    VALUES (
      ${normalized},
      ${updated.casted},
      ${updated.tweeted},
      ${updated.follow_tpc},
      ${updated.follow_star},
      ${updated.follow_channel}
    )
    ON CONFLICT (address) DO UPDATE SET
      casted         = EXCLUDED.casted,
      tweeted        = EXCLUDED.tweeted,
      follow_tpc     = EXCLUDED.follow_tpc,
      follow_star    = EXCLUDED.follow_star,
      follow_channel = EXCLUDED.follow_channel,
      updated_at     = NOW();
  `;

  return NextResponse.json({ ok: true });
}