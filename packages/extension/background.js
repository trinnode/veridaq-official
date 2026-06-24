importScripts("config.js")

const ext = typeof chrome !== "undefined" ? chrome : browser

// ─── Session Management ──────────────────────────────────────────────────────

async function getRefreshTokenCookie() {
  return new Promise((resolve) => {
    ext.cookies.get(
      { url: VERIDAQ_CONFIG.BACKEND_URL, name: "refreshToken" },
      (cookie) => resolve(cookie ? cookie.value : null)
    )
  })
}

async function exchangeExtensionToken() {
  // Try cookie-based refresh token first (web session)
  const refreshToken = await getRefreshTokenCookie()
  if (!refreshToken) {
    // Fall back to stored refresh token (extension login)
    const stored = await ext.storage.session.get(["veridaqRefreshToken"])
    if (!stored.veridaqRefreshToken) return null
    return refreshExtensionToken(stored.veridaqRefreshToken)
  }

  try {
    const res = await fetch(VERIDAQ_CONFIG.BACKEND_URL + "/api/auth/extension/token", {
      method: "POST",
      headers: { "x-refresh-token": refreshToken },
      credentials: "include",
    })

    if (!res.ok) return null
    const data = await res.json()
    if (!data || !data.accessToken) return null

    await ext.storage.session.set({
      veridaqToken: data.accessToken,
      veridaqUser: data.user,
      veridaqTokenExpiry: Date.now() + 4 * 60 * 1000,
    })

    return data
  } catch {
    return null
  }
}

async function refreshExtensionToken(refreshToken) {
  try {
    const res = await fetch(VERIDAQ_CONFIG.BACKEND_URL + "/api/auth/extension/token", {
      method: "POST",
      headers: { "x-refresh-token": refreshToken },
    })

    if (!res.ok) {
      // Refresh token expired — clear everything
      await clearSession()
      return null
    }

    const data = await res.json()
    if (!data || !data.accessToken) return null

    await ext.storage.session.set({
      veridaqToken: data.accessToken,
      veridaqUser: data.user,
      veridaqTokenExpiry: Date.now() + 4 * 60 * 1000,
    })

    return data
  } catch {
    return null
  }
}

async function getSession() {
  const stored = await ext.storage.session.get([
    "veridaqToken",
    "veridaqUser",
    "veridaqTokenExpiry",
    "veridaqRefreshToken",
  ])

  if (stored.veridaqToken && stored.veridaqUser) {
    // Check if token is about to expire (within 30 seconds)
    if (stored.veridaqTokenExpiry && Date.now() > stored.veridaqTokenExpiry - 30000) {
      // Try to refresh using stored refresh token
      if (stored.veridaqRefreshToken) {
        return refreshExtensionToken(stored.veridaqRefreshToken)
      }
      return exchangeExtensionToken()
    }
    return { accessToken: stored.veridaqToken, user: stored.veridaqUser }
  }

  return exchangeExtensionToken()
}

async function clearSession() {
  // Try to clear the server-side httpOnly cookie first
  try {
    const stored = await ext.storage.session.get(["veridaqToken"])
    if (stored.veridaqToken) {
      await fetch(VERIDAQ_CONFIG.BACKEND_URL + "/api/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + stored.veridaqToken },
        credentials: "include",
      }).catch(() => {})
    }
  } catch {}
  // Clear all extension session data
  await ext.storage.session.remove([
    "veridaqToken",
    "veridaqUser",
    "veridaqTokenExpiry",
    "veridaqRefreshToken",
  ])
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(role, email, password) {
  const endpointMap = {
    INSTITUTION: "/api/auth/institution/login",
    EMPLOYER: "/api/auth/employer/login",
    ADMIN: "/api/auth/admin/login",
  }

  const endpoint = endpointMap[role]
  if (!endpoint) return { ok: false, error: "Invalid role" }

  try {
    const res = await fetch(VERIDAQ_CONFIG.BACKEND_URL + endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.error || "Invalid credentials" }
    }

    const data = await res.json()
    if (!data || !data.accessToken || !data.user) {
      return { ok: false, error: "Unexpected server response" }
    }

    // Store session
    await ext.storage.session.set({
      veridaqToken: data.accessToken,
      veridaqRefreshToken: data.refreshToken,
      veridaqUser: data.user,
      veridaqTokenExpiry: Date.now() + 4 * 60 * 1000,
    })

    return { ok: true, user: data.user }
  } catch (err) {
    return { ok: false, error: err.message || "Network error" }
  }
}

// ─── API Proxy ───────────────────────────────────────────────────────────────

async function apiFetch(path, options) {
  const session = await getSession()
  if (!session) return { ok: false, status: 401, data: { error: "Not authenticated" } }

  const headers = Object.assign({}, options && options.headers ? options.headers : {})
  headers["Authorization"] = "Bearer " + session.accessToken

  try {
    const res = await fetch(
      VERIDAQ_CONFIG.BACKEND_URL + path,
      Object.assign({}, options, { headers })
    )

    // If 401, try to refresh once
    if (res.status === 401) {
      const refreshed = await exchangeExtensionToken()
      if (refreshed) {
        headers["Authorization"] = "Bearer " + refreshed.accessToken
        const retryRes = await fetch(
          VERIDAQ_CONFIG.BACKEND_URL + path,
          Object.assign({}, options, { headers })
        )
        const retryContentType = retryRes.headers.get("content-type") || ""
        const retryData = retryContentType.includes("application/json")
          ? await retryRes.json()
          : await retryRes.text()
        return { ok: retryRes.ok, status: retryRes.status, data: retryData }
      }
      await clearSession()
      return { ok: false, status: 401, data: { error: "Session expired" } }
    }

    const contentType = res.headers.get("content-type") || ""
    const data = contentType.includes("application/json") ? await res.json() : await res.text()
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 500, data: { error: err.message } }
  }
}

// ─── Redirect Handling ───────────────────────────────────────────────────────

function getPortalUrl(role) {
  const base = VERIDAQ_CONFIG.WEB_URL
  switch (role) {
    case "INSTITUTION": return base + "/institution/dashboard"
    case "EMPLOYER": return base + "/employer/dashboard"
    case "ADMIN": return base + "/admin/dashboard"
    default: return base
  }
}

// ─── Message Handler ─────────────────────────────────────────────────────────

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false

  switch (message.type) {
    case "veridaq.session":
      getSession()
        .then((session) => sendResponse({ session }))
        .catch(() => sendResponse({ session: null }))
      return true

    case "veridaq.refresh":
      exchangeExtensionToken()
        .then((session) => sendResponse({ session }))
        .catch(() => sendResponse({ session: null }))
      return true

    case "veridaq.login":
      login(message.role, message.email, message.password)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ ok: false, error: err.message }))
      return true

    case "veridaq.logout":
      clearSession()
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }))
      return true

    case "veridaq.redirect":
      const url = getPortalUrl(message.role)
      ext.tabs.create({ url })
      sendResponse({ ok: true })
      return false

    case "veridaq.api":
      apiFetch(message.path, message.options)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ ok: false, status: 500, data: { error: err.message } }))
      return true

    case "veridaq.get-theme":
      ext.storage.sync.get("veridaqTheme", (result) => {
        sendResponse({ theme: result.veridaqTheme || "dark" })
      })
      return true

    case "veridaq.set-theme":
      ext.storage.sync.set({ veridaqTheme: message.theme }, () => {
        sendResponse({ ok: true })
      })
      return true

    default:
      return false
  }
})

// ─── Auto-refresh alarm ──────────────────────────────────────────────────────

ext.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === "veridaq-session-refresh") {
    getSession().catch(() => {})
  }
})

// Set up periodic refresh (every 3 minutes)
ext.alarms?.create?.("veridaq-session-refresh", { periodInMinutes: 3 })
