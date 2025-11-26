import { NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"
import { ethers } from "ethers"

/**
 * POST /api/mint-signature
 *
 * Generates an EIP-712 signature for minting an NFT.
 * The signature verifies the user's final discounted price.
 *
 * This is the source of truth for pricing - the smart contract
 * will verify this signature before allowing the mint.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address } = body

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Invalid address" },
        { status: 400 }
      )
    }

    const normalized = address.toLowerCase()

    // Fetch user's discounts from database
    const result = await sql`
      SELECT casted, recast, tweeted, follow_tpc, follow_star,
             follow_channel, farcaster_pro, early_fid
      FROM clankton_discounts
      WHERE address = ${normalized}
      LIMIT 1
    `

    const discounts = result.rows[0] || {
      casted: false,
      recast: false,
      tweeted: false,
      follow_tpc: false,
      follow_star: false,
      follow_channel: false,
      farcaster_pro: false,
      early_fid: false,
    }

    // Calculate final price
    const BASE_PRICE = 20_000_000
    const CAST_DISCOUNT = 2_000_000
    const RECAST_DISCOUNT = 4_000_000
    const TWEET_DISCOUNT = 1_000_000
    const FOLLOW_DISCOUNT = 500_000
    const PRO_DISCOUNT = 500_000
    const EARLY_FID_DISCOUNT = 500_000

    let price = BASE_PRICE
    if (discounts.casted) price -= CAST_DISCOUNT
    if (discounts.recast) price -= RECAST_DISCOUNT
    if (discounts.tweeted) price -= TWEET_DISCOUNT
    if (discounts.follow_tpc) price -= FOLLOW_DISCOUNT
    if (discounts.follow_star) price -= FOLLOW_DISCOUNT
    if (discounts.follow_channel) price -= FOLLOW_DISCOUNT
    if (discounts.farcaster_pro) price -= PRO_DISCOUNT
    if (discounts.early_fid) price -= EARLY_FID_DISCOUNT

    // Convert to wei (CLANKTON has 18 decimals)
    const priceInWei = ethers.parseUnits(price.toString(), 18)

    // Generate unique nonce
    const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000)

    // Signature valid for 5 minutes
    const deadline = Math.floor(Date.now() / 1000) + 300

    // Load signer private key from environment
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY
    if (!signerPrivateKey) {
      return NextResponse.json(
        { error: "Signer not configured" },
        { status: 500 }
      )
    }

    const signer = new ethers.Wallet(signerPrivateKey)

    // EIP-712 domain
    const domain = {
      name: "ClanktonNFT",
      version: "1",
      chainId: 8453, // Base mainnet
      verifyingContract: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS as string,
    }

    // EIP-712 types
    const types = {
      MintRequest: [
        { name: "minter", type: "address" },
        { name: "price", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    }

    // Values to sign
    const value = {
      minter: address,
      price: priceInWei.toString(),
      nonce: nonce,
      deadline: deadline,
    }

    // Sign the structured data
    const signature = await signer.signTypedData(domain, types, value)

    console.log("[mint-signature] Generated signature for", {
      address: normalized,
      price: price.toLocaleString(),
      priceInWei: priceInWei.toString(),
      nonce,
      deadline,
    })

    return NextResponse.json({
      price: priceInWei.toString(),
      nonce,
      deadline,
      signature,
      discounts,
      humanReadablePrice: `${price.toLocaleString()} CLANKTON`,
    })
  } catch (err) {
    console.error("[mint-signature] Error", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
