"use client"

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type React from "react"
import Image from "next/image"
import { useAccount, useBalance, useConnect } from "wagmi"
import { sdk } from "@farcaster/miniapp-sdk"

const BASE_PRICE = 20_000_000
const CAST_DISCOUNT = 2_000_000
const RECAST_DISCOUNT = 4_000_000
const TWEET_DISCOUNT = 1_000_000
const FOLLOW_DISCOUNT = 500_000
const MAX_SUPPLY = 50

// CLANKTON ERC-20 on Base
const CLANKTON_TOKEN_ADDRESS =
  "0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07" as `0x${string}`
const CLANKTON_CAIP19 =
  "eip155:8453/erc20:0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07"

// Farcaster FIDs
const PAPERCRANE_FID = 249_958 as number
const STARL3XX_FID = 6_500 as number

// Recast target cast URL (update this once the mini app is live)
const RECAST_TARGET_URL = "https://warpcast.com/starl3xx.eth/0xe514b0c0"

// MINT START date in UTC
const MINT_START = Math.floor(Date.UTC(2025, 11, 3, 0, 0, 0) / 1000)
const MINT_END = MINT_START + 7 * 24 * 60 * 60

type DiscountFlags = {
  casted: boolean
  recast: boolean
  tweeted: boolean
  followTPC: boolean
  followStar: boolean
  followChannel: boolean
  farcasterPro: boolean
  earlyFid: boolean
}

type DiscountVerifiedFlags = DiscountFlags

type MintPhase = "before" | "active" | "ended"

type MintState = {
  phase: MintPhase
  total: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

type ApiErrorPayload = {
  ok?: boolean
  code?: string
  message?: string
  error?: string
}

const REACTION_LABELS = [
  "Nice 😏",
  "I see you 🥲",
  "Aww, thanks!",
  "Oh yeah!",
  "\u00A0🐐\u00A0",
  "🥹",
  "Woohoo!",
  "Yeehaw!",
  "LFG!",
  "High five!",
  "Chad",
]

export default function ClanktonMintPage() {
  const { address, isConnected } = useAccount()
  const { data: clanktonBalanceData } = useBalance({
    address,
    token: CLANKTON_TOKEN_ADDRESS,
    query: { enabled: !!address },
  })
  const { connect, connectors, status: connectStatus } = useConnect()

  const userAddress = address ?? null

  const clanktonBalance = clanktonBalanceData
    ? Number(clanktonBalanceData.formatted)
    : 0

  const abbrevBalance = formatAbbrev(clanktonBalance)
  const hasClankton = clanktonBalance > 0
  const buyClanktonLabel = hasClankton
    ? `${abbrevBalance} CLANKTON — buy more?`
    : "Buy CLANKTON"

  const [loading, setLoading] = useState(false)

  const [discounts, setDiscounts] = useState<DiscountFlags>({
    casted: false,
    recast: false,
    tweeted: false,
    followTPC: false,
    followStar: false,
    followChannel: false,
    farcasterPro: false,
    earlyFid: false,
  })

  const [discountVerified, setDiscountVerified] =
    useState<DiscountVerifiedFlags>({
      casted: false,
      recast: false,
      tweeted: false,
      followTPC: false,
      followStar: false,
      followChannel: false,
      farcasterPro: false,
      earlyFid: false,
    })

  const [remotePrice, setRemotePrice] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [mintState, setMintState] = useState<MintState>({
    phase: "before",
    total: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [minted] = useState(0)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [requestingNotifications, setRequestingNotifications] = useState(false)
  const [showHow, setShowHow] = useState(false)
  const [artTilt, setArtTilt] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const [checkingFollows, setCheckingFollows] = useState(false)
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [viewerFid, setViewerFid] = useState<number | null>(null)
  const [bootstrappedFollows, setBootstrappedFollows] = useState(false)

  // countdown
  useEffect(() => {
    const id = setInterval(() => setMintState(computeMintState()), 1000)
    return () => clearInterval(id)
  }, [])

  // Mini app boot
  useEffect(() => {
    if (typeof window === "undefined") return

    let cancelled = false

    const init = async () => {
      try {
        await sdk.actions.ready()
        if (cancelled) return

        setIsMiniApp(true)

        try {
          const rawCtx: any = await sdk.context
          if (cancelled) return

          let fid: number | null = null

          if (typeof rawCtx?.viewer?.fid === "number") {
            fid = rawCtx.viewer.fid
          } else if (typeof rawCtx?.user?.fid === "number") {
            fid = rawCtx.user.fid
          } else if (typeof rawCtx?.cast?.author?.fid === "number") {
            fid = rawCtx.cast.author.fid
          }

          setViewerFid(fid)
        } catch {
          if (cancelled) return
          setViewerFid(null)
        }
      } catch {
        if (cancelled) return
        setIsMiniApp(false)
        setViewerFid(null)
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [])

  // Notification permission event listener
  useEffect(() => {
    if (!isMiniApp) return

    const handleNotificationsEnabled = async ({
      notificationDetails,
    }: {
      notificationDetails: { token: string }
    }) => {
      console.log("[notifications] Enabled with token", notificationDetails.token)

      // Store the token in our database
      if (viewerFid && notificationDetails.token) {
        try {
          await fetch("/api/notifications/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fid: viewerFid,
              token: notificationDetails.token,
              address: userAddress,
            }),
          })

          setNotificationsEnabled(true)
          setStatusMessage("🔔 Notifications enabled! We'll notify you when the mint is live.")
        } catch (err) {
          console.error("[notifications] Failed to register token", err)
        }
      }

      setRequestingNotifications(false)
    }

    const handleNotificationsDisabled = () => {
      console.log("[notifications] Disabled")
      setNotificationsEnabled(false)
      setRequestingNotifications(false)
    }

    const handleMiniAppAddRejected = ({ reason }: { reason: string }) => {
      console.log("[notifications] Add rejected:", reason)
      setStatusMessage("Miniapp add was cancelled")
      setRequestingNotifications(false)
    }

    sdk.on("notificationsEnabled", handleNotificationsEnabled)
    sdk.on("notificationsDisabled", handleNotificationsDisabled)
    sdk.on("miniAppAddRejected", handleMiniAppAddRejected)

    return () => {
      sdk.off("notificationsEnabled", handleNotificationsEnabled)
      sdk.off("notificationsDisabled", handleNotificationsDisabled)
      sdk.off("miniAppAddRejected", handleMiniAppAddRejected)
    }
  }, [isMiniApp, viewerFid, userAddress])

  // ---------- AUTO-APPLY FOLLOWS FROM NEYNAR ----------

  type FollowsResponse = {
    followTPC: boolean
    followStar: boolean
    followChannel: boolean
    farcasterPro: boolean
    earlyFid: boolean
  }

  useEffect(() => {
    if (!isMiniApp) return
    if (!viewerFid) return
    if (bootstrappedFollows) return

    const run = async () => {
      setCheckingFollows(true)
      try {
        const res = await fetch(`/api/farcaster/follows?fid=${viewerFid}`)
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          console.error("[follows-effect] non-OK response", res.status, text)
          throw new Error("Failed to fetch follow data")
        }

        const data = (await res.json()) as FollowsResponse
        const { followTPC, followStar, followChannel, farcasterPro, earlyFid } = data

        const prev = discounts

        const next: DiscountFlags = {
          ...prev,
          followTPC: prev.followTPC || followTPC,
          followStar: prev.followStar || followStar,
          followChannel: prev.followChannel || followChannel,
          farcasterPro: prev.farcasterPro || farcasterPro,
          earlyFid: prev.earlyFid || earlyFid,
        }

        if (userAddress) {
          if (!prev.followTPC && next.followTPC) {
            void registerDiscountAction(userAddress, "follow_tpc")
          }
          if (!prev.followStar && next.followStar) {
            void registerDiscountAction(userAddress, "follow_star")
          }
          if (!prev.followChannel && next.followChannel) {
            void registerDiscountAction(userAddress, "follow_channel")
          }
          if (!prev.farcasterPro && next.farcasterPro) {
            void registerDiscountAction(userAddress, "farcaster_pro")
          }
          if (!prev.earlyFid && next.earlyFid) {
            void registerDiscountAction(userAddress, "early_fid")
          }
        }

        setDiscounts(next)

        setDiscountVerified((prevVerified) => ({
          ...prevVerified,
          followTPC: prevVerified.followTPC || next.followTPC,
          followStar: prevVerified.followStar || next.followStar,
          followChannel: prevVerified.followChannel || next.followChannel,
          farcasterPro: prevVerified.farcasterPro || next.farcasterPro,
          earlyFid: prevVerified.earlyFid || next.earlyFid,
        }))

        setBootstrappedFollows(true)
      } catch (err) {
        console.error("[follows-effect] failed to bootstrap follows", err)
      } finally {
        setCheckingFollows(false)
      }
    }

    void run()
  }, [
    isMiniApp,
    viewerFid,
    bootstrappedFollows,
    discounts,
    userAddress,
    discountVerified,
  ])

  // ---------- AUTOCONNECT FARCASTER WALLET VIA WAGMI ----------

  useEffect(() => {
    if (!isMiniApp) return
    if (isConnected) return
    if (connectStatus === "pending") return

    const connector = connectors[0]
    if (!connector) return

    try {
      connect({ connector })
    } catch (err) {
      console.error("[wagmi-autoconnect] connect error", err)
    }
  }, [isMiniApp, isConnected, connectors, connectStatus, connect])

  const isEnded = mintState.phase === "ended"
  const isNotStarted = mintState.phase === "before"

  const localDiscount = useMemo(() => {
    let d = 0
    if (discounts.casted) d += CAST_DISCOUNT
    if (discounts.recast) d += RECAST_DISCOUNT
    if (discounts.tweeted) d += TWEET_DISCOUNT
    if (discounts.followTPC) d += FOLLOW_DISCOUNT
    if (discounts.followStar) d += FOLLOW_DISCOUNT
    if (discounts.followChannel) d += FOLLOW_DISCOUNT
    if (discounts.farcasterPro) d += FOLLOW_DISCOUNT
    if (discounts.earlyFid) d += FOLLOW_DISCOUNT
    return d
  }, [discounts])

  const localPrice = Math.max(BASE_PRICE - localDiscount, 0)
  const effectivePrice = remotePrice ?? localPrice
  const progressPct = Math.min(100, (minted / MAX_SUPPLY) * 100)

  // ---- DISCOUNT SECTION ----------------------------------------------------

  type DiscountAction =
    | "cast"
    | "recast"
    | "tweet"
    | "follow_tpc"
    | "follow_star"
    | "follow_channel"
    | "farcaster_pro"
    | "early_fid"

  const registerDiscountAction = async (
    addr: string | null | undefined,
    action: DiscountAction,
  ) => {
    if (!addr) {
      console.warn("registerDiscountAction: missing address, skipping", {
        action,
      })
      return
    }

    try {
      const res = await fetch("/api/register-discount-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addr,
          action,
          fid: viewerFid, // Include FID for notification correlation
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        console.error("register-discount-action: non-OK response", {
          status: res.status,
          body: text,
        })
      }
    } catch (err) {
      console.error("register-discount-action failed", err)
    }
  }

  const handleOpenCastIntent = async () => {
    const text =
      "Minting the CLANKTON NFT edition on Base – pay in $CLANKTON #CLANKTONMint"
    const url = "https://clankton-nft-edition.vercel.app"
    const fullText = `${text} ${url}`
    const encoded = encodeURIComponent(fullText)
    const warpcastComposeUrl = `https://warpcast.com/~/compose?text=${encoded}`

    try {
      if (isMiniApp) {
        await sdk.actions.composeCast({ text: fullText })
      } else {
        window.open(warpcastComposeUrl, "_blank", "noopener,noreferrer")
      }

      setDiscounts((p) => ({ ...p, casted: true }))
      setStatusMessage("Farcaster opened – don't forget to cast")
      await registerDiscountAction(userAddress, "cast")
    } catch (err) {
      console.error("composeCast/open cast failed", err)
      try {
        window.open(warpcastComposeUrl, "_blank", "noopener,noreferrer")
      } catch {
        // ignore
      }
    }
  }

  const handleOpenRecastIntent = async () => {
    try {
      if (isMiniApp) {
        await sdk.actions.openUrl(RECAST_TARGET_URL)
      } else {
        window.open(RECAST_TARGET_URL, "_blank", "noopener,noreferrer")
      }

      setDiscounts((p) => ({ ...p, recast: true }))
      setStatusMessage("Cast opened – don't forget to recast")
      await registerDiscountAction(userAddress, "recast")
    } catch (err) {
      console.error("open recast URL failed", err)
      try {
        window.open(RECAST_TARGET_URL, "_blank", "noopener,noreferrer")
      } catch {
        // ignore
      }
    }
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
    setStatusMessage("𝕏 opened – don’t forget to tweet")
    registerDiscountAction(userAddress, "tweet")
  }

  const handleFollowTPC = () => {
    const profileUrl = "https://warpcast.com/thepapercrane"

    if (isMiniApp) {
      ;(async () => {
        try {
          await sdk.actions.viewProfile({ fid: PAPERCRANE_FID })
        } catch (err) {
          console.error("viewProfile thepapercrane failed, falling back", err)
          window.open(profileUrl, "_blank")
        }
      })()
    } else {
      window.open(profileUrl, "_blank")
    }

    setDiscounts((p) => ({ ...p, followTPC: true }))
    setStatusMessage("Opened @thepapercrane – please follow")
    registerDiscountAction(userAddress, "follow_tpc")
  }

  const handleFollowStar = () => {
    const profileUrl = "https://warpcast.com/starl3xx.eth"

    if (isMiniApp) {
      ;(async () => {
        try {
          await sdk.actions.viewProfile({ fid: STARL3XX_FID })
        } catch (err) {
          console.error("viewProfile starl3xx.eth failed, falling back", err)
          window.open(profileUrl, "_blank")
        }
      })()
    } else {
      window.open(profileUrl, "_blank")
    }

    setDiscounts((p) => ({ ...p, followStar: true }))
    setStatusMessage("Opened @starl3xx.eth – please follow")
    registerDiscountAction(userAddress, "follow_star")
  }

  const handleFollowChannel = async () => {
    const url = "https://warpcast.com/~/channel/clankton"

    try {
      if (isMiniApp) {
        await sdk.actions.openUrl(url)
      } else {
        window.open(url, "_blank")
      }

      setDiscounts((p) => ({ ...p, followChannel: true }))
      setStatusMessage("Opened /clankton – please join")
      registerDiscountAction(userAddress, "follow_channel")
    } catch (err) {
      console.error("open /clankton channel failed", err)
      setStatusMessage("Couldn’t open /clankton, try again")
    }
  }

  const refreshDiscountsFromServer = async () => {
    if (!userAddress) {
      setStatusMessage("Connect your Farcaster wallet first")
      return
    }
    setLoading(true)
    setStatusMessage(null)

    try {
      const res = await fetch(`/api/user-discounts?address=${userAddress}`)
      if (!res.ok) {
        let errPayload: ApiErrorPayload | null = null
        try {
          errPayload = (await res.json()) as ApiErrorPayload
        } catch {
          // ignore JSON parse error
        }
        const msg =
          errPayload?.message ||
          errPayload?.error ||
          "Could not refresh discounts"
        setStatusMessage(msg)
        return
      }

      const data = await res.json()

      const serverFlags: DiscountFlags = {
        casted: data.casted ?? false,
        recast: data.recast ?? false,
        tweeted: data.tweeted ?? false,
        followTPC: data.followTPC ?? false,
        followStar: data.followStar ?? false,
        followChannel: data.followChannel ?? false,
        farcasterPro: data.farcasterPro ?? false,
        earlyFid: data.earlyFid ?? false,
      }

      setDiscounts((prev) => ({
        casted: prev.casted || serverFlags.casted,
        recast: prev.recast || serverFlags.recast,
        tweeted: prev.tweeted || serverFlags.tweeted,
        followTPC: prev.followTPC || serverFlags.followTPC,
        followStar: prev.followStar || serverFlags.followStar,
        followChannel: prev.followChannel || serverFlags.followChannel,
        farcasterPro: prev.farcasterPro || serverFlags.farcasterPro,
        earlyFid: prev.earlyFid || serverFlags.earlyFid,
      }))

      setDiscountVerified((prevVerified) => ({
        casted: prevVerified.casted || serverFlags.casted,
        recast: prevVerified.recast || serverFlags.recast,
        tweeted: prevVerified.tweeted || serverFlags.tweeted,
        followTPC: prevVerified.followTPC || serverFlags.followTPC,
        followStar: prevVerified.followStar || serverFlags.followStar,
        followChannel: prevVerified.followChannel || serverFlags.followChannel,
        farcasterPro: prevVerified.farcasterPro || serverFlags.farcasterPro,
        earlyFid: prevVerified.earlyFid || serverFlags.earlyFid,
      }))

      setRemotePrice(Number(data.price))
      setStatusMessage("Discounts synced with server")
    } catch {
      setStatusMessage("Could not refresh discounts")
    } finally {
      setLoading(false)
    }
  }

  const handleBuyClankton = async () => {
    const fallbackUrl =
      "https://app.uniswap.org/swap?outputCurrency=0x461DEb53515CaC6c923EeD9Eb7eD5Be80F4e0b07&chain=base"

    try {
      if (isMiniApp) {
        await sdk.actions.viewToken({
          token: CLANKTON_CAIP19,
        })
      } else {
        window.open(fallbackUrl, "_blank")
      }
    } catch (err) {
      console.error("viewToken failed, falling back to external URL", err)
      window.open(fallbackUrl, "_blank")
    }
  }

  const handleRequestNotifications = async () => {
    if (!isMiniApp) {
      setStatusMessage("Notifications are only available in the Farcaster miniapp")
      return
    }

    if (!viewerFid) {
      setStatusMessage("FID not available")
      return
    }

    try {
      setRequestingNotifications(true)

      // Request to add miniapp (which can include notification permission)
      // This will prompt the user to add the miniapp to their home screen
      // and optionally grant notification permission
      await sdk.actions.addMiniApp({
        notificationDetails: {
          title: "CLANKTON Mint Alerts",
          body: "Get notified when the mint goes live",
          url: window.location.origin,
        },
      })

      // The SDK will emit a 'notificationsEnabled' event if granted
      // We'll handle that in a useEffect listener
      setStatusMessage("Check your notifications to complete setup")
    } catch (err) {
      console.error("Failed to request notifications", err)
      setStatusMessage("Failed to enable notifications")
      setRequestingNotifications(false)
    }
  }

  const handleMint = async () => {
    if (!userAddress || !isConnected) {
      setStatusMessage("Connect your Farcaster wallet to mint")
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
        body: JSON.stringify({ address: userAddress }),
      })

      if (!res.ok) {
        let errPayload: ApiErrorPayload | null = null
        try {
          errPayload = (await res.json()) as ApiErrorPayload
        } catch {
          // ignore JSON parse
        }
        const msg =
          errPayload?.message ||
          errPayload?.error ||
          "Mint failed – try again"
        setStatusMessage(msg)
        return
      }

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
          {/* Left: artwork */}
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
              <div className="text-xs uppercase tracking-wide text-white/75">
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
              <div className="text-xs text-white/70 mt-1">
                Base price {formatClankton(BASE_PRICE)} − discounts{" "}
                {formatClankton(localDiscount)}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <DiscountPill
                label="Cast"
                value="-2M"
                queued={discounts.casted && !discountVerified.casted}
                verified={discountVerified.casted}
              />
              <DiscountPill
                label="Recast"
                value="-4M"
                queued={discounts.recast && !discountVerified.recast}
                verified={discountVerified.recast}
              />
              <DiscountPill
                label="Tweet"
                value="-1M"
                queued={discounts.tweeted && !discountVerified.tweeted}
                verified={discountVerified.tweeted}
              />
              <DiscountPill
                label="@papercrane"
                value="-500K"
                queued={discounts.followTPC && !discountVerified.followTPC}
                verified={discountVerified.followTPC}
              />
              <DiscountPill
                label="@starl3xx"
                value="-500K"
                queued={discounts.followStar && !discountVerified.followStar}
                verified={discountVerified.followStar}
              />
              <DiscountPill
                label="/clankton"
                value="-500K"
                queued={
                  discounts.followChannel && !discountVerified.followChannel
                }
                verified={discountVerified.followChannel}
              />
              <DiscountPill
                label="FC Pro"
                value="-500K"
                queued={discounts.farcasterPro && !discountVerified.farcasterPro}
                verified={discountVerified.farcasterPro}
              />
              <DiscountPill
                label="FID <100K"
                value="-500K"
                queued={discounts.earlyFid && !discountVerified.earlyFid}
                verified={discountVerified.earlyFid}
              />
            </div>
          </div>
        </div>

        {/* Discounts header */}
        <div className="text-base text-white/90 tracking-wide text-center uppercase mt-1 mb-1 font-bold">
          ✨ Super simple discounts ✨
        </div>

        {checkingFollows && (
          <div className="text-xs text-white/70 text-center mb-1">
            Checking your Farcaster follows… 🔎
          </div>
        )}

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
                <span className="text-lg">𝕏</span>
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
            icon={<Avatar src="/farcaster.jpg" alt="Farcaster" />}
            title="Recast the announcement"
            description="Recast @starl3xx's announcement post for a 4,000,000 CLANKTON discount"
            ctaLabel="Recast"
            badge="4M OFF!"
            onClick={handleOpenRecastIntent}
            done={discounts.recast}
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

          {/* Half-width non-actionable discount cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatusCard
              icon={<Avatar src="/fc-pro.png" alt="Farcaster Pro" />}
              title="Farcaster Pro"
              description="Burn your hard-earned money, get a 500,000 CLANKTON discount"
              badge="500K OFF!"
              active={discounts.farcasterPro}
            />
            <StatusCard
              icon={<Avatar src="/fc-og.png" alt="Early FID" />}
              title="FID < 100K"
              description={
                <>
                  The early <s>bird</s> Warplet gets the 500,000 CLANKTON discount
                </>
              }
              badge="500K OFF!"
              active={discounts.earlyFid}
            />
          </div>

          <button
            className="w-full text-xs rounded-xl border border-white/35 bg-white/15 px-3 py-2 text-white hover:bg-white/20 transition disabled:opacity-60"
            onClick={refreshDiscountsFromServer}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "🔄 Refresh discounts (server)"}
          </button>

          {/* Notification permission button */}
          {isMiniApp && !notificationsEnabled && (
            <button
              className="w-full text-xs rounded-xl border border-[#C9FF5B]/50 bg-[#C9FF5B]/10 px-3 py-2 text-[#C9FF5B] hover:bg-[#C9FF5B]/20 transition disabled:opacity-60"
              onClick={handleRequestNotifications}
              disabled={requestingNotifications}
            >
              {requestingNotifications ? "Requesting…" : "🔔 Get notified when mint is live"}
            </button>
          )}
          {notificationsEnabled && (
            <div className="w-full text-xs rounded-xl border border-[#C9FF5B]/50 bg-[#C9FF5B]/10 px-3 py-2 text-[#C9FF5B] text-center">
              ✅ Notifications enabled
            </div>
          )}
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
            className="w-full rounded-2xl bg-white text-[#33264D] text-sm px-4 py-3 text-center font-semibold hover:bg-[#C9FF5B] transition"
            onClick={handleBuyClankton}
          >
            {buyClanktonLabel}
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
            <div className="px-4 pb-3 pt-3 text-xs text-white/80 space-y-2">
              <div className="border-t border-white/15 w-4/5 mx-auto mb-3"></div>
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
                (
                <span className="font-mono text-[#FFB178]">
                  {CLANKTON_TOKEN_ADDRESS}
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
        <div className="flex items-center justify-between text-xs text:white/80 pt-1">
          <div>
            {address ? (
              <>
                Farcaster wallet:{" "}
                <span className="font-mono">{shortAddress(address)}</span>
              </>
            ) : (
              <span>Farcaster wallet not connected</span>
            )}
          </div>
          {statusMessage && (
            <div className="text-right max-w-[55%] font-medium text-[#FFB178] drop-shadow-[0_0_6px_rgba(255,177,120,0.45)]">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="text-xs text-white/70 text-right pb-2">
          Discounts applied once per wallet (hopefully) — this was vibe coded,
          so who really knows? ¯\_(ツ)_/¯
        </div>
      </div>

      {/* Lightbox preview */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 transition-opacity duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative w-[min(96vw,480px)] p-3 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.7)] transform transition-all duration-200 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-10 right-0 text-sm tracking-wide text-white/90 hover:text-white font-semibold flex items-center gap-1"
              onClick={() => setLightboxOpen(false)}
            >
              CLOSE <span className="text-base leading-none">✕</span>
            </button>

            <div className="w-full aspect-square rounded-3xl overflow-hidden border border-white/25">
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

/* ----- helpers ----------------------------------- */

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
      <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-100 border border-red-500/40 text-xs">
        Mint ended
      </span>
    )
  }

  if (mintState.phase === "before") {
    return (
      <span className="px-2 py-1 rounded-full bg-white/15 border border-white/35 text-xs text-white">
        Mint → {mintStartLabel}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
        {mintState.days}d {mintState.hours}h {mintState.minutes}m{" "}
        {mintState.seconds}s
      </span>
    )
  }

  return (
    <span className="px-2 py-1 rounded-full bg-white/15 border border-white/35 text-xs text-white">
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
      <div className="flex items-center justify-between text-xs text-white/85">
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
  queued,
  verified,
}: {
  label: string
  value: string
  queued: boolean
  verified: boolean
}) {
  const active = queued || verified

  // ✅ = verified/logged, ⏳ = queued locally
  let statusEmoji: string | null = null
  if (verified) statusEmoji = "✅"
  else if (queued) statusEmoji = "⏳"

  return (
    <div
      className={`px-2 py-1 rounded-full border text-xs flex items-center gap-1 ${
        active
          ? "border-[#C9FF5B] bg-[#C9FF5B]/15 text-[#E8FFD0]"
          : "border-white/30 text-white/70"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
      {statusEmoji && (
        <span className="text-xs leading-none">{statusEmoji}</span>
      )}
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
      {props.badge && (
        <div className="absolute -top-2 -left-1 origin-top-left -rotate-6">
          <div className={`bg-[#C9FF5B] text-[#33264D] text-[0.6rem] font-semibold px-2 py-1 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.45)] border border-white/60 ${props.badge === "4M OFF!" ? "animate-sparkle" : ""}`}>
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
                text-xs
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
        className="text-xs whitespace-nowrap rounded-xl bg-white text-[#33264D] px-3 py-2 font-semibold hover:bg-[#C9FF5B] transition disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={props.onClick}
        disabled={props.done}
      >
        {props.ctaLabel}
      </button>
    </div>
  )
}

function StatusCard(props: {
  icon?: ReactNode
  title: string
  description: string | ReactNode
  badge?: string
  active: boolean
}) {
  return (
    <div className="relative rounded-3xl border border-white/20 bg-[#6E6099] p-3 flex flex-col gap-2 shadow-[0_0_18px_rgba(255,255,255,0.14)]">
      {props.badge && (
        <div className="absolute -top-2 -left-1 origin-top-left -rotate-6">
          <div className="bg-[#C9FF5B] text-[#33264D] text-[0.6rem] font-semibold px-2 py-1 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.45)] border border-white/60">
            {props.badge}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {props.icon && (
          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center border border-white/30 overflow-hidden shrink-0">
            {props.icon}
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm font-medium">{props.title}</div>
        </div>
        {props.active && (
          <span className="text-lg" style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.6), 0 0 12px rgba(255, 255, 255, 0.4)' }}>🏆</span>
        )}
      </div>
      <div className="text-xs text-white/80">{props.description}</div>
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

function shortAddress(addr: string) {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

function formatAbbrev(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B"
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M"
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K"
  return num.toString()
}