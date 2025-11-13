"use client"

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import Image from "next/image"

const BASE_PRICE = 20_000_000
const CAST_DISCOUNT = 2_000_000
const TWEET_DISCOUNT = 1_000_000
const FOLLOW_DISCOUNT = 500_000
const MAX_SUPPLY = 50

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

  useEffect(() => {
    const id = setInterval(() => setMintState(computeMintState()), 1000)
    return () => clearInterval(id)
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

  const registerDiscountAction = async () => {
    if (!address) return
    try {
      await fetch("/api/register-discount-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
    } catch {}
  }

  const handleOpenCastIntent = () => {
    const text =
      "Minting the CLANKTON NFT edition on Base – pay in $CLANKTON #CLANKTONMint"
    const url = encodeURIComponent("https://clankton-nft-edition.vercel.app")
    const fullText = encodeURIComponent(`${text} ${decodeURIComponent(url)}`)

    window.open(`https://warpcast.com/~/compose?text=${fullText}`, "_blank")

    setDiscounts((p) => ({ ...p, casted: true }))
    setStatusMessage("Cast composer opened")
    registerDiscountAction()
  }

  const handleOpenTweetIntent = () => {
    const text =
      "Minting the CLANKTON NFT edition on Base – pay in $CLANKTON #CLANKTONMint"
    const url = encodeURIComponent("https://clankton-nft-edition.vercel.app")
    const fullText = encodeURIComponent(`${text} ${decodeURIComponent(url)}`)

    window.open(
      `https://twitter.com/intent/tweet?text=${fullText}`,
      "_blank"
    )

    setDiscounts((p) => ({ ...p, tweeted: true }))
    setStatusMessage("Tweet composer opened")
    registerDiscountAction()
  }

  const handleFollowTPC = () => {
    window.open("https://farcaster.xyz/thepapercrane", "_blank")
    setDiscounts((p) => ({ ...p, followTPC: true }))
    registerDiscountAction()
  }

  const handleFollowStar = () => {
    window.open("https://farcaster.xyz/starl3xx.eth", "_blank")
    setDiscounts((p) => ({ ...p, followStar: true }))
    registerDiscountAction()
  }

  const handleFollowChannel = () => {
    window.open("https://farcaster.xyz/~/channel/clankton", "_blank")
    setDiscounts((p) => ({ ...p, followChannel: true }))
    registerDiscountAction()
  }

  const refreshDiscountsFromServer = async () => {
    if (!address) {
      setStatusMessage("Connect wallet first")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/user-discounts?address=${address}`)
      const data = await res.json()
      setDiscounts({
        casted: data.casted ?? false,
        tweeted: data.tweeted ?? false,
        followTPC: data.followTPC ?? false,
        followStar: data.followStar ?? false,
        followChannel: data.followChannel ?? false,
      })
      setRemotePrice(Number(data.price))
      setStatusMessage("Discounts refreshed")
    } catch {
      setStatusMessage("Could not refresh")
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
    if (isEnded) return setStatusMessage("Mint ended")
    if (isNotStarted) return setStatusMessage("Not live yet")

    setLoading(true)
    setStatusMessage("Preparing mint...")

    try {
      const res = await fetch("/api/mint-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      })
      const data = await res.json()

      await new Promise((r) => setTimeout(r, 1200))

      setStatusMessage("Mint successful!")
    } catch {
      setStatusMessage("Mint failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#8F80AA] text-white px-4 py-8">
      <div className="w-full max-w-lg mx-auto space-y-6">

        {/* Header section */}
        <div className="flex gap-4">
          <div className="h-20 w-20 rounded-2xl overflow-hidden bg-[#33264D]">
            <Image
              src="/clankton-purple.png"
              alt="CLANKTON"
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
              <span className="text-white/75">Edition of 50 • Base</span>
              <CountdownPill mintState={mintState} mintStartLabel="Dec 3" />
            </div>
            <h1 className="text-lg font-semibold leading-tight">
              thepapercrane × $CLANKTON NFT
            </h1>
            <EditionProgress
              minted={minted}
              maxSupply={MAX_SUPPLY}
              pct={progressPct}
            />
          </div>
        </div>

        {/* Price Card */}
        <div className="rounded-2xl bg-[#33264D]/60 p-5 shadow-[0_4px_12px_rgba(255,255,255,0.15)] space-y-4">
          <div className="flex justify-between">
            <div className="text-sm text-white/80">Your price</div>
            <div className="text-right">
              <div className="font-mono text-2xl">
                {formatClankton(effectivePrice)}{" "}
                <span className="text-sm">CLANKTON</span>
              </div>
              <div className="text-[11px] text-white/70">
                Base {formatClankton(BASE_PRICE)} − discounts{" "}
                {formatClankton(localDiscount)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <DiscountPill label="Cast" value="-2,000,000" active={discounts.casted} />
            <DiscountPill label="Tweet" value="-1,000,000" active={discounts.tweeted} />
            <DiscountPill label="@thepapercrane" value="-500,000" active={discounts.followTPC} />
            <DiscountPill label="@starl3xx.eth" value="-500,000" active={discounts.followStar} />
            <DiscountPill label="/clankton" value="-500,000" active={discounts.followChannel} />
          </div>
        </div>

        {/* Discount Header */}
        <div className="text-[14px] text-white/90 tracking-wide text-center uppercase mt-1 mb-1 font-bold">
          ✨ Super easy mint discounts ✨
        </div>

        {/* Discounts */}
        <div className="space-y-3">

          <ActionRow
            icon={<Avatar src="/farcaster.jpg" alt="Farcaster" />}
            title="Cast about this mint"
            description="Post on Farcaster and earn a 2,000,000 CLANKTON discount"
            ctaLabel={discounts.casted ? "Cast again" : "Open cast composer"}
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
            description="Post on X and earn a 1,000,000 CLANKTON discount"
            ctaLabel={discounts.tweeted ? "Tweet again" : "Open tweet composer"}
            onClick={handleOpenTweetIntent}
            done={discounts.tweeted}
          />

          <ActionRow
            icon={<Avatar src="/papercrane.jpg" alt="@thepapercrane" />}
            title="Follow @thepapercrane"
            description="Follow the artist on Farcaster for a 500,000 CLANKTON discount"
            ctaLabel={discounts.followTPC ? "View profile" : "Follow on Farcaster"}
            onClick={handleFollowTPC}
            done={discounts.followTPC}
          />

          <ActionRow
            icon={<Avatar src="/starl3xx.png" alt="@starl3xx.eth" />}
            title="Follow @starl3xx.eth"
            description="Follow the CLANKTON clanker for a 500,000 CLANKTON discount"
            ctaLabel={discounts.followStar ? "View profile" : "Follow on Farcaster"}
            onClick={handleFollowStar}
            done={discounts.followStar}
          />

          <ActionRow
            icon={<Avatar src="/clankton-purple.png" alt="/clankton" />}
            title="Follow /clankton channel"
            description="Join the CLANKTON channel for a 500,000 CLANKTON discount"
            ctaLabel={
              discounts.followChannel ? "View channel" : "Follow /clankton"
            }
            onClick={handleFollowChannel}
            done={discounts.followChannel}
          />

          <button
            className="w-full text-xs rounded-xl bg-transparent px-3 py-2 border border-white/30 hover:bg-white/10 transition disabled:opacity-60"
            onClick={refreshDiscountsFromServer}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh my discounts"}
          </button>
        </div>

        {/* Mint Buttons */}
        <div className="space-y-2">
          <button
            className="w-full rounded-2xl bg-[#C9FF5B] text-black font-semibold px-4 py-3 text-center text-sm shadow-[0_0_30px_rgba(201,255,91,0.6)] hover:bg-[#D7FF86] transition disabled:opacity-50"
            disabled={loading || isEnded || isNotStarted}
            onClick={handleMint}
          >
            {isEnded
              ? "Mint ended"
              : isNotStarted
              ? "Mint not live"
              : loading
              ? "Minting…"
              : "Mint with CLANKTON"}
          </button>

          <button
            className="w-full rounded-2xl border border-white/40 bg-transparent text-sm px-4 py-3 hover:bg-white/10 transition"
            onClick={handleBuyClankton}
          >
            Buy CLANKTON
          </button>
        </div>

        {/* FAQ */}
        <div className="rounded-2xl bg-[#33264D]/60 shadow-[0_4px_12px_rgba(255,255,255,0.12)]">
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-xs text-white/85"
            onClick={() => setShowHow((v) => !v)}
          >
            <span>How does this work?</span>
            <span className="text-white/70">{showHow ? "−" : "+"}</span>
          </button>

          {showHow && (
            <div className="px-4 pb-3 text-[11px] text-white/80 space-y-2">
              <p>• When the mint goes live, anyone can mint until all 50 editions sell out. No whitelist.</p>
              <p>• Discount actions only reduce price; they do not give priority.</p>
              <p>• Mint is payable only in CLANKTON. NFT is standard ERC-721 on Base and tradable on secondary.</p>
              <p>• If you take any discount actions, the miniapp can notify you when mint goes live.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between text-[11px] text-white/80 pt-1">
          <div>
            {address ? (
              <>Connected: <span className="font-mono">{address}</span></>
            ) : (
              <button className="underline" onClick={handleConnectWallet}>
                Connect wallet
              </button>
            )}
          </div>
          {statusMessage && <div className="text-right max-w-[55%]">{statusMessage}</div>}
        </div>

        <div className="text-[10px] text-white/70 text-right">
          Discounts apply once per wallet. Payment in CLANKTON.
        </div>

      </div>
    </div>
  )
}

function computeMintState(): MintState {
  const now = Math.floor(Date.now() / 1000)

  if (now < MINT_START) {
    const total = MINT_START - now
    return { phase: "before", ...breakdownSeconds(total), total }
  }

  if (now <= MINT_END) {
    const total = MINT_END - now
    return { phase: "active", ...breakdownSeconds(total), total }
  }

  return { phase: "ended", total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
}

function breakdownSeconds(total: number) {
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
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
  if (mintState.phase === "ended")
    return (
      <span className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-100 text-[11px]">
        Mint ended
      </span>
    )

  if (mintState.phase === "before")
    return (
      <span className="px-2 py-1 rounded-full bg-white/15 border border-white/35 text-[11px]">
        Mint begins {mintStartLabel} • in {mintState.days}d {mintState.hours}h{" "}
        {mintState.minutes}m {mintState.seconds}s
      </span>
    )

  return (
    <span className="px-2 py-1 rounded-full bg-white/15 border border-white/35 text-[11px]">
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
      <div className="flex justify-between text-[11px] text-white/85">
        <span>{minted} / {maxSupply} minted</span>
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
      className={`px-2 py-1 rounded-full text-[11px] flex items-center gap-1 ${
        active
          ? "bg-[#C9FF5B]/20 text-[#E8FFD0] border border-[#C9FF5B]/40"
          : "bg-white/10 text-white/70 border border-white/20"
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
}) {
  return (
    <div className="rounded-2xl bg-[#33264D]/60 p-4 flex items-center gap-4 shadow-[0_4px_12px_rgba(255,255,255,0.12)]">
      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
        {props.icon}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">{props.title}</div>
          {props.done && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C9FF5B]/25 text-[#E8FFD0] border border-[#C9FF5B]/50">
              action taken
            </span>
          )}
        </div>
        <div className="text-xs text-white/80">{props.description}</div>
      </div>

      <button
        className="text-[11px] whitespace-nowrap rounded-xl bg-white text-[#33264D] px-3 py-2 font-semibold hover:bg-[#C9FF5B] transition"
        onClick={props.onClick}
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
      width={40}
      height={40}
      className="rounded-full h-full w-full object-cover"
    />
  )
}

function formatClankton(value: number | null | undefined) {
  if (value == null) return "–"
  return value.toLocaleString("en-US")
}