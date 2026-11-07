"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/lib/auth"
import { CurrencyProvider } from "@/lib/currency"
import { ThemeProvider } from "@/components/theme-provider"
import { WalletProvider } from "@/lib/wallet-provider"
import { useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  )
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <CurrencyProvider>
            <WalletProvider>
              {children}
            </WalletProvider>
          </CurrencyProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
