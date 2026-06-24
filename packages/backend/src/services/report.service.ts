import { PrismaClient } from "@prisma/client"
import PDFDocument from "pdfkit"
import qr from "qr-image"

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
const LOGO_RED = "#e11d48"
const SUCCESS = "#16a34a"
const WARNING = "#d97706"
const WHITE = "#ffffff"
const LINK = "#2563eb"

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

      // ── VERIDAQ Shield Logo ─────────────────────────────────────
      function drawShieldLogo(x: number, y: number, size: number) {
        const s = size / 512
        doc.save()
        doc.translate(x, y)
        doc.scale(s)

        // Shield outline
        doc.path("M256 464c0 0 170-85 170-213V106l-170-64-170 64v145c0 128 170 213 170 213z")
        doc.fill(LOGO_RED)

        // Checkmark
        doc.path("M170 256l56 56 120-120")
        doc.lineWidth(40)
        doc.lineCap("round")
        doc.lineJoin("round")
        doc.stroke(WHITE)

        doc.restore()
      }

      // ── Section heading ─────────────────────────────────────────
      function section(title: string) {
        if (doc.y + 30 > PAGE_BOTTOM) { doc.addPage() }
        doc.y += 10
        doc.fontSize(10).fillColor(ACCENT).font(FONT_BOLD)
        doc.text(title, LX, doc.y)
        doc.y += 2
        doc.rect(LX, doc.y, CW, 1).fill(SURFACE_BORDER)
        doc.y += 8
      }

      // ── Detail row ──────────────────────────────────────────────
      function detailRow(label: string, value: string, mono = false) {
        const rh = 16
        if (doc.y + rh > PAGE_BOTTOM) { doc.addPage() }
        const ry = doc.y
        // Subtle background
        doc.rect(LX, ry, CW, rh).fill(SURFACE)
        doc.fontSize(8).fillColor(MUTED).font(FONT)
        doc.text(label, LX + 10, ry + 4, { width: 140 })
        doc.fillColor(FOREGROUND)
        if (mono) doc.font(FONT_MONO).fontSize(7)
        else doc.font(FONT).fontSize(8.5)
        doc.text(value, LX + 155, ry + 4, { width: CW - 170, lineBreak: false })
        doc.y = ry + rh
      }

      // ── QR Code ─────────────────────────────────────────────────
      function drawQr(url: string, x: number, y: number, size: number) {
        try {
          const qrBuffer = qr.imageSync(url, { type: "png", size: 10, margin: 1 })
          doc.image(qrBuffer, x, y, { width: size, height: size })
        } catch {
          doc.fontSize(6).fillColor(MUTED).font(FONT)
          doc.text("QR: " + url, x, y, { width: size, lineBreak: false })
        }
      }

      // ════════════════ HEADER ═════════════════════════════════════
      doc.rect(0, 0, doc.page.width, 56).fill(VOID)

      // Logo
      drawShieldLogo(M + 2, 10, 36)

      // Title
      doc.fontSize(14).fillColor(WHITE).font(FONT_BOLD)
      doc.text("VERIDAQ", M + 46, 13)

      doc.fontSize(7).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text("Credential Verification Report", M + 46, 31)

      // Reference
      const ref = data.requestId.slice(0, 8).toUpperCase()
      doc.fontSize(9).fillColor(WHITE).font(FONT_MONO)
      doc.text(`REF: ${ref}`, M, 12, { width: CW, align: "right" })
      doc.fontSize(6.5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text("CONFIDENTIAL", M, 26, { width: CW, align: "right" })

      doc.y = 66

      // ════════════════ RESULT BADGE ═══════════════════════════════
      if (data.isVerified) {
        // Verified badge
        doc.roundedRect(LX, doc.y, CW, 36, 4)
        doc.fillOpacity(0.06).fill(SUCCESS).fillOpacity(1)
        doc.roundedRect(LX, doc.y, CW, 36, 4).lineWidth(1).stroke(SUCCESS)

        // Checkmark icon
        doc.save()
        doc.translate(LX + 14, doc.y + 10)
        doc.circle(0, 0, 8).fill(SUCCESS)
        doc.path("M-4 0l3 3 5-6")
        doc.lineWidth(2).lineCap("round").lineJoin("round").stroke(WHITE)
        doc.restore()

        doc.fontSize(13).fillColor(SUCCESS).font(FONT_BOLD)
        doc.text("Credential Verified", LX + 34, doc.y + 5)
        doc.fontSize(7.5).fillColor(FOREGROUND).font(FONT)
        doc.text("Cryptographic zero-knowledge proof validated on-chain", LX + 34, doc.y + 21)
        doc.y += 44
      } else {
        // Not satisfied badge
        doc.roundedRect(LX, doc.y, CW, 36, 4)
        doc.fillOpacity(0.06).fill(WARNING).fillOpacity(1)
        doc.roundedRect(LX, doc.y, CW, 36, 4).lineWidth(1).stroke(WARNING)

        doc.save()
        doc.translate(LX + 14, doc.y + 10)
        doc.circle(0, 0, 8).fill(WARNING)
        doc.path("M0-3v4M0 4v1")
        doc.lineWidth(2).lineCap("round").stroke(WHITE)
        doc.restore()

        doc.fontSize(13).fillColor(WARNING).font(FONT_BOLD)
        doc.text("Claim Not Satisfied", LX + 34, doc.y + 5)
        doc.fontSize(7.5).fillColor(FOREGROUND).font(FONT)
        doc.text("The submitted credential does not meet the requested claim threshold", LX + 34, doc.y + 21)
        doc.y += 44
      }

      // ════════════════ VERIFICATION DETAILS ═══════════════════════
      section("Verification Details")
      detailRow("Institution", data.institutionName)
      detailRow("Matriculation Number", data.matricNumber)
      detailRow("Employer", data.employerName)
      detailRow("Employer Email", data.employerEmail)
      detailRow("Claim Type", data.claimLabel)
      detailRow("Result", data.result.replace(/_/g, " "))
      detailRow("Submitted", dateFormatter.format(data.createdAt))
      detailRow("Completed", dateFormatter.format(data.completedAt))
      if (data.claimDescription) detailRow("Description", data.claimDescription)
      if (data.threshold > 0) detailRow("Threshold", String(data.threshold))
      if (data.graduationYear) detailRow("Graduation Year", String(data.graduationYear))
      detailRow("Institution Chain ID", data.institutionOnChainId, true)

      doc.y += 4

      // ════════════════ ON-CHAIN PROOF ═════════════════════════════
      section("On-Chain Proof")
      detailRow("Network", "Base Sepolia (L2)")
      detailRow("Verification Method", "Groth16 Zero-Knowledge Proof")

      if (data.txHash) {
        detailRow("Transaction Hash", data.txHash, true)

        // QR Code — scan to verify on blockchain explorer
        doc.y += 4
        const txUrl = `https://sepolia.basescan.org/tx/${data.txHash}`
        const qrSize = 90
        const qrX = LX + CW - qrSize - 10
        const qrY = doc.y

        // QR container card
        doc.roundedRect(qrX - 8, qrY - 6, qrSize + 16, qrSize + 38, 4)
        doc.fillOpacity(1).fill(SURFACE_CARD)
        doc.roundedRect(qrX - 8, qrY - 6, qrSize + 16, qrSize + 38, 4)
        doc.lineWidth(1).stroke(SURFACE_BORDER)

        drawQr(txUrl, qrX, qrY, qrSize)

        doc.fontSize(6.5).fillColor(MUTED).font(FONT)
        doc.text("Scan to verify", qrX, qrY + qrSize + 4, { width: qrSize, align: "center", lineBreak: false })

        // Description text beside QR
        doc.fontSize(8).fillColor(FOREGROUND).font(FONT_BOLD)
        doc.text("Blockchain Proof", LX + 10, qrY + 2)
        doc.fontSize(7).fillColor(MUTED).font(FONT)
        doc.text("Scan the QR code to view the verified", LX + 10, qrY + 14)
        doc.text("transaction on Base Sepolia (BaseScan).", LX + 10, qrY + 24)
        doc.text("This proves the credential check was", LX + 10, qrY + 34)
        doc.text("executed and validated on-chain.", LX + 10, qrY + 44)
        doc.fontSize(6.5).fillColor(LINK).font(FONT_MONO)
        doc.text(txUrl.replace("https://", ""), LX + 10, qrY + 58, { width: qrX - LX - 26, lineBreak: false })

        doc.y = qrY + qrSize + 28
      } else {
        doc.y += 4
        doc.fontSize(7.5).fillColor(MUTED).font(FONT)
        doc.text("No on-chain transaction hash recorded for this verification request.", LX + 8, doc.y, { width: CW - 16 })
        doc.y += 14
      }

      doc.y += 2

      // ════════════════ ZERO-KNOWLEDGE PROOF (only for VERIFIED) ══
      if (data.isVerified) {
        section("Zero-Knowledge Proof Details")

        const zkpNote = "The following cryptographic values are committed on-chain and were verified" +
          " using a Groth16 zero-knowledge proof. No student personal data is disclosed."
        doc.fontSize(7).fillColor(MUTED).font(FONT)
        doc.text(zkpNote, LX + 8, doc.y, { width: CW - 16 })
        doc.y += 12

        if (data.credentialCommitment) detailRow("Poseidon Commitment", data.credentialCommitment, true)
        if (data.credentialNullifier) detailRow("Nullifier", data.credentialNullifier, true)

        if (data.proofJson) {
          doc.y += 4
          doc.fontSize(7).fillColor(FOREGROUND).font(FONT_BOLD)
          doc.text("Groth16 Proof", LX + 8, doc.y)
          doc.y += 4
          try {
            const proof = typeof data.proofJson === "string"
              ? JSON.parse(data.proofJson)
              : data.proofJson
            const proofStr = JSON.stringify(proof, null, 2)
            const lines = proofStr.split("\n")
            // Show first 6 lines of the proof
            const displayLines = lines.slice(0, 6).join("\n") + (lines.length > 6 ? "\n  ..." : "")
            doc.fontSize(6).fillColor(MUTED_SUBTLE).font(FONT_MONO)
            doc.text(displayLines, LX + 10, doc.y, { width: CW - 20 })
            doc.y += lines.length > 6 ? 50 : 40
          } catch { /* skip proof display if parsing fails */ }
        }

        doc.y += 4
      }

      // ════════════════ VERIFICATION QR CODE ═══════════════════════
      doc.y += 2
      section("Verification QR Code")

      const bigQrSize = 110
      const bigQrX = LX + (CW - bigQrSize) / 2
      const bigQrY = doc.y + 4

      // Card container
      doc.roundedRect(LX, doc.y, CW, bigQrSize + 80, 6)
      doc.fillOpacity(1).fill(SURFACE)
      doc.roundedRect(LX, doc.y, CW, bigQrSize + 80, 6)
      doc.lineWidth(1).stroke(SURFACE_BORDER)

      // Large QR code
      const verifyUrl = data.txHash
        ? `https://sepolia.basescan.org/tx/${data.txHash}`
        : `https://veridaq-official.vercel.app/verify/check?id=${data.requestId}`
      drawQr(verifyUrl, bigQrX, bigQrY, bigQrSize)

      doc.fontSize(9).fillColor(FOREGROUND).font(FONT_BOLD)
      doc.text("Scan to Verify Authenticity", LX, bigQrY + bigQrSize + 10, { width: CW, align: "center", lineBreak: false })

      doc.fontSize(7).fillColor(MUTED).font(FONT)
      doc.text(
        "Scan this QR code with any smartphone to independently verify the blockchain proof",
        LX, bigQrY + bigQrSize + 26, { width: CW, align: "center", lineBreak: false }
      )

      doc.y = bigQrY + bigQrSize + 56

      // ════════════════ ISSUED BY ─────────────────────────────────
      doc.y += 6
      doc.roundedRect(LX, doc.y, CW, 36, 4).fill(SURFACE)
      doc.roundedRect(LX, doc.y, CW, 36, 4).lineWidth(1).stroke(SURFACE_BORDER)

      // Small shield logo
      drawShieldLogo(LX + 12, doc.y + 6, 24)

      doc.fontSize(8).fillColor(FOREGROUND).font(FONT_BOLD)
      doc.text("Verified by VERIDAQ", LX + 44, doc.y + 6)
      doc.fontSize(6.5).fillColor(MUTED).font(FONT)
      doc.text("This verification is independently verifiable on the Base blockchain", LX + 44, doc.y + 20)
      doc.y += 44

      // ════════════════ FOOTER ═════════════════════════════════════
      const fy = PAGE_BOTTOM - 28
      doc.rect(0, fy, doc.page.width, 28).fill(VOID)
      doc.fontSize(6.5).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text(
        `Generated ${dateFormatter.format(new Date())}  ·  Report ${data.requestId}`,
        M, fy + 7, { width: CW, align: "center" }
      )
      doc.fontSize(6).fillColor(MUTED_SUBTLE).font(FONT)
      doc.text(
        "VERIDAQ \u2014 Censor-Resistant Academic Truth",
        M, fy + 17, { width: CW, align: "center" }
      )

      doc.end()
    })
  }
}
