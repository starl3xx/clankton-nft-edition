"use client"

import { useState } from "react"
import { useAccount, useConnect, useReadContract, useWriteContract } from "wagmi"
import {
  NFT_CONTRACT_ADDRESS,
  CLANKTON_TOKEN_ADDRESS,
  erc20Abi,
  clanktonNftAdminAbi,
} from "@/lib/contracts"

export default function AdminWithdrawPage() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { writeContractAsync } = useWriteContract()

  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Read contract owner
  const { data: owner } = useReadContract({
    address: NFT_CONTRACT_ADDRESS,
    abi: clanktonNftAdminAbi,
    functionName: "owner",
    query: { enabled: !!NFT_CONTRACT_ADDRESS },
  })

  // Read CLANKTON balance of the NFT contract
  const { data: contractBalance, refetch: refetchBalance } = useReadContract({
    address: CLANKTON_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: NFT_CONTRACT_ADDRESS ? [NFT_CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!NFT_CONTRACT_ADDRESS },
  })

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()
  const balanceFormatted = contractBalance
    ? (Number(contractBalance) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })
    : "0"

  const handleConnect = (connector: (typeof connectors)[number]) => {
    connect({ connector })
  }

  // Filter to browser-compatible connectors (exclude Farcaster miniapp on web)
  const browserConnectors = connectors.filter(
    (c) => c.id !== "farcasterMiniApp"
  )

  const handleWithdrawAll = async () => {
    if (!address || !isOwner) {
      setStatus("Only the contract owner can withdraw")
      return
    }

    setLoading(true)
    setStatus("Preparing withdrawal...")

    try {
      setStatus("Confirm transaction in your wallet...")
      await writeContractAsync({
        address: NFT_CONTRACT_ADDRESS,
        abi: clanktonNftAdminAbi,
        functionName: "withdrawAllClankton",
        args: [address],
      })

      setStatus("Withdrawal successful!")
      await refetchBalance()
    } catch (err) {
      console.error("Withdrawal error:", err)
      const message = err instanceof Error ? err.message : "Withdrawal failed"
      if (message.includes("User rejected")) {
        setStatus("Transaction cancelled")
      } else {
        setStatus(`Error: ${message}`)
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#8F80AA] text-white px-4 py-8">
      <div className="w-[420px] max-w-full mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center">Admin: Withdraw Funds</h1>

        {/* Connection Status */}
        <div className="rounded-2xl bg-[#6E6099] border border-white/20 p-4 space-y-3">
          <div className="text-sm text-white/80">Wallet</div>
          {isConnected && address ? (
            <div className="font-mono text-sm break-all">{address}</div>
          ) : (
            <div className="space-y-2">
              {browserConnectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnect(connector)}
                  className="w-full rounded-xl bg-white text-[#33264D] px-4 py-2 font-semibold hover:bg-[#C9FF5B] transition"
                >
                  {connector.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contract Info */}
        <div className="rounded-2xl bg-[#6E6099] border border-white/20 p-4 space-y-3">
          <div className="text-sm text-white/80">NFT Contract</div>
          <div className="font-mono text-xs break-all text-white/60">
            {NFT_CONTRACT_ADDRESS || "Not configured"}
          </div>

          <div className="text-sm text-white/80 mt-4">Contract Owner</div>
          <div className="font-mono text-xs break-all text-white/60">
            {owner || "Loading..."}
          </div>

          <div className="text-sm text-white/80 mt-4">CLANKTON Balance</div>
          <div className="text-2xl font-mono">{balanceFormatted} CLANKTON</div>
        </div>

        {/* Owner Check */}
        {isConnected && (
          <div className="rounded-2xl bg-[#6E6099] border border-white/20 p-4">
            {isOwner ? (
              <div className="text-green-300 text-sm">
                You are the contract owner
              </div>
            ) : (
              <div className="text-red-300 text-sm">
                You are NOT the contract owner. Only the owner can withdraw.
              </div>
            )}
          </div>
        )}

        {/* Withdraw Button */}
        <button
          onClick={handleWithdrawAll}
          disabled={!isConnected || !isOwner || loading || contractBalance === BigInt(0)}
          className="w-full rounded-2xl bg-[#C9FF5B] text-black font-semibold px-4 py-3 text-center text-sm shadow-[0_0_30px_rgba(201,255,91,0.6)] hover:bg-[#D7FF86] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Withdrawing..." : "Withdraw All CLANKTON"}
        </button>

        {/* Status */}
        {status && (
          <div className="text-center text-sm text-[#FFB178] font-medium">
            {status}
          </div>
        )}

        {/* Back Link */}
        <div className="text-center">
          <a href="/" className="text-sm text-white/60 hover:text-white underline">
            Back to mint page
          </a>
        </div>
      </div>
    </div>
  )
}
