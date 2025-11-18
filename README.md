# Farcaster NFT mint mini app

A Farcaster mini app for minting the 50-edition **thepapercrane × $CLANKTON** NFT on Base. Users earn discounts by performing simple social actions (cast, tweet, follow, join channel), which are verified server-side using Neynar and stored in Postgres.

## Features

- Farcaster mini app support (`@farcaster/miniapp-sdk`)
- Auto-detects viewer FID and follow status via Neynar
- Wagmi Farcaster wallet connection
- Discount system:
  - Cast about the mint (−2M CLANKTON)
  - Recast the announcement (−4M CLANKTON)
  - Tweet about the mint (−1M CLANKTON)
  - Follow @thepapercrane (−500k CLANKTON)
  - Follow @starl3xx.eth (−500k CLANKTON)
  - Join /clankton channel (−500k CLANKTON)
  - Farcaster Pro subscription (−500k CLANKTON, auto-detected)
  - Early adopter FID <100K (−500k CLANKTON, auto-detected)
- Local queued discounts + server-verified discounts
- Price calculation (base price − discounts)
- Simple Postgres persistence with idempotent event logging

## Tech stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Wagmi
- Neynar API
- Vercel Postgres

# Running locally

```
npm install
npm run dev
```

Visit: `http://localhost:3000`

## API endpoints

**GET /api/farcaster/follows?fid=...**
Returns Farcaster follow status, channel membership, Pro subscription, and early FID status.
- Checks if user follows @thepapercrane and @starl3xx.eth
- Checks if user is a member of /clankton channel
- Checks if user has Farcaster Pro (`pro.status === "subscribed"`)
- Checks if user's FID is < 100,000

**POST /api/register-discount-action**
Logs a discount action for a wallet address (idempotent).
- Accepts: `cast`, `recast`, `tweet`, `follow_tpc`, `follow_star`, `follow_channel`, `farcaster_pro`, `early_fid`
- Stores in both event log and summary tables

**GET /api/user-discounts?address=...**
Returns verified discount booleans and computed mint price for a wallet.
- Base price: 20M CLANKTON
- Returns final price after all applicable discounts

**POST /api/mint-request**
Computes the mint price for a wallet (source of truth for signing).
- Fetches all discount flags from database
- Returns final price and discount breakdown

## Notes

- Works inside Farcaster mini apps and normal browsers.
- **Auto-detected discounts** (only inside mini app):
  - Follow status for @thepapercrane, @starl3xx.eth
  - Channel membership for /clankton
  - Farcaster Pro subscription
  - Early adopter FID (<100K)
- **Manual action discounts**:
  - Cast, Recast, and Tweet require user interaction to open compose/intent
- UI indicators:
  - ⏳ queued (local actions not yet confirmed)
  - ✅ verified (server-confirmed actions)
  - 🏆 active (auto-detected Pro/FID status)
- Database is the source of truth for mint pricing (EIP-712 signature verification)

## License

MIT