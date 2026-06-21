"use client"

import { useRouter } from "next/navigation"
import { useCallback, type MouseEvent } from "react"

/**
 * SafeLink — uses useRouter() from next/navigation (AppRouterContext)
 * for client-side navigation instead of next/link (which uses the
 * Pages Router's RouterContext and breaks in App Router).
 */
export function SafeLink({
  href,
  className,
  children,
  onClick: extraOnClick,
}: {
  href: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const router = useRouter()

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      extraOnClick?.()
      try {
        router.push(href)
      } catch {
        window.location.href = href
      }
    },
    [href, router, extraOnClick],
  )

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  )
}
