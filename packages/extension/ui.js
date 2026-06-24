function byData(root, name) {
  return root.querySelector("[data-" + name + "]")
}

const ext = typeof chrome !== "undefined" ? chrome : browser

// ─── Theme ──────────────────────────────────────────────────────────────────

async function loadTheme(root) {
  return new Promise((resolve) => {
    ext.runtime.sendMessage({ type: "veridaq.get-theme" }, (result) => {
      const theme = (result && result.theme) || "dark"
      document.documentElement.setAttribute("data-theme", theme)
      resolve(theme)
    })
  })
}

function toggleTheme(root) {
  ext.runtime.sendMessage({ type: "veridaq.get-theme" }, (result) => {
    const current = (result && result.theme) || "dark"
    const next = current === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", next)
    ext.runtime.sendMessage({ type: "veridaq.set-theme", theme: next })
  })
}

// ─── Messaging ──────────────────────────────────────────────────────────────

function sendMessage(message) {
  return new Promise(function (resolve) {
    ext.runtime.sendMessage(message, resolve)
  })
}

// ─── DOM helpers ────────────────────────────────────────────────────────────

function setStatus(root, text, user, state) {
  const statusText = byData(root, "status-text")
  const statusUser = byData(root, "status-user")
  const indicator = byData(root, "status-indicator")
  if (statusText) statusText.textContent = text
  if (statusUser) statusUser.textContent = user || ""
  if (indicator) {
    indicator.className = "status-indicator " + (state || "")
  }
}

function setStatusMsg(el, text, type) {
  if (!el) return
  el.textContent = text
  el.className = "status-msg" + (type ? " " + type : "")
}

function toggleSection(root, section) {
  root.querySelectorAll("[data-section]").forEach(function (el) {
    el.classList.toggle("hidden", el.dataset.section !== section)
  })
}

function toggleTab(root, tab) {
  root.querySelectorAll("[data-dashboard-tabs] .tab").forEach(function (button) {
    button.classList.toggle("active", button.dataset.tab === tab)
  })
  root.querySelectorAll("[data-panel]").forEach(function (panel) {
    panel.classList.toggle("hidden", panel.dataset.panel !== tab)
  })
}

// ─── Login ─────────────────────────────────────────────────────────────────

function initLoginForm(root) {
  var roleTabs = root.querySelectorAll("[data-role-tabs] .role-tab")
  var emailInput = byData(root, "login-email")
  var passwordInput = byData(root, "login-password")
  var errorEl = byData(root, "login-error")
  var loginBtn = root.querySelector('[data-action="login"]')
  var spinner = byData(root, "login-spinner")
  var selectedRole = "INSTITUTION"

  // Role tab switching
  roleTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      roleTabs.forEach(function (t) { t.classList.remove("active") })
      tab.classList.add("active")
      selectedRole = tab.dataset.role
    })
  })

  // Submit login
  async function handleLogin() {
    var email = emailInput.value.trim()
    var password = passwordInput.value

    if (!email || !password) {
      errorEl.textContent = "Email and password are required"
      return
    }

    errorEl.textContent = ""
    loginBtn.disabled = true
    loginBtn.querySelector("span").textContent = "Signing in..."
    spinner.classList.remove("hidden")

    var result = await sendMessage({
      type: "veridaq.login",
      role: selectedRole,
      email: email,
      password: password,
    })

    loginBtn.disabled = false
    loginBtn.querySelector("span").textContent = "Sign In"
    spinner.classList.add("hidden")

    if (!result || !result.ok) {
      emailInput.classList.add("error")
      passwordInput.classList.add("error")
      errorEl.textContent = (result && result.error) || "Invalid credentials"
      return
    }

    // Success — switch to dashboard
    emailInput.classList.remove("error")
    passwordInput.classList.remove("error")
    errorEl.textContent = ""
    passwordInput.value = ""
    await loadSession(root)
  }

  loginBtn.addEventListener("click", handleLogin)

  // Enter key submits
  passwordInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") handleLogin()
  })
}

// ─── Session ────────────────────────────────────────────────────────────────

async function loadSession(root) {
  setStatus(root, "Checking session...", "", "loading")
  var response = await sendMessage({ type: "veridaq.session" })

  if (response && response.session && response.session.user) {
    var user = response.session.user
    var userLabel = user.name + " \u00b7 " + user.role

    setStatus(root, "Signed in", userLabel, "online")

    // Show status bar, hide login
    var statusBar = byData(root, "status")
    if (statusBar) statusBar.classList.remove("hidden")
    toggleSection(root, "dashboard")

    root.dataset.role = user.role

    // Show role-specific panels
    var uploadPanel = byData(root, "panel-upload")
    var verifyPanel = byData(root, "panel-verify")
    var adminPanel = byData(root, "panel-admin")

    if (uploadPanel) uploadPanel.classList.toggle("hidden", user.role !== "INSTITUTION")
    if (verifyPanel) verifyPanel.classList.toggle("hidden", user.role !== "EMPLOYER")
    if (adminPanel) adminPanel.classList.toggle("hidden", user.role !== "ADMIN")

    // Load role-specific data
    if (user.role === "EMPLOYER") loadCredits(root)
    if (user.role === "ADMIN") loadAdminStats(root)

    // Default to Quick Actions tab
    toggleTab(root, "quick")
    loadDashboard(root)

    return response.session
  }

  // Not signed in — show login
  setStatus(root, "Not signed in", "", "offline")
  var statusBar = byData(root, "status")
  if (statusBar) statusBar.classList.add("hidden")
  toggleSection(root, "login")

  root.dataset.role = ""
  return null
}

// ─── Credits ────────────────────────────────────────────────────────────────

async function loadCredits(root) {
  var creditsCard = root.querySelector("[data-credits-card]")
  var creditFree = byData(root, "credit-free")
  var creditPaid = byData(root, "credit-paid")
  var creditTotal = byData(root, "credit-total")
  if (!creditsCard) return

  creditsCard.classList.remove("hidden")

  var res = await sendMessage({
    type: "veridaq.api",
    path: "/api/payment/info",
    options: { method: "GET" },
  })

  if (res && res.ok && res.data) {
    if (creditFree) creditFree.textContent = res.data.freeRemaining || 0
    if (creditPaid) creditPaid.textContent = res.data.credits || 0
    if (creditTotal) creditTotal.textContent = (res.data.totalAvailable || 0).toString()
  }
}

// ─── Admin Stats ────────────────────────────────────────────────────────────

async function loadAdminStats(root) {
  var res = await sendMessage({
    type: "veridaq.api",
    path: "/api/admin/stats",
    options: { method: "GET" },
  })

  if (res && res.ok && res.data) {
    var d = res.data
    var instEl = byData(root, "stat-institutions")
    var empEl = byData(root, "stat-employers")
    var batchEl = byData(root, "stat-batches")
    var verifEl = byData(root, "stat-verifications")
    if (instEl) instEl.textContent = d.institutions || 0
    if (empEl) empEl.textContent = d.employers || 0
    if (batchEl) batchEl.textContent = d.confirmedBatches || 0
    if (verifEl) verifEl.textContent = d.successfulVerifications || 0
  }
}

// ─── Crossmint ──────────────────────────────────────────────────────────────

async function openCrossmintPurchase(root) {
  var creditStatus = byData(root, "credit-status")
  setStatusMsg(creditStatus, "Opening purchase...", "loading")

  var res = await sendMessage({
    type: "veridaq.api",
    path: "/api/crossmint/create-order",
    options: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountUsd: 15, type: "EMPLOYER_TOPUP" }),
    },
  })

  var checkoutUrl = res && res.ok && res.data && (res.data.checkoutUrl || res.data.url)
  if (checkoutUrl) {
    setStatusMsg(creditStatus, "", "")
    ext.tabs.create({ url: checkoutUrl })
  } else {
    setStatusMsg(
      creditStatus,
      (res && res.data && res.data.error) || "Unable to create purchase URL",
      "error"
    )
  }
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

async function loadDashboard(root) {
  var list = byData(root, "dashboard-list")
  if (!list) return
  list.innerHTML = ""

  var role = root.dataset.role
  if (!role) {
    list.innerHTML = '<li><span class="list-secondary">Sign in to view activity</span></li>'
    return
  }

  if (role === "INSTITUTION") {
    var res = await sendMessage({
      type: "veridaq.api",
      path: "/api/institution/batch?limit=5&page=1",
      options: { method: "GET" },
    })
    if (!res || !res.ok) {
      list.innerHTML = '<li><span class="list-secondary">Unable to load batches</span></li>'
      return
    }
    var items = (res.data && res.data.items) || []
    if (items.length === 0) {
      list.innerHTML = '<li><span class="list-secondary">No batches yet</span></li>'
      return
    }
    items.forEach(function (item) {
      var li = document.createElement("li")
      li.innerHTML =
        '<span class="list-primary">' +
        (item.status || "UNKNOWN") +
        "</span> \u00b7 " +
        (item.studentCount || 0) +
        " students"
      list.appendChild(li)
    })
  }

  if (role === "EMPLOYER") {
    var creditRes = await sendMessage({
      type: "veridaq.api",
      path: "/api/payment/info",
      options: { method: "GET" },
    })
    if (creditRes && creditRes.ok && creditRes.data) {
      var d = creditRes.data
      var creditLi = document.createElement("li")
      creditLi.innerHTML =
        '<span class="list-primary">' +
        (d.totalAvailable || 0) +
        '</span> verifications available' +
        (d.freeRemaining > 0
          ? ' <span class="list-secondary">(' + d.freeRemaining + ' free)</span>'
          : "")
      list.appendChild(creditLi)
    }

    var res = await sendMessage({
      type: "veridaq.api",
      path: "/api/verify/history?page=1&limit=5",
      options: { method: "GET" },
    })
    if (!res || !res.ok) {
      list.innerHTML = '<li><span class="list-secondary">Unable to load requests</span></li>'
      return
    }
    var items = (res.data && res.data.items) || []
    if (items.length === 0) {
      list.innerHTML = '<li><span class="list-secondary">No verifications yet</span></li>'
      return
    }
    items.forEach(function (item) {
      var li = document.createElement("li")
      var result = item.result || item.status
      var cls = result === "VERIFIED" ? "list-primary" : "list-secondary"
      li.innerHTML = '<span class="' + cls + '">' + result + "</span>"
      list.appendChild(li)
    })
  }

  if (role === "ADMIN") {
    var res = await sendMessage({
      type: "veridaq.api",
      path: "/api/admin/stats",
      options: { method: "GET" },
    })
    if (!res || !res.ok) {
      list.innerHTML = '<li><span class="list-secondary">Unable to load stats</span></li>'
      return
    }
    var d = res.data
    list.innerHTML =
      '<li><span class="list-primary">' +
      (d.institutions || 0) +
      '</span> institutions</li>' +
      '<li><span class="list-primary">' +
      (d.employers || 0) +
      '</span> employers</li>' +
      '<li><span class="list-primary">' +
      (d.confirmedBatches || 0) +
      '</span> confirmed batches</li>' +
      '<li><span class="list-primary">' +
      (d.successfulVerifications || 0) +
      "</span> verifications</li>"
  }
}

// ─── Bind Actions ───────────────────────────────────────────────────────────

function bindActions(root) {
  // Theme toggle
  root.querySelectorAll('[data-action="theme-toggle"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      toggleTheme(root)
    })
  })

  // Open full app
  root.querySelectorAll('[data-action="open-app"]').forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault()
      var role = root.dataset.role
      var url = role
        ? VERIDAQ_CONFIG.WEB_URL + "/" + role.toLowerCase() + "/dashboard"
        : VERIDAQ_CONFIG.WEB_URL
      ext.tabs.create({ url: url })
    })
  })

  // Close panel (panel.html only)
  root.querySelectorAll('[data-action="close-panel"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.parent.postMessage({ type: "veridaq.close" }, "*")
    })
  })

  // Logout
  root.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
    btn.addEventListener("click", async function () {
      await sendMessage({ type: "veridaq.logout" })
      setStatus(root, "Not signed in", "", "offline")
      var statusBar = byData(root, "status")
      if (statusBar) statusBar.classList.add("hidden")
      toggleSection(root, "login")
      root.dataset.role = ""
      // Hide credits card
      var creditsCard = root.querySelector("[data-credits-card]")
      if (creditsCard) creditsCard.classList.add("hidden")
    })
  })

  // Refresh dashboard
  root.querySelectorAll('[data-action="refresh-dashboard"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      loadDashboard(root)
    })
  })

  // Tab switching
  root.querySelectorAll("[data-dashboard-tabs] .tab").forEach(function (button) {
    button.addEventListener("click", function () {
      toggleTab(root, button.dataset.tab)
    })
  })

  // Buy credits
  root.querySelectorAll('[data-action="buy-credits"]').forEach(function (button) {
    button.addEventListener("click", function () {
      openCrossmintPurchase(root)
    })
  })

  // Admin buttons
  root.querySelectorAll('[data-action="admin-institutions"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      ext.tabs.create({ url: VERIDAQ_CONFIG.WEB_URL + "/admin/institutions" })
    })
  })
  root.querySelectorAll('[data-action="admin-employers"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      ext.tabs.create({ url: VERIDAQ_CONFIG.WEB_URL + "/admin/employers" })
    })
  })

  // Upload batch
  var uploadFile = byData(root, "upload-file")
  var uploadStatus = byData(root, "upload-status")

  root.querySelectorAll('[data-action="upload"]').forEach(function (button) {
    button.addEventListener("click", async function () {
      if (!uploadFile || !uploadFile.files || uploadFile.files.length === 0) {
        setStatusMsg(uploadStatus, "Select a file first", "error")
        return
      }
      var formData = new FormData()
      formData.append("file", uploadFile.files[0])
      setStatusMsg(uploadStatus, "Uploading...", "loading")
      var res = await sendMessage({
        type: "veridaq.api",
        path: "/api/institution/batch/upload",
        options: { method: "POST", body: formData },
      })
      if (!res || !res.ok) {
        setStatusMsg(
          uploadStatus,
          (res && res.data && res.data.error) || "Upload failed",
          "error"
        )
        return
      }
      setStatusMsg(uploadStatus, "Upload accepted! ID: " + (res.data.jobId || "queued"), "success")
    })
  })

  // Verify credential
  var verifyInst = byData(root, "verify-inst")
  var verifyMatric = byData(root, "verify-matric")
  var verifyClaim = byData(root, "verify-claim")
  var verifyThreshold = byData(root, "verify-threshold")
  var verifyStatus = byData(root, "verify-status")

  root.querySelectorAll('[data-action="verify"]').forEach(function (button) {
    button.addEventListener("click", async function () {
      if (!verifyInst.value || !verifyMatric.value) {
        setStatusMsg(verifyStatus, "Institution ID and matric number required", "error")
        return
      }
      setStatusMsg(verifyStatus, "Submitting...", "loading")
      var payload = {
        institutionOnChainId: verifyInst.value,
        matricNumber: verifyMatric.value,
        claimType: Number(verifyClaim.value) || 1,
        threshold: Number(verifyThreshold.value) || 0,
      }
      var res = await sendMessage({
        type: "veridaq.api",
        path: "/api/verify/request",
        options: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      })
      if (!res || !res.ok) {
        setStatusMsg(
          verifyStatus,
          (res && res.data && res.data.error) || "Request failed",
          "error"
        )
        return
      }
      setStatusMsg(
        verifyStatus,
        "Request queued! ID: " + (res.data.requestId || "pending"),
        "success"
      )
    })
  })
}

// ─── Init ───────────────────────────────────────────────────────────────────

async function init() {
  var root = document.querySelector(".app")
  if (!root) return

  // Load theme before anything else
  await loadTheme(root)

  // Init login form
  initLoginForm(root)

  // Try to load session (will show login or dashboard)
  await loadSession(root)

  // Bind all actions
  bindActions(root)
}

document.addEventListener("DOMContentLoaded", init)
