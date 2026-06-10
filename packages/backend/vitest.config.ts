import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

const root = __dirname // packages/backend/

export default defineConfig({
  resolve: {
    alias: {
      // Redirect blockchain service imports to the mock during tests so we
      // never attempt real RPC calls or private-key operations.
      "./blockchain.service.js": resolve(root, "src/test/mocks/blockchain.service.ts"),
      "../services/blockchain.service.js": resolve(
        root,
        "src/test/mocks/blockchain.service.ts"
      ),
    },
  },
  test: {
    // Absolute paths so vitest resolves correctly regardless of cwd
    include: [resolve(root, "src/test/**/*.test.ts")],
    exclude: ["**/node_modules/**"],
    globals: true,
    environment: "node",
    setupFiles: [resolve(root, "src/test/setup.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [resolve(root, "src/**/*.ts")],
      exclude: [resolve(root, "src/test/**"), resolve(root, "prisma/**")],
    },
  },
})
