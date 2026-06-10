/**
 * Vitest global test setup.
 * Creates and tears down a test Prisma client connected to the test database.
 */

import { PrismaClient } from "@prisma/client"
import { beforeAll, afterAll } from "vitest"

let prisma: PrismaClient

beforeAll(async () => {
  prisma = new PrismaClient()
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
