import { PrismaClient } from "@prisma/client"
import PDFDocument from "pdfkit"
import qr from "qr-image"
import fs from "fs"
import path from "path"

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

// ── VERIDAQ Brand Colors ──────────────────────────────────────────
const VOID = "#05050a"
const FOREGROUND = "#18181b"
const MUTED = "#646473"
const MUTED_SUBTLE = "#8c8c9b"
const SURFACE = "#f0f0f2"
const SURFACE_CARD = "#ffffff"
const SURFACE_BORDER = "#e4e4e7"
const ACCENT = "#be2a96"
const SUCCESS = "#16a34a"
const WARNING = "#d97706"
const WHITE = "#ffffff"

// ── VERIDAQ Logo (loaded from disk) ───────────────────────────────
let LOGO_BUFFER: Buffer | null = null
try {
  const logoPath = path.resolve(__dirname, "../../public/logo.png")
  LOGO_BUFFER = fs.readFileSync(logoPath)
} catch {
  // Fallback: try a relative path for different runtime contexts
  try {
    const logoPath = path.resolve(process.cwd(), "packages/backend/public/logo.png")
    LOGO_BUFFER = fs.readFileSync(logoPath)
  } catch {
    // Logo will not render but PDF will still generate
  }
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://veridaq-official.vercel.app"

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
      proofJson: request.proofJson,
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
    proofJson: unknown
    credentialCommitment: string | null
    credentialNullifier: string | null
    graduationYear: number | null
    createdAt: Date
    completedAt: Date
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 30 })
      const chunks: Buffer[] = []
      doc.on("data", (chunk) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      const FONT = "Helvetica"
      const FONT_BOLD = "Helvetica-Bold"
      const FONT_MONO = "Courier"

      const M = 30
      const CW = doc.page.width - M * 2
      const LX = M
      const PAGE_H = doc.page.height
      const PAGE_BOTTOM = PAGE_H - M
      const MAX_Y = PAGE_BOTTOM - 10

      // ── Section heading ─────────────────────────────────────────
      function section(title: string) {
        doc.y += 2
        doc.fontSize(7).fillColor(ACCENT).font(FONT_BOLD)
        doc.text(title.toUpperCase(), LX, doc.y)
        doc.y += 1
        doc.rect(LX, doc.y, CW, 0.5).fill(SURFACE_BORDER)
        doc.y += 4
      }

      // ── Detail row ──────────────────────────────────────────────
      function detailRow(label: string, value: string, mono = false) {
        const rh = 12
        const ry = doc.y
        doc.rect(LX, ry, CW, rh).fill(SURFACE)
        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text(label, LX + 6, ry + 3, { width: 120 })
        doc.fillColor(FOREGROUND)
        if (mono) doc.font(FONT_MONO).fontSize(5.5)
        else doc.font(FONT).fontSize(7)
        doc.text(value, LX + 130, ry + 3, { width: CW - 140, lineBreak: false })
        doc.y = ry + rh
      }

      // ── QR Code ─────────────────────────────────────────────────
      function drawQr(url: string, x: number, y: number, size: number) {
        try {
          const qrBuffer = qr.imageSync(url, { type: "png", size: 10, margin: 1 })
          doc.image(qrBuffer, x, y, { width: size, height: size })
        } catch {
          doc.fontSize(5).fillColor(MUTED).font(FONT)
          doc.text("QR: " + url, x, y, { width: size, lineBreak: false })
        }
      }

      // ════════════════ HEADER ═════════════════════════════════════
      const HEADER_H = 42
      doc.rect(0, 0, doc.page.width, HEADER_H).fill(VOID)

      if (LOGO_BUFFER) {
        doc.image(LOGO_BUFFER, M + 2, 6, { width: 28, height: 28 })
      }

      doc.fontSize(11).fillColor(WHITE).font(FONT_BOLD)
      doc.text("VERIDAQ", M + 36, 8)

      doc.fontSize(6).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text("Credential Verification Report", M + 36, 22)

      const ref = data.requestId.slice(0, 8).toUpperCase()
      doc.fontSize(7).fillColor(WHITE).font(FONT_MONO)
      doc.text(`REF: ${ref}`, M, 8, { width: CW, align: "right" })
      doc.fontSize(5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text("CONFIDENTIAL", M, 18, { width: CW, align: "right" })

      doc.y = HEADER_H + 4

      // ════════════════ RESULT BADGE ═══════════════════════════════
      if (data.isVerified) {
        doc.roundedRect(LX, doc.y, CW, 28, 3)
        doc.fillOpacity(0.06).fill(SUCCESS).fillOpacity(1)
        doc.roundedRect(LX, doc.y, CW, 28, 3).lineWidth(0.8).stroke(SUCCESS)

        doc.save()
        doc.translate(LX + 12, doc.y + 7)
        doc.circle(0, 0, 7).fill(SUCCESS)
        doc.path("M-3.5 0l2.5 2.5 4.5-5")
        doc.lineWidth(1.8).lineCap("round").lineJoin("round").stroke(WHITE)
        doc.restore()

        doc.fontSize(10).fillColor(SUCCESS).font(FONT_BOLD)
        doc.text("Credential Verified", LX + 28, doc.y + 3)
        doc.fontSize(6).fillColor(FOREGROUND).font(FONT)
        doc.text("Cryptographic zero-knowledge proof validated on-chain", LX + 28, doc.y + 15)
        doc.y += 34
      } else {
        doc.roundedRect(LX, doc.y, CW, 28, 3)
        doc.fillOpacity(0.06).fill(WARNING).fillOpacity(1)
        doc.roundedRect(LX, doc.y, CW, 28, 3).lineWidth(0.8).stroke(WARNING)

        doc.save()
        doc.translate(LX + 12, doc.y + 7)
        doc.circle(0, 0, 7).fill(WARNING)
        doc.path("M0-2.5v3.5M0 4v0.5")
        doc.lineWidth(1.8).lineCap("round").stroke(WHITE)
        doc.restore()

        doc.fontSize(10).fillColor(WARNING).font(FONT_BOLD)
        doc.text("Claim Not Satisfied", LX + 28, doc.y + 3)
        doc.fontSize(6).fillColor(FOREGROUND).font(FONT)
        doc.text("The submitted credential does not meet the requested claim threshold", LX + 28, doc.y + 15)
        doc.y += 34
      }

      // ════════════════ VERIFICATION DETAILS ═══════════════════════
      section("Verification Details")
      detailRow("Institution", data.institutionName)
      detailRow("Matriculation Number", data.matricNumber)
      detailRow("Employer", data.employerName)
      detailRow("Claim Type", data.claimLabel)
      detailRow("Result", data.result.replace(/_/g, " "))
      detailRow("Submitted", dateFormatter.format(data.createdAt))
      detailRow("Completed", dateFormatter.format(data.completedAt))
      if (data.graduationYear) detailRow("Graduation Year", String(data.graduationYear))
      if (data.threshold > 0) detailRow("Threshold", String(data.threshold))

      // ════════════════ ON-CHAIN PROOF ────────────────────────────
      section("On-Chain Proof")
      detailRow("Network", "Base Sepolia (L2)")
      detailRow("Method", "Groth16 Zero-Knowledge Proof")

      if (data.txHash) {
        detailRow("Transaction Hash", data.txHash, true)

        // QR Code — compact, right-aligned beside the proof info
        const qrSize = 70
        const qrX = LX + CW - qrSize - 4
        let qrY = doc.y + 2

        doc.roundedRect(qrX - 4, qrY - 2, qrSize + 8, qrSize + 28, 3)
        doc.fillOpacity(1).fill(SURFACE_CARD)
        doc.roundedRect(qrX - 4, qrY - 2, qrSize + 8, qrSize + 28, 3)
        doc.lineWidth(0.5).stroke(SURFACE_BORDER)

        const verifyUrl = `${FRONTEND_URL}/verify/check/${data.requestId}`
        drawQr(verifyUrl, qrX, qrY, qrSize)

        doc.fontSize(5).fillColor(MUTED).font(FONT)
        doc.text("Scan to verify", qrX, qrY + qrSize + 2, { width: qrSize, align: "center", lineBreak: false })

        doc.y = qrY + qrSize + 22
      } else {
        doc.fontSize(6).fillColor(MUTED).font(FONT)
        doc.text("No on-chain transaction hash recorded for this verification request.", LX + 6, doc.y, { width: CW - 12 })
        doc.y += 10
      }

      // ════════════════ ZKP DETAILS (only for VERIFIED) ───────────
      if (data.isVerified && data.credentialCommitment) {
        section("Zero-Knowledge Proof Details")

        doc.fontSize(6).fillColor(MUTED).font(FONT)
        doc.text("No student personal data is disclosed. The following values are committed on-chain.", LX + 6, doc.y, { width: CW - 12 })
        doc.y += 8

        if (data.credentialCommitment) detailRow("Poseidon Commitment", data.credentialCommitment, true)
        if (data.credentialNullifier) detailRow("Nullifier", data.credentialNullifier, true)

        if (data.proofJson) {
          try {
            const proof = typeof data.proofJson === "string"
              ? JSON.parse(data.proofJson)
              : data.proofJson
            const proofStr = JSON.stringify(proof, null, 2)
            const lines = proofStr.split("\n")
            const displayLines = lines.slice(0, 4).join("\n") + (lines.length > 4 ? "\n  ..." : "")
            doc.fontSize(5).fillColor(MUTED_SUBTLE).font(FONT_MONO)
            doc.text(displayLines, LX + 6, doc.y, { width: CW - 12 })
            doc.y += lines.length > 4 ? 30 : 24
          } catch { /* skip proof display if parsing fails */ }
        }
      }

      // ════════════════ ISSUED BY ─────────────────────────────────
      const remaining = MAX_Y - doc.y
      if (remaining < 30) {
        doc.y = MAX_Y - 30
      }

      doc.y += 2
      doc.roundedRect(LX, doc.y, CW, 24, 3).fill(SURFACE)
      doc.roundedRect(LX, doc.y, CW, 24, 3).lineWidth(0.5).stroke(SURFACE_BORDER)

      if (LOGO_BUFFER) {
        doc.image(LOGO_BUFFER, LX + 8, doc.y + 3, { width: 18, height: 18 })
      }

      doc.fontSize(7).fillColor(FOREGROUND).font(FONT_BOLD)
      doc.text("Verified by VERIDAQ", LX + 32, doc.y + 3)
      doc.fontSize(5.5).fillColor(MUTED).font(FONT)
      doc.text("Independently verifiable on the Base blockchain", LX + 32, doc.y + 13)
      doc.y += 30

      // ════════════════ FOOTER ────────────────────────────────────
      const fy = PAGE_BOTTOM - 20
      doc.rect(0, fy, doc.page.width, 20).fill(VOID)
      doc.fontSize(5.5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text(
        `Generated ${dateFormatter.format(new Date())}  |  Report ${data.requestId}`,
        M, fy + 5, { width: CW, align: "center" }
      )
      doc.fontSize(5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text(
        "VERIDAQ  -  Censor-Resistant Academic Truth",
        M, fy + 12, { width: CW, align: "center" }
      )

      doc.end()
    })
  }
}
