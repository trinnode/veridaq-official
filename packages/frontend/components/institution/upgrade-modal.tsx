"use client"
import { api } from "@/lib/api"
import { toast } from "@/components/ui/toast"
import { CrossmintCheckout } from "@/components/payment/crossmint-checkout"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { CheckCircle2, Copy, ExternalLink, Loader2, Wallet } from "@/lib/icons"
import { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi"
import { parseEther, type Address } from "viem"
import { baseSepolia } from "viem/chains"

const UPGRADE_PRICE_ETH = "0.05"
const UPGRADE_PRICE_WEI = parseEther(UPGRADE_PRICE_ETH)
const UPGRADE_PRICE_USD = 75

type UpgradeModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const paymasterVaultAbi = [
  {
    name: "fundInstitution",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "institutionId", type: "bytes32" }],
    outputs: [],
  },
] as const

export function UpgradeModal({ open, onClose, onSuccess }: UpgradeModalProps) {
  const [step, setStep] = useState<"choose" | "crypto" | "fiat" | "success" | "error">("choose")
  const [paymentRef, setPaymentRef] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isConnected } = useAccount()
  const chainId = useChainId()

  const { data: writeHash, writeContract, isPending: isWriting } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeHash,
  })

  if (!open) return null

  async function handleCrypto() {
    if (!isConnected) {
      toast.error("Please connect your wallet first")
      return
    }
    if (chainId !== baseSepolia.id) {
      toast.error("Please switch to Base Sepolia network")
      return
    }
    setLoading(true)
    try {
      const { data: info } = await api.get("/payment/info")
      if (!info.paymasterAddress || !info.institutionOnChainId) {
        toast.error("Paymaster or institution on-chain configuration missing")
        return
      }

      const { data: payment } = await api.post("/payment/create", {
        type: "INSTITUTION_UPGRADE",
        method: "CRYPTO",
        amountWei: UPGRADE_PRICE_WEI.toString(),
        amountFiat: String(UPGRADE_PRICE_USD),
        fiatCurrency: "USD",
        description: "Institution tier upgrade to PAID",
      })
      setPaymentRef(payment.referenceId)
      setStep("crypto")

      writeContract(
        {
          address: info.paymasterAddress as Address,
          abi: paymasterVaultAbi,
          functionName: "fundInstitution",
          args: [info.institutionOnChainId as `0x${string}`],
          value: UPGRADE_PRICE_WEI,
        },
        {
          onSuccess: (hash) => { setTxHash(hash) },
          onError: (err) => {
            toast.error(err.message ?? "Transaction rejected")
            setError(err.message)
            setStep("error")
          },
        }
      )
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Failed to create payment")
      setError(err?.response?.data?.error ?? "Failed to create payment")
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  async function confirmOnChain() {
    if (!txHash || !paymentRef) return
    setLoading(true)
    try {
      const { data } = await api.post("/payment/complete/crypto", {
        referenceId: paymentRef,
        txHash,
      })
      if (data.completed) {
        toast.success("Upgrade confirmed! Your institution is now PAID tier.")
        setStep("success")
        onSuccess()
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Verification failed"
      toast.error(msg)
      setError(msg)
      setStep("error")
    } finally {
      setLoading(false)
    }
  }

  const txPending = isWriting || isConfirming

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-card border-surface-border mx-4 w-full max-w-md rounded-xl border p-6 shadow-2xl shadow-accent-glow/20">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Upgrade to PAID Tier</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">&times;</button>
        </div>

        {step === "choose" && (
          <div className="space-y-4">
            <div className="bg-accent/5 border-accent/10 rounded-lg border p-4">
              <p className="text-foreground text-center text-2xl font-bold">{UPGRADE_PRICE_USD}</p>
              <p className="text-muted text-center text-xs">USD</p>
              <p className="text-muted text-center text-xs mt-1">≈ {UPGRADE_PRICE_ETH} ETH</p>
            </div>

            <div className="bg-void border-surface-border rounded-lg border p-3">
              <ConnectButton.Custom>
                {({ account, chain, openConnectModal, openChainModal, authenticationStatus, mounted }) => {
                  const ready = mounted && authenticationStatus !== "loading"
                  const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated")

                  return (
                    <div className="space-y-3">
                      {!connected ? (
                        <button onClick={openConnectModal} className="bg-accent text-void hover:bg-accent/90 flex w-full items-center justify-center gap-2 rounded px-4 py-3 font-medium transition-colors">
                          <Wallet className="h-4 w-4" /> Connect Wallet
                        </button>
                      ) : chain.id !== baseSepolia.id ? (
                        <button onClick={openChainModal} className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 flex w-full items-center justify-center gap-2 rounded border border-amber-500/30 px-4 py-3 font-medium transition-colors">
                          Switch to Base Sepolia
                        </button>
                      ) : (
                        <button onClick={handleCrypto} disabled={loading} className="bg-accent text-void hover:bg-accent/90 flex w-full items-center justify-center gap-2 rounded px-4 py-3 font-medium transition-colors disabled:opacity-50">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                          Pay {UPGRADE_PRICE_ETH} ETH
                        </button>
                      )}
                      {connected && (
                        <div className="bg-void border-surface-border flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted">
                          <Wallet className="h-3 w-3 shrink-0" />
                          <span className="truncate font-mono">{account.address}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(account.address); toast.success("Address copied") }}
                            className="ml-auto shrink-0 hover:text-foreground transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }}
              </ConnectButton.Custom>
            </div>

            <div className="relative">
              <div className="border-surface-border absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-surface-card text-muted px-2">or</span></div>
            </div>

            <CrossmintCheckout
              amountUsd={UPGRADE_PRICE_USD}
              paymentType="INSTITUTION_UPGRADE"
              onSuccess={onSuccess}
              onClose={() => {}}
              label="Pay $75 with Card"
            />

            <p className="text-muted text-center text-xs">Powered by Crossmint &middot; All payments tracked per institution.</p>
          </div>
        )}

        {step === "crypto" && (
          <div className="space-y-4">
            {txPending && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-muted text-sm">Waiting for wallet confirmation...</p>
              </div>
            )}
            {isConfirmed && !loading && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="text-foreground font-medium">Transaction Confirmed</p>
                  {txHash && (
                    <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-accent flex items-center gap-1 text-xs hover:underline">
                      View on Basescan <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <button onClick={confirmOnChain} disabled={loading} className="bg-accent text-void hover:bg-accent/90 flex w-full items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm & Apply Upgrade
                </button>
              </div>
            )}
            {!txPending && !isConfirmed && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-muted text-sm">Transaction not yet confirmed.</p>
                <button onClick={() => setStep("choose")} className="text-muted hover:text-foreground text-xs transition-colors">Back</button>
              </div>
            )}
          </div>
        )}

        {step === "fiat" && (
          <CrossmintCheckout
            amountUsd={UPGRADE_PRICE_USD}
            paymentType="INSTITUTION_UPGRADE"
            onSuccess={() => { setStep("success"); onSuccess() }}
            onClose={() => setStep("choose")}
            label="Pay $75 with Card"
          />
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-semibold text-foreground">Upgrade Successful!</p>
            <p className="text-muted text-sm text-center">Your institution is now PAID tier.</p>
            <button onClick={onClose} className="bg-accent text-void hover:bg-accent/90 mt-2 rounded px-6 py-2 text-sm font-medium transition-colors">Done</button>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-error flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10"><span className="text-2xl">!</span></div>
            <p className="text-lg font-semibold text-foreground">Payment Failed</p>
            <p className="text-muted text-sm text-center">{error ?? "An error occurred"}</p>
            <button onClick={() => { setStep("choose"); setError(null) }} className="bg-accent text-void hover:bg-accent/90 rounded px-6 py-2 text-sm font-medium transition-colors">Try Again</button>
          </div>
        )}
      </div>
    </div>
  )
}
