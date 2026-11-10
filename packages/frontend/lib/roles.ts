/**
 * Role routing helpers.
 *
 * Each portal layout must verify the *role*, not just that some session exists.
 * Without that check an institution session can render the admin shell: the API
 * answers 403 and the user sees an empty table, which reads as "no data" rather
 * than "wrong portal".
 */

export type PortalRole = "ADMIN" | "INSTITUTION" | "EMPLOYER"

export function homePathForRole(role?: string | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard"
    case "INSTITUTION":
      return "/institution/dashboard"
    case "EMPLOYER":
      return "/employer/dashboard"
    default:
      return "/"
  }
}

export function loginPathForRole(role?: string | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin/login"
    case "INSTITUTION":
      return "/institution/login"
    case "EMPLOYER":
      return "/employer/login"
    default:
      return "/"
  }
}
