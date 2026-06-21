/**
 * Vitest global test setup.
 * Loads env vars from workspace root, then connects Prisma to the test database.
 */

import { config } from "dotenv"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"
import { beforeAll, afterAll } from "vitest"

config({ path: resolve(__dirname, "../../../../.env") })

let prisma: PrismaClient

beforeAll(async () => {
  prisma = new PrismaClient()
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
