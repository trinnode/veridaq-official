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

const rawFrontendUrl = process.env.FRONTEND_URL ?? "https://veridaq-official.vercel.app"
const FRONTEND_URL = rawFrontendUrl.replace(/\/+$/, "")

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
        doc.y += 3
        doc.fontSize(7).fillColor(ACCENT).font(FONT_BOLD)
        doc.text(title.toUpperCase(), LX, doc.y)
        doc.y += 1
        doc.rect(LX, doc.y, CW, 0.5).fill(SURFACE_BORDER)
        doc.y += 5
      }

      // ── Detail row ──────────────────────────────────────────────
      function detailRow(label: string, value: string, mono = false) {
        const rh = 13
        const ry = doc.y
        doc.rect(LX, ry, CW, rh).fill(SURFACE)
        doc.fontSize(7).fillColor(MUTED).font(FONT)
        doc.text(label, LX + 6, ry + 3.5, { width: 120 })
        doc.fillColor(FOREGROUND)
        if (mono) doc.font(FONT_MONO).fontSize(6)
        else doc.font(FONT).fontSize(7.5)
        doc.text(value, LX + 130, ry + 3.5, { width: CW - 140, lineBreak: false })
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
      const HEADER_H = 50
      doc.rect(0, 0, doc.page.width, HEADER_H).fill(VOID)

      if (LOGO_BUFFER) {
        doc.image(LOGO_BUFFER, M + 2, 11, { width: 28, height: 28 })
      }

      doc.fontSize(13).fillColor(WHITE).font(FONT_BOLD)
      doc.text("VERIDAQ", M + 36, 13)

      doc.fontSize(6.5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text("Credential Verification Report", M + 36, 29)

      const ref = data.requestId.slice(0, 8).toUpperCase()
      doc.fontSize(7).fillColor(WHITE).font(FONT_MONO)
      doc.text(`REF: ${ref}`, M, 13, { width: CW, align: "right" })
      doc.fontSize(5.5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text("CONFIDENTIAL", M, 25, { width: CW, align: "right" })

      doc.y = HEADER_H + 6

      // ════════════════ RESULT BADGE ═══════════════════════════════
      const badgeY = doc.y

      if (data.isVerified) {
        doc.roundedRect(LX, badgeY, CW, 34, 3)
        doc.fillOpacity(0.06).fill(SUCCESS).fillOpacity(1)
        doc.roundedRect(LX, badgeY, CW, 34, 3).lineWidth(0.8).stroke(SUCCESS)

        doc.save()
        doc.translate(LX + 14, badgeY + 9)
        doc.circle(0, 0, 8).fill(SUCCESS)
        doc.path("M-4 0l3 3 5-6")
        doc.lineWidth(2).lineCap("round").lineJoin("round").stroke(WHITE)
        doc.restore()

        doc.fontSize(12).fillColor(SUCCESS).font(FONT_BOLD)
        doc.text("Credential Verified", LX + 34, badgeY + 5)
        doc.fontSize(6.5).fillColor(FOREGROUND).font(FONT)
        doc.text("Cryptographic zero-knowledge proof validated on-chain", LX + 34, badgeY + 20)
      } else {
        doc.roundedRect(LX, badgeY, CW, 34, 3)
        doc.fillOpacity(0.06).fill(WARNING).fillOpacity(1)
        doc.roundedRect(LX, badgeY, CW, 34, 3).lineWidth(0.8).stroke(WARNING)

        doc.save()
        doc.translate(LX + 14, badgeY + 9)
        doc.circle(0, 0, 8).fill(WARNING)
        doc.path("M0-3v4M0 4.5v1")
        doc.lineWidth(2).lineCap("round").stroke(WHITE)
        doc.restore()

        doc.fontSize(12).fillColor(WARNING).font(FONT_BOLD)
        doc.text("Claim Not Satisfied", LX + 34, badgeY + 5)
        doc.fontSize(6.5).fillColor(FOREGROUND).font(FONT)
        doc.text("The submitted credential does not meet the requested claim threshold", LX + 34, badgeY + 20)
      }

      doc.y = badgeY + 42

      // ════════════════ VERIFICATION DETAILS ═══════════════════════
      section("Verification Details")
      detailRow("Institution", data.institutionName)
      detailRow("Matriculation Number", data.matricNumber)
      detailRow("Employer", data.employerName)
      detailRow("Employer Email", data.employerEmail)
      detailRow("Claim Type", data.claimLabel)
      if (data.claimDescription) detailRow("Description", data.claimDescription)
      detailRow("Result", data.result.replace(/_/g, " "))
      detailRow("Submitted", dateFormatter.format(data.createdAt))
      detailRow("Completed", dateFormatter.format(data.completedAt))
      if (data.graduationYear) detailRow("Graduation Year", String(data.graduationYear))
      if (data.threshold > 0) detailRow("Threshold", String(data.threshold))
      detailRow("Institution Chain ID", data.institutionOnChainId, true)

      // ════════════════ ON-CHAIN PROOF ────────────────────────────
      section("On-Chain Proof")
      detailRow("Network", "Base Sepolia (L2)")
      detailRow("Method", "Groth16 Zero-Knowledge Proof")

      if (data.txHash) {
        detailRow("Transaction Hash", data.txHash, true)
      }

      // ════════════════ QR CODE — always shown ────────────────────
      doc.y += 3

      const qrSectionY = doc.y
      const qrSize = 90
      const qrX = LX + (CW - qrSize) / 2
      const qrCardH = qrSize + 46

      doc.roundedRect(LX, qrSectionY, CW, qrCardH, 4)
      doc.fillOpacity(1).fill(SURFACE_CARD)
      doc.roundedRect(LX, qrSectionY, CW, qrCardH, 4)
      doc.lineWidth(0.8).stroke(SURFACE_BORDER)

      const verifyUrl = `${FRONTEND_URL}/verify/check/${data.requestId}`
      drawQr(verifyUrl, qrX, qrSectionY + 6, qrSize)

      doc.fontSize(8).fillColor(FOREGROUND).font(FONT_BOLD)
      doc.text("Scan to Verify Authenticity", LX, qrSectionY + qrSize + 10, {
        width: CW, align: "center", lineBreak: false,
      })

      doc.fontSize(6).fillColor(MUTED).font(FONT)
      const qrLabel = data.txHash
        ? "Scan to view this verified credential on the VERIDAQ verification portal"
        : "Scan to view this verification record on the VERIDAQ portal"
      doc.text(qrLabel, LX, qrSectionY + qrSize + 24, {
        width: CW, align: "center", lineBreak: false,
      })

      doc.y = qrSectionY + qrCardH + 4

      // ════════════════ ZKP DETAILS (only for VERIFIED) ───────────
      if (data.isVerified && data.credentialCommitment) {
        section("Zero-Knowledge Proof Details")

        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text("No student personal data is disclosed. The following values are committed on-chain.", LX + 6, doc.y, { width: CW - 12 })
        doc.y += 10

        if (data.credentialCommitment) detailRow("Poseidon Commitment", data.credentialCommitment, true)
        if (data.credentialNullifier) detailRow("Nullifier", data.credentialNullifier, true)

        if (data.proofJson) {
          doc.y += 2
          try {
            const proof = typeof data.proofJson === "string"
              ? JSON.parse(data.proofJson)
              : data.proofJson
            const proofStr = JSON.stringify(proof, null, 2)
            const lines = proofStr.split("\n")
            const displayLines = lines.slice(0, 4).join("\n") + (lines.length > 4 ? "\n  ..." : "")
            doc.fontSize(5.5).fillColor(MUTED_SUBTLE).font(FONT_MONO)
            doc.text(displayLines, LX + 6, doc.y, { width: CW - 12 })
            doc.y += lines.length > 4 ? 34 : 28
          } catch { /* skip proof display if parsing fails */ }
        }
      }

      // ════════════════ AUTHENTICITY SEAL ─────────────────────────
      const sealY = Math.min(doc.y, MAX_Y - 46)

      const sealCardH = 40
      doc.roundedRect(LX, sealY, CW, sealCardH, 4).fill(SURFACE)
      doc.roundedRect(LX, sealY, CW, sealCardH, 4).lineWidth(0.8).stroke(SURFACE_BORDER)

      if (LOGO_BUFFER) {
        doc.image(LOGO_BUFFER, LX + 10, sealY + 9, { width: 22, height: 22 })
      }

      doc.fontSize(8.5).fillColor(FOREGROUND).font(FONT_BOLD)
      doc.text(`Verified by ${data.institutionName} through VERIDAQ`, LX + 40, sealY + 5, {
        width: CW - 50, lineBreak: false,
      })

      doc.fontSize(6).fillColor(MUTED).font(FONT)
      doc.text("This verification is independently verifiable on the Base blockchain", LX + 40, sealY + 19, {
        width: CW - 50, lineBreak: false,
      })

      doc.fontSize(5.5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text(`Issued to: ${data.employerName}`, LX + 40, sealY + 30, {
        width: CW - 50, lineBreak: false,
      })

      doc.y = sealY + sealCardH + 4

      // ════════════════ FOOTER ────────────────────────────────────
      const fy = PAGE_BOTTOM - 22
      doc.rect(0, fy, doc.page.width, 22).fill(VOID)
      doc.fontSize(6).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text(
        `Generated ${dateFormatter.format(new Date())}  |  Report ${data.requestId}`,
        M, fy + 5, { width: CW, align: "center" }
      )
      doc.fontSize(5.5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text(
        "VERIDAQ \u2014 Censor-Resistant Academic Truth",
        M, fy + 13, { width: CW, align: "center" }
      )

      doc.end()
    })
  }
}
