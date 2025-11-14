"use client"

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type React from "react"
import Image from "next/image"
import { sdk } from "@farcaster/miniapp-sdk"

const BASE_PRICE = 20_000_000
const CAST_DISCOUNT = 2_000_000
const TWEET_DISCOUNT = 1_000_000
const FOLLOW_DISCOUNT = 500_000
const MAX_SUPPLY = 50

// Dec 3, 2025 00:00 UTC
const MINT_START = Math.floor(Date.UTC(2025, 11, 3, 0, 0, 0) / 1000)
const MINT_END = MINT_START + 7 * 24 * 60 * 60

type DiscountFlags = {
  casted: boolean
  tweeted: boolean
  followTPC: boolean
  followStar: boolean
  followChannel: boolean
}

type MintPhase = "before" | "active" | "ended"

type MintState = {
  phase: MintPhase
  total: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

const REACTION_LABELS = [
  "Nice 😏",
  "I see you 🥲",
  "Aww, thanks!",
  "Oh yeah!",
  "🐐",
  "Go off!",
  "Crushing",
  "Easy, huh?",
  "LFG!!",
  "🫡",
  "Chad",
]

export default function ClanktonMintPage() {
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [discounts, setDiscounts] = useState<DiscountFlags>({
    casted: false,
    tweeted: false,
    followTPC: false,
    followStar: false,
    followChannel: false,
  })
  const [remotePrice, setRemotePrice] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [mintState, setMintState] = useState<MintState>(() => computeMintState())
  const [minted] = useState(0)
  const [showHow, setShowHow] = useState(false)
  const [artTilt, setArtTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [isMiniApp, setIsMiniApp] = useState(false)

  // countdown
  useEffect(() => {
    const id = setInterval(() => setMintState(computeMintState()), 1000)
    return () => clearInterval(id)
  }, [])

  // tell Farcaster mini app shell we're ready
  useEffect(() => {
    if (typeof window === "undefined") return

    const run = async () => {
      try {
        await sdk.actions.ready()
      } catch (err) {
        console.error("Farcaster mini app ready() failed", err)
      }
    }

    void run()
  }, [])

  // detect Warpcast mini app environment (simple UA sniff)
  useEffect(() => {
    if (typeof navigator === "undefined") return
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes("warpcast")) {
      setIsMiniApp(true)
      console.log("Detected Warpcast mini app environment")
    }
  }, [])

  const isEnded = mintState.phase === "ended"
  const isNotStarted = mintState.phase === "before"

  const localDiscount = useMemo(() => {
    let d = 0
    if (discounts.casted) d += CAST_DISCOUNT
    if (discounts.tweeted) d += TWEET_DISCOUNT
    if (discounts.followTPC) d += FOLLOW_DISCOUNT
    if (discounts.followStar) d += FOLLOW_DISCOUNT
    if (discounts.followChannel) d += FOLLOW_DISCOUNT
    return d
  }, [discounts])

  const localPrice = Math.max(BASE_PRICE - localDiscount, 0)
  const effectivePrice = remotePrice ?? localPrice
  const progressPct = Math.min(100, (minted / MAX_SUPPLY) * 100)

  const handleConnectWallet = async () => {
    const fakeAddress = "0x1234...abcd"
    setAddress(fakeAddress)
    setStatusMessage("Wallet connected (placeholder)")
  }

  const registerDiscountAction = async (addr: string | null) => {
    if (!addr) return
    try {
      await fetch("/api/register-discount-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      })
    } catch {
      // ignore for now
    }
  }

  const handleOpenCastIntent = () => {
    const text =
      "Minting the CLANKTON NFT edition on Base – pay in $CLANKTON #CLANKTONMint"
    const url = encodeURIComponent("https://clankton-nft-edition.vercel.app")
    const fullText = encodeURIComponent(`${text} ${decodeURIComponent(url)}`)

    window.open(`https://warpcast.com/~/compose?text=${fullText}`, "_blank")

    setDiscounts((p) => ({ ...p, casted: true }))
    setStatusMessage("Farcaster opened – don’t forget to cast!")
    registerDiscountAction(address)
  }

  const handleOpenTweetIntent = () => {
    const text =
      "Minting the CLANKTON NFT edition on Base – pay in $CLANKTON #CLANKTONMint"
    const url = encodeURIComponent("https://clankton-nft-edition.vercel.app")
    const fullText = encodeURIComponent(`${text} ${decodeURIComponent(url)}`)

    window.open(
      `https://twitter.com/intent/tweet?text=${fullText}`,
      "_blank",
    )

    setDiscounts((p) => ({ ...p, tweeted: true }))
    setStatusMessage("X opened – don’t forget to tweet!")
    registerDiscountAction(address)
  }

  const handleFollowTPC = () => {
    window.open("https://farcaster.xyz/thepapercrane", "_blank")
    setDiscounts((p) => ({ ...p, followTPC: true }))
    setStatusMessage("Opened @thepapercrane – plz follow!")
    registerDiscountAction(address)
  }

  const handleFollowStar = () => {
    window.open("https://farcaster.xyz/starl3xx.eth", "_blank")
    setDiscounts((p) => ({ ...p, followStar: true }))
    setStatusMessage("Opened @starl3xx.eth – plz follow!")
    registerDiscountAction(address)
  }

  const handleFollowChannel = () => {
    window.open("https://farcaster.xyz/~/channel/clankton", "_blank")
    setDiscounts((p) => ({ ...p, followChannel: true }))
    setStatusMessage("Opened /clankton – plz join!")
    registerDiscountAction(address)
  }

  const refreshDiscountsFromServer = async () => {
    if (!address) {
      setStatusMessage("Connect your wallet first")
      return
    }
    setLoading(true)
    setStatusMessage(null)
    try {
      const res = await fetch(`/api/user-discounts?address=${address}`)
      if (!res.ok) throw new Error("Failed to fetch discounts")
      const data = await res.json()
      setDiscounts({
        casted: data.casted ?? false,
        tweeted: data.tweeted ?? false,
        followTPC: data.followTPC ?? false,
        followStar: data.followStar ?? false,
        followChannel: data.followChannel ?? false,
      })
      setRemotePrice(Number(data.price))
      setStatusMessage("Discounts refreshed from server")
    } catch {
      setStatusMessage("Could not refresh discounts")
    } finally {
      setLoading(false)
    }
  }

  const handleBuyClankton = () => {
    window.open("https://wallet.coinbase.com", "_blank")
  }

  const handleMint = async () => {
    if (!address) {
      await handleConnectWallet()
      return
    }
    if (isEnded) {
      setStatusMessage("Mint is over")
      return
    }
    if (isNotStarted) {
      setStatusMessage("Mint not live yet")
      return
    }

    setLoading(true)
    setStatusMessage("Preparing your mint…")

    try {
      const res = await fetch("/api/mint-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      if (!res.ok) throw new Error("Failed to prepare mint")
      await res.json()

      await new Promise((resolve) => setTimeout(resolve, 1200))

      setStatusMessage("Mint successful – you’re now a CLANKTON enjoyooor")
    } catch {
      setStatusMessage("Mint failed – try again")
    } finally {
      setLoading(false)
    }
  }

  const handleArtMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width - 0.5
    const relY = (e.clientY - rect.top) / rect.height - 0.5
    const maxTilt = 6

    setArtTilt({
      x: -relX * maxTilt,
      y: relY * maxTilt,
    })
  }

  const handleArtMouseLeave = () => {
    setArtTilt({ x: 0, y: 0 })
  }

  return (
    <div className="min-h-screen bg-[#8F80AA] text-white px-4 py-8">
      <div className="w-[420px] max-w-full mx-auto space-y-5">
        {/* Top: artwork + mint meta */}
        <div className="flex gap-4 items-stretch">
          {/* Left: artwork with shine + parallax */}
          <div className="basis-1/3">
            <div
              className="w-full aspect-square cursor-pointer"
              onMouseMove={handleArtMouseMove}
              onMouseLeave={handleArtMouseLeave}
              onClick={() => setLightboxOpen(true)}
              style={{
                transform: `perspective(700px) rotateX(${artTilt.y}deg) rotateY(${artTilt.x}deg)`,
                transition: "transform 120ms ease-out",
              }}
            >
              <div className="h-full w-full rounded-3xl bg-[#33264D] border border-white/25 art-shine">
                <Image
                  src="/papercrane-sample.jpg"
                  alt="thepapercrane × CLANKTON artwork"
                  width={400}
                  height={400}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Right: edition + countdown + progress */}
          <div className="flex-1 flex flex-col justify-between h-32">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-white/75">
                Edition of 50&nbsp;&nbsp;✪&nbsp;&nbsp;ERC-721 on Base
              </div>
              <CountdownPill mintState={mintState} mintStartLabel="Dec 3" />
            </div>

            <EditionProgress
              minted={minted}
              maxSupply={MAX_SUPPLY}
              pct={progressPct}
            />
          </div>
        </div>

        {/* Price card */}
        <div className="rounded-3xl bg-[#6E6099] border border-white/10 p-4 space-y-3 shadow-[0_0_22px_rgba(255,255,255,0.18)]">
          <div className="flex items-start justify-between">
            <div className="text-sm text-white/80">Your price</div>
            <div className="text-right">
              <div className="text-2xl font-mono-price">
                {formatClankton(effectivePrice)}{" "}
                <span className="text-sm tracking-wide">CLANKTON</span>
              </div>
              <div className="text-[11px] text-white/70 mt-1">
                Base price {formatClankton(BASE_PRICE)} − discounts{" "}
                {formatClankton(localDiscount)}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <DiscountPill
                label="Cast"
                value="-2,000,000"
                active={discounts.casted}
              />
              <DiscountPill
                label="Tweet"
                value="-1,000,000"
                active={discounts.tweeted}
              />
              <DiscountPill
                label="@thepapercrane"
                value="-500,000"
                active={discounts.followTPC}
              />
              <DiscountPill
                label="@starl3xx.eth"
                value="-500,000"
                active={discounts.followStar}
              />
              <DiscountPill
                label="/clankton"
                value="-500,000"
                active={discounts.followChannel}
              />
            </div>
          </div>
        </div>

        {/* Discounts header */}
        <div className="text-m text-white/90 tracking-wide text-center uppercase mt-1 mb-1 font-bold">
          ✨ Super simple mint discounts ✨
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <ActionRow
            icon={<Avatar src="/farcaster.jpg" alt="Farcaster" />}
            title="Cast about this mint"
            description="Post on Farcaster and earn a 2,000,000 CLANKTON discount"
            ctaLabel="Cast"
            badge="2M OFF!"
            onClick={handleOpenCastIntent}
            done={discounts.casted}
          />

          <ActionRow
            icon={
              <div className="h-full w-full flex items-center justify-center bg-black text-white rounded-full">
                <span className="text-[1.2em] font-bold">𝕏</span>
              </div>
            }
            title="Tweet about this mint"
            description="Post on 𝕏 and earn a 1,000,000 CLANKTON discount"
            ctaLabel="Tweet"
            badge="1M OFF!"
            onClick={handleOpenTweetIntent}
            done={discounts.tweeted}
          />

          <ActionRow
            icon={<Avatar src="/papercrane.jpg" alt="@thepapercrane avatar" />}
            title="Follow @thepapercrane"
            description="Follow the artist on Farcaster for a 500,000 CLANKTON discount"
            ctaLabel="Follow"
            badge="500K OFF!"
            onClick={handleFollowTPC}
            done={discounts.followTPC}
          />

          <ActionRow
            icon={<Avatar src="/starl3xx.png" alt="@starl3xx.eth avatar" />}
            title="Follow @starl3xx.eth"
            description="Follow the CLANKTON Clanker for a 500,000 CLANKTON discount"
            ctaLabel="Follow"
            badge="500K OFF!"
            onClick={handleFollowStar}
            done={discounts.followStar}
          />

          <ActionRow
            icon={
              <Avatar src="/clankton-purple.png" alt="CLANKTON channel icon" />
            }
            title="Follow the /clankton channel"
            description="Join the CLANKTON channel for a 500,000 CLANKTON discount"
            ctaLabel="Follow"
            badge="500K OFF!"
            onClick={handleFollowChannel}
            done={discounts.followChannel}
          />

          <button
            className="w-full text-xs rounded-xl border border-white/30 bg-transparent px-3 py-2 hover:bg-white/5 transition disabled:opacity-60"
            onClick={refreshDiscountsFromServer}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "🔄 Refresh my discounts! (verifies on server)"}
          </button>
        </div>

        {/* Mint + Buy buttons */}
        <div className="space-y-2">
          <button
            className="w-full rounded-2xl bg-[#C9FF5B] text-black font-semibold px-4 py-3 text-center text-sm shadow-[0_0_30px_rgba(201,255,91,0.6)] hover:bg-[#D7FF86] transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || isEnded || isNotStarted}
            onClick={handleMint}
          >
            {isEnded
              ? "Mint ended"
              : isNotStarted
              ? "Mint not live yet"
              : loading
              ? "Minting…"
              : "Mint with CLANKTON"}
          </button>

          <button
            className="w-full rounded-2xl border border-white/40 bg-transparent text-sm px-4 py-3 text-center hover:bg-white/10 transition"
            onClick={handleBuyClankton}
          >
            Buy CLANKTON
          </button>
        </div>

        {/* FAQ */}
        <div className="rounded-2xl border border-white/20 bg-[#6E6099] shadow-[0_0_18px_rgba(255,255,255,0.14)]">
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-xs text-white/85 font-semibold"
            onClick={() => setShowHow((v) => !v)}
          >
            <span>(Answers to) Frequently Asked Questions</span>
            <span className="text-white/70">{showHow ? "−" : "+"}</span>
          </button>
          {showHow && (
            <div className="px-4 pb-3 text-[11px] text-white/80 space-y-2">
              <p>
                ✪ When the mint goes live, anyone can mint an NFT until all 50
                editions are sold out. There is no whitelist or allowlist.
              </p>
              <p>
                ✪ Discount actions only make your mint cheaper – they do not
                give you priority or guarantee a spot.
              </p>
              <p>
                ✪ The mint in this mini app is only payable in CLANKTON{" "}
                (<span className="font-mono text-[#FFB178]">
                  0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07
                </span>
                ). Once you mint, your NFT is a standard ERC-721 token on Base
                and can be traded on secondary marketplaces.
              </p>
              <p>
                ✪ If you perform any of the discount actions and have
                notifications enabled, you’ll receive a Farcaster notification
                when the mint is live. Unless something breaks.
              </p>
            </div>
          )}
        </div>

        {/* Footer: wallet + status */}
        <div className="flex items-center justify-between text-[11px] text-white/80 pt-1">
          <div>
            {address ? (
              <>
                Connected: <span className="font-mono">{address}</span>
              </>
            ) : (
              <button className="underline" onClick={handleConnectWallet}>
                {isMiniApp ? "Connect Warpcast wallet" : "Connect wallet"}
              </button>
            )}
          </div>
          {statusMessage && (
            <div className="text-right max-w-[55%] font-medium text-[#FFB178] drop-shadow-[0_0_6px_rgba(255,177,120,0.45)]">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="text-[10px] text-white/70 text-right pb-2">
          Discounts applied once per wallet (hopefully) — this was vibe coded, so
          who really knows? ¯\_(ツ)_/¯
        </div>
      </div>

      {/* Lightbox preview */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative w-[min(96vw,480px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-8 right-0 text-xs text-white/80 hover:text-white"
              onClick={() => setLightboxOpen(false)}
            >
              close ✕
            </button>

            <div className="w-full aspect-square rounded-3xl overflow-hidden border border-white/25 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
              <Image
                src="/papercrane-sample.jpg"
                alt="thepapercrane × CLANKTON artwork (preview)"
                width={800}
                height={800}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----- helpers ---------------------------------------------------------- */

function computeMintState(): MintState {
  const now = Math.floor(Date.now() / 1000)

  if (now < MINT_START) {
    const total = MINT_START - now
    const parts = breakdownSeconds(total)
    return { phase: "before", total, ...parts }
  }

  if (now <= MINT_END) {
    const total = MINT_END - now
    const parts = breakdownSeconds(total)
    return { phase: "active", total, ...parts }
  }

  return { phase: "ended", total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
}

function breakdownSeconds(total: number) {
  const days = Math.floor(total / (24 * 3600))
  const hours = Math.floor((total % (24 * 3600)) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { days, hours, minutes, seconds }
}

function CountdownPill({
  mintState,
  mintStartLabel,
}: {
  mintState: MintState
  mintStartLabel: string
}) {
  if (mintState.phase === "ended") {
    return (
      <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-100 border border-red-500/40 text-[11px]">
        Mint ended
      </span>
    )
  }

  if (mintState.phase === "before") {
    return (
      <span className="px-2 py-1 rounded-full bg-white/15 border border-white/35 text-[11px] text-white">
        Mint → {mintStartLabel}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;{mintState.days}d{" "}
        {mintState.hours}h {mintState.minutes}m {mintState.seconds}s
      </span>
    )
  }

  return (
    <span className="px-2 py-1 rounded-full bg-white/15 border border-white/35 text-[11px] text-white">
      Mint ends in {mintState.days}d {mintState.hours}h {mintState.minutes}m{" "}
      {mintState.seconds}s
    </span>
  )
}

function EditionProgress({
  minted,
  maxSupply,
  pct,
}: {
  minted: number
  maxSupply: number
  pct: number
}) {
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[11px] text-white/85">
        <span>
          {minted} / {maxSupply} minted
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#C9FF5B] to-[#F7FFB2]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function DiscountPill({
  label,
  value,
  active,
}: {
  label: string
  value: string
  active: boolean
}) {
  return (
    <div
      className={`px-2 py-1 rounded-full border text-[11px] flex items-center gap-1 ${
        active
          ? "border-[#C9FF5B] bg-[#C9FF5B]/15 text-[#E8FFD0]"
          : "border-white/30 text-white/70"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
      {active && <span className="text-[9px]">• queued</span>}
    </div>
  )
}

function ActionRow(props: {
  icon?: ReactNode
  title: string
  description: string
  ctaLabel: string
  onClick: () => void
  done?: boolean
  badge?: string
}) {
  const funLabel = useMemo(() => {
    if (!props.done) return null
    const index = Math.floor(Math.random() * REACTION_LABELS.length)
    return REACTION_LABELS[index]
  }, [props.done])

  return (
    <div className="relative rounded-3xl border border-white/20 bg-[#6E6099] p-3 flex items-center gap-3 shadow-[0_0_18px_rgba(255,255,255,0.14)]">
      {/* LEFT-SIDE BADGE */}
      {props.badge && (
        <div className="absolute -top-2 -left-1 origin-top-left -rotate-6">
          <div className="bg-[#C9FF5B] text-[#33264D] text-[9px] font-semibold px-2 py-1 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.45)] border border-white/60">
            {props.badge}
          </div>
        </div>
      )}

      {props.icon && (
        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center border border-white/30 overflow-hidden shrink-0">
          {props.icon}
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{props.title}</div>
          {props.done && funLabel && (
            <span
              className="
                text-[10px]
                px-2 py-1
                rounded-full
                bg-[#C9FF5B]/25 text-[#E8FFD0]
                border border-[#C9FF5B]/50
                flex items-center justify-center
                leading-none
              "
            >
              {funLabel}
            </span>
          )}
        </div>
        <div className="text-xs text-white/80">{props.description}</div>
      </div>
      <button
        className="text-[11px] whitespace-nowrap rounded-xl bg-white text-[#33264D] px-3 py-2 font-semibold hover:bg-[#C9FF5B] transition disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={props.onClick}
        disabled={props.done}
      >
        {props.ctaLabel}
      </button>
    </div>
  )
}

function Avatar({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={28}
      height={28}
      className="h-full w-full object-cover"
    />
  )
}

function formatClankton(value: number | null | undefined) {
  if (value == null) return "–"
  return value.toLocaleString("en-US")
}