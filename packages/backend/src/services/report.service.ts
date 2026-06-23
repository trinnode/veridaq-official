import { PrismaClient } from "@prisma/client"
import PDFDocument from "pdfkit"
import qr from "qr-image"
import { resolve } from "path"

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const LOGO_WHITE = resolve(process.cwd(), "packages/frontend/public/logo-white.png")
const LOGO_BLACK = resolve(process.cwd(), "packages/frontend/public/logo-black.png")

const NAVY = "#0f172a"
const WHITE = "#ffffff"
const FG = "#1e293b"
const MUTED = "#64748b"
const BORDER = "#e2e8f0"
const ROW_LIGHT = "#f8fafc"
const LINK = "#2563eb"
const GREEN_BG = "#f0fdf4"
const GREEN = "#16a34a"
const AMBER_BG = "#fffbeb"
const AMBER = "#d97706"

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  async buildVerificationReport(requestId: string, employerId: string) {
    const request = await this.prisma.verificationRequest.findFirst({
      where: { id: requestId, employerId },
      select: {
        id: true,
        institutionId: true,
        matricNumber: true,
        claimType: true,
        threshold: true,
        status: true,
        result: true,
        proofJson: true,
        txHash: true,
        createdAt: true,
        completedAt: true,
        institution: { select: { name: true, onChainId: true } },
        employer: { select: { name: true, email: true } },
        credential: { select: { commitment: true, nullifier: true, graduationYear: true } },
      },
    })

    if (!request) return { error: "NOT_FOUND" as const }
    if (!request.result || !request.completedAt) return { error: "NOT_READY" as const }

    const claim = await this.prisma.claimDefinition.findFirst({
      where: {
        institutionId: request.institutionId,
        claimCode: request.claimType,
        threshold: request.threshold,
      },
      select: { label: true, description: true },
    })

    const isVerified = request.result === "VERIFIED"
    const buffer = await this.renderPdf({
      requestId: request.id,
      institutionName: request.institution.name,
      institutionOnChainId: request.institution.onChainId,
      employerName: request.employer.name,
      employerEmail: request.employer.email,
      claimLabel: claim?.label ?? `Claim Type ${request.claimType}`,
      claimDescription: claim?.description ?? null,
      threshold: request.threshold,
      matricNumber: request.matricNumber,
      result: request.result,
      isVerified,
      txHash: request.txHash,
      credentialCommitment: request.credential?.commitment ?? null,
      credentialNullifier: request.credential?.nullifier ?? null,
      graduationYear: request.credential?.graduationYear ?? null,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
    })
    return { buffer }
  }

  private renderPdf(data: {
    requestId: string
    institutionName: string
    institutionOnChainId: string
    employerName: string
    employerEmail: string
    claimLabel: string
    claimDescription: string | null
    threshold: number
    matricNumber: string
    result: string
    isVerified: boolean
    txHash: string | null
    credentialCommitment: string | null
    credentialNullifier: string | null
    graduationYear: number | null
    createdAt: Date
    completedAt: Date
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 40 })
      const chunks: Buffer[] = []
      doc.on("data", (chunk) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      const FONT = "Helvetica"
      const FONT_BOLD = "Helvetica-Bold"
      const FONT_MONO = "Courier"

      const M = 40
      const CW = doc.page.width - M * 2
      const LX = M
      const PAGE_BOTTOM = doc.page.height - M

      let rowToggle = false

      function row(label: string, value: string, mono = false) {
        const rh = 14
        if (doc.y + rh > PAGE_BOTTOM) { doc.addPage(); rowToggle = false }
        rowToggle = !rowToggle
        const ry = doc.y
        doc.rect(LX, ry, CW, rh).fill(rowToggle ? ROW_LIGHT : WHITE)
        doc.fontSize(7.5).fillColor(MUTED).font(FONT)
        doc.text(label, LX + 8, ry + 3, { width: 130 })
        doc.fillColor(FG)
        if (mono) doc.font(FONT_MONO).fontSize(6.5)
        else doc.font(FONT).fontSize(7.5)
        doc.text(value, LX + 146, ry + 3, { width: CW - 160, lineBreak: false })
        doc.y = ry + rh
      }

      function section(title: string) {
        if (doc.y + 30 > PAGE_BOTTOM) { doc.addPage(); rowToggle = false }
        doc.y += 8
        doc.fontSize(9).fillColor(NAVY).font(FONT_BOLD)
        doc.text(title, LX, doc.y)
        doc.y += 2
        doc.rect(LX, doc.y, CW, 0.5).fill(BORDER)
        doc.y += 6
      }

      function drawQrCode(url: string, x: number, y: number, size: number) {
        try {
          const qrBuffer = qr.imageSync(url, { type: "png", size: 8, margin: 1 })
          doc.image(qrBuffer, x, y, { width: size, height: size })
        } catch {
          doc.fontSize(6).fillColor(MUTED).font(FONT)
          doc.text("QR: " + url, x, y, { width: size, lineBreak: false })
        }
      }

      // ── Seal drawing ──────────────────────────────────────────────
      function drawSeal(cx: number, cy: number, radius: number, institutionName: string) {
        const name = institutionName.length > 30 ? institutionName.slice(0, 27) + "..." : institutionName
        doc.lineWidth(1.5)
        doc.circle(cx, cy, radius).stroke(NAVY)
        doc.circle(cx, cy, radius - 4).stroke(NAVY)

        const arcRadius = radius - 10
        const arcStart = -Math.PI * 0.8
        const arcEnd = Math.PI * 0.8
        const chars = name.split("")
        const totalAngle = arcEnd - arcStart
        const charAngle = chars.length > 1 ? totalAngle / (chars.length - 1) : 0
        doc.fontSize(7).fillColor(NAVY).font(FONT_BOLD)
        chars.forEach((ch, i) => {
          const angle = arcStart + charAngle * i
          const cx2 = cx + arcRadius * Math.cos(angle)
          const cy2 = cy + arcRadius * Math.sin(angle)
          doc.save()
          doc.translate(cx2, cy2)
          doc.rotate((angle * 180) / Math.PI + 90)
          doc.text(ch, -3, -3.5, { width: 6, align: "center", lineBreak: false })
          doc.restore()
        })

        doc.fontSize(16).fillColor(NAVY).font(FONT_BOLD)
        doc.text("V", cx - 4, cy - 9, { width: 8, align: "center", lineBreak: false })

        doc.fontSize(5).fillColor(NAVY).font(FONT)
        doc.text("VERIDAQ", cx - 12, cy + 3, { width: 24, align: "center", lineBreak: false })
      }

      // ── Stamp drawing ─────────────────────────────────────────────
      function drawStamp(text: string, x: number, y: number, w: number, h: number, color: string) {
        doc.save()
        doc.opacity(0.15)
        doc.lineWidth(2)
        doc.rect(x, y, w, h).stroke(color)
        doc.fontSize(16).fillColor(color).font(FONT_BOLD)
        doc.text(text, x, y + (h - 16) / 2, { width: w, align: "center", lineBreak: false })
        doc.restore()
      }

      // ════════════════ HEADER ═══════════════════════════════════════
      doc.rect(0, 0, doc.page.width, 50).fill(NAVY)
      doc.rect(0, 50, doc.page.width, 1).fill(MUTED)

      try { doc.image(LOGO_WHITE, M, 13, { width: 24, height: 24 }) } catch { /* logo not found */ }
      doc.fontSize(15).fillColor(WHITE).font(FONT_BOLD)
      doc.text("VERIDAQ", M + 32, 13)
      doc.fontSize(6.5).fillColor(MUTED).font(FONT)
      doc.text("Credential Verification Report", M + 32, 31)

      doc.fontSize(8).fillColor(WHITE).font(FONT_MONO)
      const ref = data.requestId.slice(0, 8).toUpperCase()
      doc.text(`REF: ${ref}`, M, 13, { width: CW, align: "right" })
      doc.fontSize(6.5).fillColor(MUTED).font(FONT)
      doc.text("CONFIDENTIAL", M, 27, { width: CW, align: "right" })

      doc.y = 60

      // ════════════════ RESULT BADGE ═════════════════════════════════
      if (data.isVerified) {
        const bc = GREEN
        const bb = GREEN_BG
        doc.roundedRect(LX, doc.y, CW, 28, 3).fill(bb)
        doc.roundedRect(LX, doc.y, CW, 28, 3).lineWidth(0.5).stroke(bc)
        doc.fontSize(12).fillColor(bc).font(FONT_BOLD)
        doc.text("VERIFIED", LX + 12, doc.y + 6)
        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text("Cryptographic proof verified on-chain", LX + 12, doc.y + 21)
        doc.y += 36

        // ════════════════ VERIFICATION DETAILS ═════════════════════════
        section("Verification Details")
        row("Institution", data.institutionName)
        row("Matriculation Number", data.matricNumber)
        row("Employer", data.employerName)
        row("Claim Type", data.claimLabel)
        row("Result", data.result.replace(/_/g, " "))
        row("Submitted", dateFormatter.format(data.createdAt))
        row("Completed", dateFormatter.format(data.completedAt))
        if (data.claimDescription) row("Description", data.claimDescription)
        if (data.threshold > 0) row("Threshold", `${data.threshold}`)
        if (data.graduationYear) row("Graduation Year", String(data.graduationYear))
        row("Institution Chain ID", data.institutionOnChainId, true)

        doc.y += 4

        // ════════════════ ON-CHAIN PROOF ═══════════════════════════════
        section("On-Chain Proof")
        row("Verification Method", "Groth16 Zero-Knowledge Proof")
        row("Network", "Base Sepolia (L2)")
        if (data.txHash) {
          row("Transaction Hash", data.txHash, true)
          doc.y += 1
          const url = `https://sepolia.basescan.org/tx/${data.txHash}`
          doc.fontSize(6.5).fillColor(LINK).font(FONT_MONO)
          doc.text(url, LX + 8, doc.y, { width: CW - 16, link: url, underline: true, lineBreak: false })
          doc.y += 13

          // QR code
          doc.y += 4
          drawQrCode(url, LX + CW - 60, doc.y, 50)
          doc.y += 58
        }
        doc.y += 4

        // ════════════════ ZERO-KNOWLEDGE PROOF ═════════════════════════
        section("Zero-Knowledge Proof")
        const zkpNote = "The following values are stored on-chain and were verified using a Groth16 zero-knowledge proof."
        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text(zkpNote, LX + 8, doc.y, { width: CW - 16, lineBreak: false })
        doc.y += 11

        if (data.credentialCommitment) row("Poseidon Commitment", data.credentialCommitment, true)
        if (data.credentialNullifier) row("Nullifier", data.credentialNullifier, true)

        doc.y += 5

        // ════════════════ AUTHENTICITY SEAL ════════════════════════════
        section("Authenticity Seal")

        const sa = doc.y
        doc.roundedRect(LX, sa, CW, 52, 3).fill(ROW_LIGHT)
        doc.roundedRect(LX, sa, CW, 52, 3).lineWidth(0.5).stroke(BORDER)

        // Draw the seal with institution name
        const sealCx = LX + 40
        const sealCy = sa + 26
        drawSeal(sealCx, sealCy, 22, data.institutionName)

        doc.fontSize(8).fillColor(NAVY).font(FONT_BOLD)
        doc.text("VERIFIED BY " + data.institutionName.toUpperCase(), LX + 68, sa + 8)
        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text("This verification is independently verifiable on the Base blockchain.", LX + 68, sa + 22)
        doc.text("Verify the transaction hash at sepolia.basescan.org.", LX + 68, sa + 31)
        doc.text("Issued to: " + data.employerName, LX + 68, sa + 40)

        doc.y = sa + 60

        // Stamp overlay
        drawStamp("VERIFIED", LX + CW - 90, doc.y - 30, 80, 50, GREEN)

      } else {
        // ════════════════ NOT SATISFIED (scanty report) ════════════════
        const bc = AMBER
        const bb = AMBER_BG
        doc.roundedRect(LX, doc.y, CW, 28, 3).fill(bb)
        doc.roundedRect(LX, doc.y, CW, 28, 3).lineWidth(0.5).stroke(bc)
        doc.fontSize(12).fillColor(bc).font(FONT_BOLD)
        doc.text("CLAIM NOT SATISFIED", LX + 12, doc.y + 6)
        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text("The submitted credential does not satisfy the requested claim threshold.", LX + 12, doc.y + 21)
        doc.y += 36

        // Minimal details — no raw student data
        section("Report Information")
        row("Request Reference", data.requestId.slice(0, 8).toUpperCase())
        row("Institution", data.institutionName)
        row("Employer", data.employerName)
        row("Claim Requested", data.claimLabel)
        row("Result", "NOT SATISFIED")
        row("Submitted", dateFormatter.format(data.createdAt))
        row("Completed", dateFormatter.format(data.completedAt))

        doc.y += 4

        // QR code linking to on-chain record
        section("Blockchain Reference")
        if (data.txHash) {
          const url = `https://sepolia.basescan.org/tx/${data.txHash}`
          doc.fontSize(6.5).fillColor(LINK).font(FONT_MONO)
          doc.text(url, LX + 8, doc.y, { width: CW - 16, link: url, underline: true, lineBreak: false })
          doc.y += 11
          drawQrCode(url, LX + CW - 60, doc.y, 50)
          doc.y += 58
        } else {
          doc.fontSize(6.5).fillColor(MUTED).font(FONT)
          doc.text("No on-chain transaction recorded for this request.", LX + 8, doc.y, { width: CW - 16, lineBreak: false })
          doc.y += 13
        }

        doc.y += 4

        // Privacy notice
        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text(
          "Note: VERIDAQ zero-knowledge proofs ensure no student personal data is disclosed " +
          "when a claim is not satisfied. Only the verification outcome is recorded on-chain.",
          LX + 8, doc.y, { width: CW - 16, lineBreak: false }
        )
        doc.y += 16

        // Authenticity seal
        section("Authenticity Seal")
        const sa2 = doc.y
        doc.roundedRect(LX, sa2, CW, 38, 3).fill(ROW_LIGHT)
        doc.roundedRect(LX, sa2, CW, 38, 3).lineWidth(0.5).stroke(BORDER)
        try { doc.image(LOGO_BLACK, LX + 12, sa2 + 7, { width: 24, height: 24 }) } catch { /* logo not found */ }
        doc.fontSize(8).fillColor(NAVY).font(FONT_BOLD)
        doc.text("VERIFIED BY VERIDAQ", LX + 44, sa2 + 6)
        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text("This verification record is authentic and independently verifiable.", LX + 44, sa2 + 20)
        doc.text("Verify the transaction hash at sepolia.basescan.org.", LX + 44, sa2 + 29)
        doc.y = sa2 + 46
      }

      // ════════════════ FOOTER ═══════════════════════════════════════
      const fh = 30
      const fy = PAGE_BOTTOM - fh
      doc.rect(0, fy, doc.page.width, fh).fill(NAVY)
      doc.rect(0, fy, doc.page.width, 0.5).fill(MUTED)
      doc.fontSize(6).fillColor(MUTED).font(FONT)
      doc.text(`Generated ${dateFormatter.format(new Date())}  ·  Report ${data.requestId}`, M, fy + 8, { width: CW, align: "center" })
      doc.fontSize(5.5).fillColor(MUTED).font(FONT)
      doc.text("VERIDAQ — Censor-Resistant Academic Truth", M, fy + 19, { width: CW, align: "center" })

      doc.end()
    })
  }
}
