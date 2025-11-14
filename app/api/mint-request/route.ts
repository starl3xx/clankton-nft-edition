import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { computePrice, type DiscountFlags } from "@/app/lib/pricing";

export const runtime = "nodejs";

type DbRow = {
  casted: boolean | null;
  tweeted: boolean | null;
  follow_tpc: boolean | null;
  follow_star: boolean | null;
  follow_channel: boolean | null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const address = typeof body?.address === "string" ? body.address : null;

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const normalized = address.toLowerCase();

  const result = await sql<DbRow>`
    SELECT casted, tweeted, follow_tpc, follow_star, follow_channel
    FROM clankton_discounts
    WHERE address = ${normalized}
    LIMIT 1;
  `;

  const row = result.rows[0];

  const flags: DiscountFlags = {
    casted: !!row?.casted,
    tweeted: !!row?.tweeted,
    followTPC: !!row?.follow_tpc,
    followStar: !!row?.follow_star,
    followChannel: !!row?.follow_channel,
  };

  const price = computePrice(flags);

  // In the future this is where you'd:
  // - construct a transaction
  // - hit a minting contract or third-party API
  // For now we just echo the computed price.
  return NextResponse.json({
    ok: true,
    address: normalized,
    price,
    discounts: flags,
  });
}