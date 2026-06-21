/**
 * Basic auth service tests.
 * Uses the seeded credentials from prisma/seed.ts.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { PrismaClient } from "@prisma/client"
import { AuthService } from "../services/auth.service.js"

let authSvc: AuthService

beforeAll(() => {
  const prisma = new PrismaClient()
  authSvc = new AuthService(prisma)
})

describe("AuthService.loginAdmin", () => {
  it("returns tokens for valid admin credentials", async () => {
    const result = await authSvc.loginAdmin("admin@veridaq.xyz", "Admin2026!@#")
    expect(result).not.toBeNull()
    expect(result?.accessToken).toBeTruthy()
    expect(result?.user.role).toBe("ADMIN")
  })

  it("returns null for wrong password", async () => {
    const result = await authSvc.loginAdmin("admin@veridaq.xyz", "wrongpassword")
    expect(result).toBeNull()
  })
})
