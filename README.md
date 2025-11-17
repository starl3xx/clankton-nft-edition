# Farcaster NFT mint mini app

A Farcaster mini app for minting the 50-edition **thepapercrane × $CLANKTON** NFT on Base. Users earn discounts by performing simple social actions (cast, tweet, follow, join channel), which are verified server-side using Neynar and stored in Postgres.

## Features

- Farcaster mini app support (`@farcaster/miniapp-sdk`)
- Auto-detects viewer FID and follow status via Neynar
- Wagmi Farcaster wallet connection
- Discount system:
  - Cast (−2M CLANKTON)
  - Tweet (−1M)
  - Follow @thepapercrane (−500k)
  - Follow @starl3xx.eth (−500k)
  - Join /clankton (−500k)
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

## Environment variables

Create `.env.local` and include:

```
NEYNAR_API_KEY=your_key_here
DATABASE_URL=your_vercel_postgres_url
```

# Running locally

```
npm install
npm run dev
```

Visit: `http://localhost:3000`

## Database tables

```
clankton_discount_actions   // one row per (address, action)
clankton_discounts          // summary booleans per wallet
```

## API endpoints

**GET /api/farcaster/follows?fid=...**  
Returns Farcaster follow + channel membership status.

**POST /api/register-discount-action**  
Logs an action for a wallet (idempotent).

**GET /api/user-discounts?address=...**  
Returns verified discount booleans + computed price.

**POST /api/mint-request**  
Computes the mint price for a wallet.

## Notes

- Works inside Farcaster mini apps and normal browsers.
- Follow discounts are auto-applied only inside the mini app.
- UI shows:
  - ⏳ queued (local actions)
  - ✅ verified (server-confirmed actions)

## License

MIT