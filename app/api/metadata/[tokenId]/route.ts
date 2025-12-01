// app/api/metadata/[tokenId]/route.ts
import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

// NFT Collection metadata
const COLLECTION_NAME = "Clankton Town"
const COLLECTION_DESCRIPTION =
  "A limited edition of 50 Clankton Town NFTs by thepapercrane on Base. Minted with CLANKTON tokens and featuring dynamic discount pricing through social actions."
const MAX_SUPPLY = 50

// Base URL for assets (update this when artwork is ready)
const BASE_URL = "https://clankton-nft-edition.vercel.app"
const ARTWORK_URL = `${BASE_URL}/papercrane-sample.jpg` // Update with final artwork IPFS or URL

/**
 * GET /api/metadata/[tokenId]
 *
 * Returns ERC-721 compliant metadata for a given token ID.
 * This endpoint is called by the smart contract's tokenURI function.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdParam } = await params
  const tokenId = parseInt(tokenIdParam, 10)

  // Validate token ID
  if (isNaN(tokenId) || tokenId < 1 || tokenId > MAX_SUPPLY) {
    return NextResponse.json(
      { error: "Invalid token ID" },
      { status: 404 }
    )
  }

  // Generate metadata following ERC-721 metadata standard
  const metadata = {
    name: `${COLLECTION_NAME} #${tokenId}`,
    description: COLLECTION_DESCRIPTION,
    image: ARTWORK_URL,
    external_url: `${BASE_URL}`,
    attributes: [
      {
        trait_type: "Edition",
        value: tokenId,
        max_value: MAX_SUPPLY,
      },
      {
        trait_type: "Collection",
        value: "Clankton Town",
      },
      {
        trait_type: "Artist",
        value: "thepapercrane",
      },
      {
        trait_type: "Network",
        value: "Base",
      },
      {
        trait_type: "Payment Token",
        value: "CLANKTON",
      },
    ],
  }

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "application/json",
    },
  })
}
