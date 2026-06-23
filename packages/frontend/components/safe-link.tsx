"use client"

import { useCallback, type MouseEvent } from "react"

/**
 * SafeLink — navigates via window.location.href (full page load).
 * The auth cookie (httpOnly accessToken) ensures the session survives
 * the reload. Avoids any dependency on next/navigation or next/link
 * which can be unreliable in production builds.
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
  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      extraOnClick?.()
      window.location.href = href
    },
    [href, extraOnClick],
  )

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  )
}
