"use client"
/**
 * Failure state for a data view.
 *
 * A failed request and an empty collection must not look the same. Rendering
 * "no records" for a 401 sends the user looking for data that is not missing,
 * and rendering a bare table for a 502 hides that the backend is down.
 *
 * The three cases are kept distinct on purpose:
 *   401/403 — the session is wrong for this portal; sign-in will fix it.
 *   404     — the resource is genuinely absent, not an error.
 *   anything else — a real failure, with the server message when there is one.
 */

import { AlertTriangle, LogOut, RefreshCcw } from "@/lib/icons"

type FailProps = {
  /** HTTP status, or null for a network-level failure. */
  status: number | null
  message?: string
  onRetry?: () => void
}

export function LoadFailure({ status, message, onRetry }: FailProps) {
  const unauthorised = status === 401 || status === 403
  const missing = status === 404

  const title = unauthorised
    ? "You do not have access to this view"
    : missing
      ? "Not found"
      : "Could not load this data"

  const description = unauthorised
    ? "Your session belongs to a different account, or it has expired. Sign in again to continue."
    : missing
      ? "The record you asked for no longer exists."
      : (message ?? "The server did not respond as expected. Try again, and check the backend log if it keeps failing.")

  return (
    <div
      role="alert"
      className="border-surface-border bg-surface-card flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-12 text-center"
    >
      <div className="bg-error/10 text-error flex h-12 w-12 items-center justify-center rounded-full">
        {unauthorised ? <LogOut className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
        <p className="text-muted text-sm leading-relaxed">{description}</p>
      </div>

      <div className="mt-1 flex items-center gap-3">
        {unauthorised ? (
          <a
            href={
              typeof window !== "undefined" && window.location.pathname.startsWith("/admin")
                ? "/admin/login"
                : typeof window !== "undefined" && window.location.pathname.startsWith("/employer")
                  ? "/employer/login"
                  : "/institution/login"
            }
            className="bg-accent text-void rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
          >
            Sign in again
          </a>
        ) : (
          onRetry && (
            <button
              onClick={onRetry}
              className="border-surface-border text-foreground flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium transition-colors hover:bg-surface"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Try again
            </button>
          )
        )}
      </div>
    </div>
  )
}
