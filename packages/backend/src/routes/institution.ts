/**
 * Institution routes — batch uploads, claim management, verification audit log.
 *
 * POST /api/institution/batch/upload   — upload and validate Excel file
 * GET  /api/institution/batch          — list all batches for this institution
 * GET  /api/institution/batch/:id      — get a specific batch with credentials
 * POST /api/institution/claims         — create a claim definition
 * GET  /api/institution/claims         — list claim definitions
 * PATCH /api/institution/claims/:id    — update a claim definition
 * POST /api/institution/revoke         — revoke a credential
 * GET  /api/institution/verifications  — list verification requests for this institution
 * GET  /api/institution/profile        — get institution profile
 * GET  /api/institution/billing        — get Paymaster balance
 */

import bcryptjs from "bcryptjs"
import crypto from "crypto"
import ExcelJS from "exceljs"
import type { FastifyPluginAsync } from "fastify"
import { formatEther } from "viem"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { config } from "../config/index.js"
import { InstitutionService } from "../services/institution.service.js"
import { formatCgpaRange, getCgpaRange, isCgpaInRange } from "../utils/cgpa.js"
import { BatchQueue } from "../workers/batch.queue.js"

const claimBody = z.object({
  label: z.string().min(3).max(100),
  claimCode: z.number().int().min(1).max(6),
  threshold: z.number().int().min(0).max(500).default(0),
  reviewType: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  active: z.boolean().optional(),
  description: z.string().optional(),
})

const revokeBody = z.object({
  nullifier: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid nullifier format"),
  reasonCode: z.number().int().min(1).max(5),
})

export const institutionRoutes: FastifyPluginAsync = async (app) => {
  const instSvc = new InstitutionService(app.prisma)
  const batchQueue = new BatchQueue(config.REDIS_URL)

  app.addHook("preHandler", app.requireInstitution)

  // ── Excel batch upload ──────────────────────────────────────────────────

  app.get("/batch/template", async (_req, rep) => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Batch Template")

    sheet.columns = [
      { header: "MatricNumber", key: "matricNumber", width: 18 },
      { header: "StudentName", key: "studentName", width: 28 },
      { header: "CGPA", key: "cgpa", width: 8 },
      { header: "Classification", key: "classification", width: 18 },
      { header: "CourseName", key: "courseName", width: 24 },
      { header: "GraduationYear", key: "graduationYear", width: 16 },
    ]

    sheet.addRow({
      matricNumber: "FUT/MIN/2020/001",
      studentName: "Example Student",
      cgpa: 4.2,
      classification: "Second Class Upper",
      courseName: "Computer Science",
      graduationYear: 2024,
    })

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    rep.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    rep.header("content-disposition", "attachment; filename=veridaq_template.xlsx")
    return rep.send(buffer)
  })

  app.post("/batch/validate", async (req, rep) => {
    const data = await req.file()
    if (!data) return rep.code(400).send({ error: "No file uploaded" })

    const ext = data.filename.split(".").pop()?.toLowerCase()
    if (ext !== "xlsx") return rep.code(400).send({ error: "Only .xlsx files are accepted" })

    try {
      const workbook = new ExcelJS.Workbook()
      const buffer = (await data.toBuffer()) as Buffer
      await workbook.xlsx.load(buffer as unknown as any)
      const sheet = workbook.worksheets[0]

      if (!sheet) {
        return rep.code(400).send({ errors: [{ row: 0, error: "No sheets found" }] })
      }

      const normalizeHeader = (value: unknown): string =>
        String(value ?? "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")

      const parseClassification = (raw: unknown): number => {
        if (typeof raw === "number") return raw
        const text = String(raw ?? "")
          .trim()
          .toLowerCase()
        const mapped: Record<string, number> = {
          "second class upper": 3,
          "second class lower": 2,
          third: 1,
          "third class": 1,
          pass: 0,
          "2": 2,
          "2.2": 2,
          "lower second": 2,
          "lower second class": 2,
          "3": 3,
          "2.1": 3,
          "upper second": 3,
          "upper second class": 3,
          "4": 4,
          first: 4,
          "first class": 4,
        }
        return mapped[text] ?? Number(text)
      }

      const headerRow = sheet.getRow(1)
      const headerIndexes: Record<string, number> = {}

      headerRow.eachCell((cell, colNumber) => {
        const key = normalizeHeader(cell.value)
        if (key) headerIndexes[key] = colNumber
      })

      const pickHeaderIndex = (aliases: string[]): number | undefined => {
        for (const alias of aliases) {
          const idx = headerIndexes[alias]
          if (idx) return idx
        }
        return undefined
      }

      const idxStudentName = pickHeaderIndex(["STUDENTNAME"])
      const idxMatricNumber = pickHeaderIndex(["MATRICNUMBER"])
      const idxCourse = pickHeaderIndex(["PROGRAMCOURSE", "COURSENAME"])
      const idxCgpa = pickHeaderIndex(["CGPA"])
      const idxClassification = pickHeaderIndex(["CLASSIFICATION"])
      const idxGradYear = pickHeaderIndex(["GRADUATIONYEAR"])

      if (
        !idxMatricNumber ||
        !idxStudentName ||
        !idxCourse ||
        !idxCgpa ||
        !idxClassification ||
        !idxGradYear
      ) {
        return rep.code(400).send({
          errors: [
            {
              row: 0,
              error:
                "Missing required headers. Expected MatricNumber, StudentName, CGPA, Classification, CourseName, GraduationYear",
            },
          ],
        })
      }

      const errors: Array<{ row: number; error: string }> = []
      let validCount = 0

      const rowSchema = z.object({
        matricNumber: z.string().min(2),
        studentName: z.string().min(2),
        courseName: z.string().min(2),
        cgpa: z.coerce.number().min(1).max(5),
        classification: z.coerce.number().int().min(0).max(4),
        graduationYear: z.coerce.number().int().min(1950).max(2100),
      })

      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber)

        const rawStudentName = String(row.getCell(idxStudentName).value ?? "").trim()
        const rawMatricNumber = String(row.getCell(idxMatricNumber).value ?? "").trim()
        const rawCourseName = String(row.getCell(idxCourse).value ?? "").trim()
        const rawCgpa = row.getCell(idxCgpa).value
        const rawClassification = row.getCell(idxClassification).value
        const rawGradYear = row.getCell(idxGradYear).value

        // Ignore fully empty data rows.
        if (
          !rawMatricNumber &&
          !rawStudentName &&
          !rawCourseName &&
          !rawCgpa &&
          !rawClassification &&
          !rawGradYear
        ) {
          continue
        }

        const res = rowSchema.safeParse({
          matricNumber: rawMatricNumber,
          studentName: rawStudentName,
          courseName: rawCourseName,
          cgpa: rawCgpa,
          classification: parseClassification(rawClassification),
          graduationYear: rawGradYear,
        })

        if (!res.success) {
          const firstError = res.error.errors[0]
          const path = firstError?.path?.[0] ?? "field"
          const message = firstError?.message ?? "Invalid value"
          errors.push({
            row: rowNumber,
            error: message + " at " + path,
          })
        } else {
          const cgpaInt = Math.round(res.data.cgpa * 100)
          if (!isCgpaInRange(cgpaInt, res.data.classification)) {
            const range = getCgpaRange(res.data.classification)
            const rangeLabel = range ? `${range.label} ${formatCgpaRange(range)}` : "Unknown"
            errors.push({
              row: rowNumber,
              error: `CGPA ${res.data.cgpa.toFixed(2)} does not match classification range ${rangeLabel}`,
            })
          } else {
            validCount++
          }
        }
      }

      if (errors.length > 0) {
        return rep.code(400).send({ valid: false, errors, totalRecords: validCount })
      }

      const billing = await instSvc.getBilling(req.jwtPayload.sub)
      let simulation: {
        maxCostWei: string
        maxCostEth: string
        needsInit: boolean
        isSponsored: boolean
        institutionTier: number
        sponsoredPool: string
        institutionBalance: string
        entryPointDepositWei: string
        entryPointDepositEth: string
        availableFundsWei: string
        availableFundsEth: string
        fundingShortfallWei: string
        fundingShortfallEth: string
        hasEnoughFunds: boolean
        hasEnoughEntryPointDeposit: boolean
      } | null = null
      let simulationError: string | null = null

      try {
        const { BlockchainService } = await import("../services/blockchain.service.js")
        const bSvc = new BlockchainService()
        const institution = await app.prisma.institution.findUnique({
          where: { id: req.jwtPayload.sub },
          select: { onChainId: true },
        })
        if (!institution?.onChainId) {
          throw new Error("Institution on-chain id missing")
        }
        const estimate = await bSvc.estimateBatchUserOpCost(
          institution.onChainId as `0x${string}`,
          validCount,
          new Date().getFullYear(),
          1
        )

        simulation = {
          ...estimate,
        }
      } catch (err: unknown) {
        const estimateError = err as {
          message?: string
          sponsoredPool?: string
          institutionBalance?: string
          entryPointDeposit?: string
          availableFundsWei?: string
          availableFundsEth?: string
          fundingShortfallWei?: string
          fundingShortfallEth?: string
          hasEnoughFunds?: boolean
          hasEnoughEntryPointDeposit?: boolean
          maxCostEstimate?: string
        }

        if (estimateError.maxCostEstimate) {
          simulation = {
            maxCostWei: estimateError.maxCostEstimate,
            maxCostEth: formatEther(BigInt(estimateError.maxCostEstimate)),
            needsInit: false,
            isSponsored: billing?.tier === "FREE",
            institutionTier: billing?.tier === "FREE" ? 0 : 1,
            sponsoredPool: estimateError.sponsoredPool ?? "0",
            institutionBalance: estimateError.institutionBalance ?? "0",
            entryPointDepositWei: estimateError.entryPointDeposit ?? "0",
            entryPointDepositEth: estimateError.entryPointDeposit
              ? formatEther(BigInt(estimateError.entryPointDeposit))
              : "0",
            availableFundsWei: estimateError.availableFundsWei ?? "0",
            availableFundsEth: estimateError.availableFundsEth ?? "0",
            fundingShortfallWei: estimateError.fundingShortfallWei ?? "0",
            fundingShortfallEth: estimateError.fundingShortfallEth ?? "0",
            hasEnoughFunds: estimateError.hasEnoughFunds ?? false,
            hasEnoughEntryPointDeposit: estimateError.hasEnoughEntryPointDeposit ?? false,
          }
        }

        simulationError = estimateError.message?.includes("Invalid parameters")
          ? "Gas estimation unavailable — institution may need on-chain re-approval"
          : estimateError.message ?? "Simulation failed"
      }

      return rep.send({
        valid: true,
        totalRecords: validCount,
        gasSponsored: billing?.tier === "FREE",
        estimatedGasWei: "500000000000000",
        simulation,
        simulationError,
      })
    } catch {
      return rep.code(400).send({ errors: [{ row: 0, error: "Failed to parse excel file" }] })
    }
  })

  app.post("/batch/upload", async (req, rep) => {
    const institutionId = req.jwtPayload.sub
    const data = await req.file()
    if (!data) return rep.code(400).send({ error: "No file uploaded" })

    const ext = data.filename.split(".").pop()?.toLowerCase()
    if (ext !== "xlsx") return rep.code(400).send({ error: "Only .xlsx files are accepted" })

    const buffer = await data.toBuffer()
    const headerSnippet = buffer.slice(0, 4).toString("hex")
    if (headerSnippet !== "504b0304") {
      return rep.code(400).send({ error: "File is not a valid .xlsx (ZIP) archive" })
    }

    try {
      const job = await batchQueue.enqueue({ institutionId, fileBuffer: buffer.toString("base64") })
      return rep.code(202).send({ jobId: job.id, message: "File received. Validation in progress." })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Queue error"
      return rep.code(500).send({ error: `Failed to enqueue batch: ${msg}` })
    }
  })

  app.post("/aa/predeploy", async (_req, rep) => {
    try {
      const { BlockchainService } = await import("../services/blockchain.service.js")
      const bSvc = new BlockchainService()
      const result = await bSvc.predeployAaAccount()
      return rep.send(result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Predeploy failed"
      return rep.code(500).send({ error: message })
    }
  })

  // ── Batches ─────────────────────────────────────────────────────────────

  app.get("/batch", async (req) => {
    const { sub: institutionId } = req.jwtPayload
    const q = req.query as { page?: string; limit?: string }
    return instSvc.listBatches(institutionId, Number(q.page ?? 1), Number(q.limit ?? 10))
  })

  app.get("/batch/:id", async (req, rep) => {
    const { id } = req.params as { id: string }
    const result = await instSvc.getBatch(id, req.jwtPayload.sub)
    if (!result) return rep.code(404).send({ error: "Batch not found" })
    return result
  })

  app.delete("/batch/:id", async (req, rep) => {
    const { id } = req.params as { id: string }
    const result = await instSvc.deleteBatch(id, req.jwtPayload.sub)
    if (!result) return rep.code(404).send({ error: "Batch not found" })
    if ("error" in result) return rep.code(400).send({ error: result.error })
    return rep.code(204).send()
  })

  // ── Claims ──────────────────────────────────────────────────────────────

  app.post("/claims", async (req, rep) => {
    try {
      const body = claimBody.parse(req.body)
      const institutionId = req.jwtPayload.sub
      const claim = await instSvc.createClaim(institutionId, body)
      return rep.code(201).send(claim)
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return rep.code(400).send({ error: "Validation failed", details: err.errors })
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          return rep.code(409).send({
            error: "A claim with this claim code and threshold already exists for your institution",
          })
        }
        if (err.code === "P2003") {
          return rep.code(500).send({ error: "Institution reference not found" })
        }
      }
      throw err
    }
  })

  app.get("/claims", async (req) => {
    const institutionId = req.jwtPayload.sub
    let items = await instSvc.listClaims(institutionId)
    // Auto-create default claims if institution has none (covers pre-existing institutions)
    if (items.length === 0) {
      const defaults = [
        { label: "Programme Completion", claimCode: 1, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student completed their programme" },
        { label: "Minimum Lower Second Class", claimCode: 2, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved at least Second Class Lower division" },
        { label: "Minimum Upper Second Class", claimCode: 3, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved at least Second Class Upper division" },
        { label: "First Class Honours", claimCode: 4, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student achieved First Class honours" },
        { label: "CGPA ≥ 2.0", claimCode: 5, threshold: 200, reviewType: "AUTO" as const, description: "Verify CGPA is at least 2.00" },
        { label: "CGPA ≥ 3.0", claimCode: 5, threshold: 300, reviewType: "AUTO" as const, description: "Verify CGPA is at least 3.00" },
        { label: "CGPA ≥ 3.5", claimCode: 5, threshold: 350, reviewType: "AUTO" as const, description: "Verify CGPA is at least 3.50" },
        { label: "Programme-Specific Completion", claimCode: 6, threshold: 0, reviewType: "AUTO" as const, description: "Verify the student completed a specific programme and graduated" },
        { label: "CGPA ≥ 4.0 — Manual Review", claimCode: 5, threshold: 400, reviewType: "MANUAL" as const, description: "Verify CGPA is at least 4.00 — requires manual institution confirmation" },
      ]
      try {
        await app.prisma.claimDefinition.createMany({
          data: defaults.map((cd) => ({
            institutionId,
            label: cd.label,
            claimCode: cd.claimCode,
            threshold: cd.threshold,
            reviewType: cd.reviewType,
            description: cd.description,
            active: true,
          })),
          skipDuplicates: true,
        })
        items = await instSvc.listClaims(institutionId)
      } catch { /* ignore */ }
    }
    return { items }
  })

  app.patch("/claims/:id", async (req, rep) => {
    const { id } = req.params as { id: string }
    const body = claimBody.partial().parse(req.body)
    const updateData = {
      ...(body.label ? { label: body.label } : {}),
      ...(typeof body.claimCode === "number" ? { claimCode: body.claimCode } : {}),
      ...(typeof body.threshold === "number" ? { threshold: body.threshold } : {}),
      ...(body.reviewType ? { reviewType: body.reviewType } : {}),
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(body.description ? { description: body.description } : {}),
    }
    const claim = await instSvc.updateClaim(id, req.jwtPayload.sub, updateData)
    if (!claim) return rep.code(404).send({ error: "Claim not found" })
    return claim
  })

  // ── Revocation ──────────────────────────────────────────────────────────

  app.post("/revoke", async (req, rep) => {
    try {
      const { nullifier, reasonCode } = revokeBody.parse(req.body)
      const institutionId = req.jwtPayload.sub
      const result = await instSvc.revokeCredential(institutionId, nullifier, reasonCode)
      if (!result.ok) return rep.code(400).send({ error: result.error })
      return { ok: true }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return rep.code(400).send({ error: "Validation failed", details: err.errors })
      }
      throw err
    }
  })

  // ── Verifications ───────────────────────────────────────────────────────

  app.get("/verifications", async (req) => {
    const q = req.query as { status?: string; page?: string }
    return instSvc.listVerifications(req.jwtPayload.sub, q.status, Number(q.page ?? 1))
  })

  app.post("/verifications/:id/approve", async (req, rep) => {
    const { id } = req.params as { id: string }
    const result = await instSvc.approveVerification(id, req.jwtPayload.sub)
    if (!result.ok) return rep.code(400).send({ error: result.error })
    return { ok: true }
  })

  app.post("/verifications/:id/decline", async (req, rep) => {
    const { id } = req.params as { id: string }
    const result = await instSvc.declineVerification(id, req.jwtPayload.sub)
    if (!result.ok) return rep.code(400).send({ error: result.error })
    return { ok: true }
  })

  // ── Employer access toggle ──────────────────────────────────────────────

  app.patch("/employer-access", async (req, rep) => {
    const institutionId = req.jwtPayload.sub
    const body = req.body as { enabled: boolean } | null
    const enabled = body?.enabled ?? false

    const inst = await app.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, name: true, alsoEmployer: true, employerProfile: { select: { id: true, active: true } } },
    })
    if (!inst) return rep.code(404).send({ error: "Institution not found" })

    if (enabled && !inst.employerProfile) {
      // Create linked employer profile
      const empWallet = `0x${crypto.randomBytes(20).toString("hex")}`
      const empHash = await bcryptjs.hash(crypto.randomBytes(32).toString("hex"), 12)
      await app.prisma.employer.create({
        data: {
          name: inst.name,
          cacNumber: `INST-AUTO-${institutionId.slice(0, 8).toUpperCase()}`,
          email: `emp-${institutionId.slice(0, 8)}@veridaq.internal`,
          passwordHash: empHash,
          walletAddress: empWallet,
          kycApproved: false,
          active: true,
          institutionId: inst.id,
          freeVerificationsRemaining: 3,
        },
      })
    }

    if (!enabled && inst.employerProfile) {
      // Deactivate (don't delete) the employer profile
      await app.prisma.employer.update({
        where: { id: inst.employerProfile.id },
        data: { active: false },
      })
    }

    await app.prisma.institution.update({
      where: { id: institutionId },
      data: { alsoEmployer: enabled },
    })

    return { ok: true, alsoEmployer: enabled }
  })

  // ── Profile and billing ─────────────────────────────────────────────────

  app.get("/dashboard", async (req) => {
    return instSvc.getDashboardStats(req.jwtPayload.sub)
  })

  app.get("/profile", async (req) => {
    return instSvc.getProfile(req.jwtPayload.sub)
  })

  app.get("/billing", async (req) => {
    return instSvc.getBilling(req.jwtPayload.sub)
  })

  app.post("/billing/sync", async (req, rep) => {
    try {
      const result = await instSvc.syncPaymasterBalance(req.jwtPayload.sub)
      if (!result) return rep.code(404).send({ error: "Institution not found" })
      return result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync failed"
      return rep.code(500).send({ error: message })
    }
  })

  // ── Payment History ──────────────────────────────────────────────────────
  app.get("/payments", async (req) => {
    const q = req.query as { page?: string; limit?: string; status?: string }
    const page = Math.max(1, Number(q.page ?? 1))
    const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { payerId: req.jwtPayload.sub, payerRole: "INSTITUTION" }
    if (q.status) where.status = q.status

    const [total, items] = await app.prisma.$transaction([
      app.prisma.payment.count({ where }),
      app.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ])
    return { total, page, limit, items }
  })
}
