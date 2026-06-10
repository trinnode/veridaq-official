"use client"
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"
import { QueryClientProvider, QueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { WagmiProvider } from "wagmi"
import { baseSepolia } from "wagmi/chains"

const projectId = process.env["NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID"] ?? "YOUR_PROJECT_ID"

const config = getDefaultConfig({
  appName: "VERIDAQ",
  projectId,
  chains: [baseSepolia],
  ssr: false,
})

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#7c3aed",
            accentColorForeground: "#fff",
            borderRadius: "medium",
            fontStack: "system",
            overlayBlur: "small",
          })}
          coolMode
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
