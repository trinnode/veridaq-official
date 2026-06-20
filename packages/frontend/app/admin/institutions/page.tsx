"use client"
import { AdminLayout } from "@/components/admin/layout"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { RefreshCcw, ShieldAlert, ShieldCheck, Wallet, X, Eye, Key, Building2, Clock, Hash, Loader2, Edit, FileText, FileJson, Download, Trash2, Mail, User } from "@/lib/icons"
import { toast } from "@/components/ui/toast"
import { useEffect, useState } from "react"
import { formatEther } from "viem"

export default function InstitutionsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [reviewTarget, setReviewTarget] = useState<any>(null)
  const [reviewWallet, setReviewWallet] = useState("")
  const [polling, setPolling] = useState(false)
  const [fundTarget, setFundTarget] = useState<any>(null)
  const [fundAmount, setFundAmount] = useState("")
  const [fundError, setFundError] = useState("")
  const [fundTxHash, setFundTxHash] = useState("")
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<any>(null)
  const [detailTab, setDetailTab] = useState<"info" | "edit" | "audit" | "employer">("info")
  const [editEmail, setEditEmail] = useState("")
  const [editWallet, setEditWallet] = useState("")
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  async function load(page = 1) {
    try {
      setLoading(true)
      const { data: d } = await api.get(`/admin/institutions?page=${page}`)
      setData(d)
    } catch {
      toast.error("Failed to load institutions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      load()
    }
  }, [user])

  // Auto-poll when there are PENDING institutions
  useEffect(() => {
    if (!data?.items) return
    const hasPending = data.items.some((i: any) => i.blockchainStatus === "PENDING")
    if (hasPending && !polling) {
      setPolling(true)
      const interval = setInterval(() => load(), 10000)
      return () => { clearInterval(interval); setPolling(false) }
    } else if (!hasPending && polling) {
      setPolling(false)
    }
  }, [data?.items, polling])

  async function approve(id: string, walletOverride?: string) {
    setApprovingId(id)
    setReviewTarget(null)
    try {
      await api.post(`/admin/institutions/${id}/approve`, walletOverride ? { adminWallet: walletOverride } : {})
      toast.success("Institution approved and registered on-chain")
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Approval failed"
      toast.error(msg)
    } finally {
      setApprovingId(null)
    }
  }

  async function syncBalance(id: string) {
    setSyncingId(id)
    try {
      await api.post(`/admin/institutions/${id}/sync-balance`)
      toast.success("Balance synced from chain")
      load()
    } catch {
      toast.error("Failed to sync balance")
    } finally {
      setSyncingId(null)
    }
  }

  async function fundInstitution() {
    if (!fundTarget) return
    setFundError("")
    setFundTxHash("")

    try {
      const { data: res } = await api.post(`/admin/institutions/${fundTarget.id}/fund`, {
        amountEth: fundAmount,
      })
      setFundTxHash(res.txHash || "")
      toast.success("Institution funded successfully")
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Funding failed"
      setFundError(msg)
      toast.error(msg)
    }
  }

  async function loadAuditLogs(institutionId: string) {
    setAuditLoading(true)
    try {
      const { data } = await api.get(`/admin/audit?page=1&limit=50`)
      const filtered = data.items.filter((log: any) => log.institutionId === institutionId)
      setAuditLogs(filtered)
    } catch {
      setAuditLogs([])
    } finally {
      setAuditLoading(false)
    }
  }

  async function saveInstitutionEdit() {
    if (!detailTarget) return
    try {
      await api.patch(`/admin/institutions/${detailTarget.id}`, {
        email: editEmail,
        adminWallet: editWallet,
      })
      toast.success("Institution updated")
      setDetailTarget(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Update failed")
    }
  }

  async function exportReport(type: "json" | "pdf") {
    if (!detailTarget) return
    try {
      const { data } = await api.get(`/admin/institutions/${detailTarget.id}/report?format=${type}`)
      const blob = new Blob([type === "json" ? JSON.stringify(data, null, 2) : data], {
        type: type === "json" ? "application/json" : "application/pdf"
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `veridaq-institution-${detailTarget.name}-${Date.now()}.${type === "json" ? "json" : "pdf"}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Export failed")
    }
  }

  return (
    <AdminLayout title="Institution Management">
      <p className="text-muted mb-6 max-w-2xl text-sm">
        Review pending KYC requests. Approving an institution triggers the backend to submit their
        public key to the on-chain InstitutionRegistry contract on Base Sepolia.
      </p>

      {loading ? (
        <div className="text-muted py-12 text-center text-sm">Loading institutions...</div>
      ) : data?.items?.length === 0 ? (
        <div className="border-surface-border bg-surface-card flex flex-col items-center border p-12 text-center">
          <h3 className="mb-2 text-lg font-medium text-foreground">No Institutions Found</h3>
        </div>
      ) : (
        <div className="bg-surface-card border-surface-border overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm text-foreground">
              <thead className="text-muted border-surface-border border-b text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Wallet (Admin)</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Credit</th>
                  <th className="px-4 py-3 font-medium">KYC Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Blockchain Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Date Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
            <tbody className="divide-surface-border divide-y">
              {data?.items?.map((inst: any) => (
                <tr key={inst.id} className="hover:bg-void/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{inst.name}</div>
                    <div className="text-muted text-xs">{inst.email}</div>
                  </td>
                  <td className="text-muted hidden max-w-[200px] truncate px-4 py-3 font-mono text-xs lg:table-cell">
                    {inst.adminWallet}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`${inst.tier === 'FREE' ? 'border-orange-500/20 bg-orange-500/10 text-orange-400' : 'border-blue-500/20 bg-blue-500/10 text-blue-400'} inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium`}
                    >
                      {inst.tier}
                    </span>
                  </td>
                  <td className="text-muted hidden px-4 py-3 font-mono text-xs md:table-cell">
                    {formatEther(BigInt(inst.paymasterBalance || "0")).slice(0, 8)} ETH
                  </td>
                  <td className="px-4 py-3">
                    {inst.kycApproved ? (
                      <span className="text-accent flex items-center gap-1 text-xs font-medium">
                        <ShieldCheck className="h-3 w-3" /> VERIFIED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-orange-400">
                        <ShieldAlert className="h-3 w-3" /> PENDING
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {inst.blockchainStatus === "REGISTERED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs">
                        <ShieldCheck className="w-3 h-3" />
                        Registered
                      </span>
                    ) : inst.blockchainStatus === "PENDING" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Pending
                      </span>
                    ) : inst.blockchainStatus === "FAILED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs">
                        <X className="w-3 h-3" />
                        Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs">
                        <Clock className="w-3 h-3" />
                        Not Started
                      </span>
                    )}
                  </td>
                  <td className="text-muted hidden whitespace-nowrap px-4 py-3 text-xs md:table-cell">
                    {new Date(inst.createdAt).toLocaleDateString()}
                  </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setDetailTarget(inst)
                            setEditEmail(inst.email ?? "")
                            setEditWallet(inst.adminWallet ?? "")
                            loadAuditLogs(inst.id)
                            setDetailTab("info")
                          }}
                          className="btn-ghost text-xs"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        {!inst.kycApproved ? (
                          <button
                            onClick={() => {
                              setReviewTarget(inst)
                              setReviewWallet(inst.adminWallet ?? "")
                            }}
                            className="bg-accent text-void flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
                          >
                            <ShieldCheck className="h-3 w-3" /> Approve
                          </button>
                        ) : (
                          <span className="text-muted text-xs">On-Chain</span>
                        )}
                        <button
                          onClick={() => syncBalance(inst.id)}
                          className="btn-ghost text-xs"
                          disabled={syncingId === inst.id}
                        >
                          <RefreshCcw
                            className={`h-3 w-3 ${syncingId === inst.id ? "animate-spin" : ""}`}
                          />
                        </button>
                        <button
                          onClick={() => {
                            setFundTarget(inst)
                            setFundAmount("")
                            setFundError("")
                            setFundTxHash("")
                          }}
                          className="bg-surface-border hover:bg-surface-border/80 rounded px-2 py-1.5 text-xs text-foreground"
                        >
                          Fund
                        </button>
                      </div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Review & Approve Modal ── */}
      {reviewTarget && (
        <div className="bg-void/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg">
            <div className="border-surface-border bg-surface-card relative overflow-hidden rounded-xl border p-6 shadow-elevated">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <Building2 className="text-accent h-4 w-4" />
                  <span className="text-sm font-semibold tracking-wide">Review Institution</span>
                </div>
                <button onClick={() => setReviewTarget(null)} className="text-muted hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                  <span className="text-muted text-xs">Name</span>
                  <span className="text-foreground text-xs font-medium">{reviewTarget.name}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                  <span className="text-muted text-xs">Email</span>
                  <span className="text-foreground text-xs font-medium">{reviewTarget.email}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                  <span className="text-muted text-xs">Tier</span>
                  <span className={`text-xs font-medium ${reviewTarget.tier === 'FREE' ? 'text-orange-400' : 'text-blue-400'}`}>
                    {reviewTarget.tier}
                  </span>
                </div>
                <div>
                  <label className="text-muted mb-1 flex items-center gap-1 text-xs">
                    <Wallet className="h-3 w-3" /> Admin Wallet
                  </label>
                  <input
                    value={reviewWallet}
                    onChange={(e) => setReviewWallet(e.target.value)}
                    className="border-surface-border bg-void w-full rounded-lg border px-3 py-2 font-mono text-xs text-foreground transition-colors focus:border-accent focus:outline-none"
                    placeholder={reviewTarget.adminWallet}
                  />
                  <p className="text-muted mt-1 text-[10px]">
                    Leave as-is if correct, or override before approving
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                  <span className="text-muted text-xs flex items-center gap-1">
                    <Key className="h-3 w-3" /> Public Key
                  </span>
                  <span className="text-foreground max-w-[200px] truncate font-mono text-xs">
                    {reviewTarget.publicKey?.slice(0, 30)}...
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                  <span className="text-muted text-xs flex items-center gap-1">
                    <Hash className="h-3 w-3" /> On-Chain ID
                  </span>
                  <span className="text-foreground max-w-[200px] truncate font-mono text-xs">
                    {reviewTarget.onChainId?.slice(0, 30)}...
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                  <span className="text-muted text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Registered
                  </span>
                  <span className="text-foreground text-xs">
                    {new Date(reviewTarget.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <p className="text-muted mt-4 text-xs leading-relaxed">
                Approving will register this institution on the InstitutionRegistry contract on
                Base Sepolia. The admin wallet must hold sufficient ETH for gas.
              </p>

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  onClick={() => setReviewTarget(null)}
                  className="border-surface-border rounded-lg border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={() => approve(reviewTarget.id, reviewWallet !== reviewTarget.adminWallet ? reviewWallet : undefined)}
                  disabled={approvingId === reviewTarget.id}
                  className="bg-accent text-void flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  {approvingId === reviewTarget.id ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-void/30 border-t-void" />
                      Submitting Tx...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Confirm & Approve
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fund Modal ── */}
      {fundTarget && (
        <div className="bg-void/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg">
            <div className="border-surface-border bg-surface-card relative overflow-hidden rounded-xl border p-6 shadow-elevated">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <Wallet className="text-accent h-4 w-4" />
                  <span className="text-sm font-semibold tracking-wide">Fund Institution</span>
                </div>
                <button onClick={() => setFundTarget(null)} className="text-muted hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-muted mt-2 text-xs">{fundTarget.name}</p>

              <div className="mt-4">
                <label className="text-muted text-xs">Amount in ETH</label>
                <input
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="border-surface-border bg-void mt-2 w-full rounded border px-3 py-2 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
                  placeholder="0.01"
                />
              </div>

              {fundError && <p className="mt-3 text-xs text-red-400">{fundError}</p>}
              {fundTxHash && <p className="text-muted mt-3 break-all font-mono text-xs">Tx: {fundTxHash}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setFundTarget(null)}
                  className="border-surface-border rounded-lg border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={fundInstitution}
                  className="bg-accent text-void rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Send Funds
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailTarget && (
        <div className="bg-void/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-surface-border bg-surface-card relative overflow-hidden rounded-xl border p-6 shadow-elevated">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <Building2 className="text-accent h-4 w-4" />
                  <span className="text-sm font-semibold tracking-wide">{detailTarget.name}</span>
                </div>
                <button onClick={() => setDetailTarget(null)} className="text-muted hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tab bar */}
              <div className="border-surface-border mt-4 flex gap-1 border-b">
                {(["info", "edit", "audit", "employer"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
                      detailTab === tab
                        ? "border-accent text-accent border-b-2"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab === "employer" ? "Employer Profile" : tab}
                  </button>
                ))}
              </div>

              {/* Info Tab */}
              {detailTab === "info" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">Name</span>
                    <span className="text-foreground text-xs font-medium">{detailTarget.name}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">Email</span>
                    <span className="text-foreground text-xs font-medium">{detailTarget.email}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">Tier</span>
                    <span className={`text-xs font-medium ${detailTarget.tier === 'FREE' ? 'text-orange-400' : 'text-blue-400'}`}>
                      {detailTarget.tier}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">KYC Status</span>
                    <span className={`text-xs font-medium ${detailTarget.kycApproved ? 'text-accent' : 'text-orange-400'}`}>
                      {detailTarget.kycApproved ? "VERIFIED" : "PENDING"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">Blockchain Status</span>
                    <span className="text-foreground text-xs font-medium">{detailTarget.blockchainStatus}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">Admin Wallet</span>
                    <span className="text-foreground max-w-[250px] truncate font-mono text-xs">
                      {detailTarget.adminWallet}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">On-Chain ID</span>
                    <span className="text-foreground max-w-[250px] truncate font-mono text-xs">
                      {detailTarget.onChainId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">Batches</span>
                    <span className="text-foreground text-xs font-medium">{detailTarget._count?.batches ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-void/40 px-3 py-2">
                    <span className="text-muted text-xs">Date Joined</span>
                    <span className="text-foreground text-xs">{new Date(detailTarget.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => exportReport("json")}
                      className="border-surface-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      <FileJson className="h-3.5 w-3.5" /> Export JSON
                    </button>
                    <button
                      onClick={() => exportReport("pdf")}
                      className="border-surface-border flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      <Download className="h-3.5 w-3.5" /> Export PDF
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Tab */}
              {detailTab === "edit" && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-muted flex items-center gap-1 text-xs">
                      <Mail className="h-3 w-3" /> Email Address
                    </label>
                    <input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="border-surface-border bg-void mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-muted flex items-center gap-1 text-xs">
                      <Wallet className="h-3 w-3" /> Admin Wallet
                    </label>
                    <input
                      value={editWallet}
                      onChange={(e) => setEditWallet(e.target.value)}
                      className="border-surface-border bg-void mt-1.5 w-full rounded-lg border px-3 py-2 font-mono text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => setDetailTarget(null)}
                      className="border-surface-border rounded-lg border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveInstitutionEdit}
                      className="bg-accent text-void flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                    >
                      <Edit className="h-3.5 w-3.5" /> Save Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Tab */}
              {detailTab === "audit" && (
                <div className="mt-4">
                  {auditLoading ? (
                    <div className="text-muted flex items-center justify-center py-8 text-xs">
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading audit logs...
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-muted py-8 text-center text-xs">No audit logs found</div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left text-xs text-foreground">
                        <thead className="text-muted border-surface-border sticky top-0 border-b bg-surface-card text-[10px] uppercase">
                          <tr>
                            <th className="px-3 py-2 font-medium">Action</th>
                            <th className="px-3 py-2 font-medium">Details</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-surface-border divide-y">
                          {auditLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-void/30 transition-colors">
                              <td className="px-3 py-2 font-medium text-foreground">{log.action}</td>
                              <td className="text-muted px-3 py-2">
                                {typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details)}
                              </td>
                              <td className="text-muted whitespace-nowrap px-3 py-2">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Employer Profile Tab */}
              {detailTab === "employer" && (
                <div className="mt-4">
                  {detailTarget.alsoEmployer ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-lg bg-void/40 px-3 py-2">
                        <User className="text-accent h-4 w-4" />
                        <span className="text-foreground text-xs font-medium">
                          This institution has opted in as an employer
                        </span>
                      </div>
                      <p className="text-muted text-xs leading-relaxed">
                        An employer profile is automatically created upon KYC approval.
                        Manage verification credits and employer settings from the employer management page.
                      </p>
                    </div>
                  ) : (
                    <div className="text-muted py-8 text-center text-xs">
                      <User className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      <p>This institution has not opted in as an employer.</p>
                      <p className="mt-1">Enable the "Also act as employer" option in the institution registration flow.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
