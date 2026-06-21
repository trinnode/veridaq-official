import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ""),
      "next/navigation": path.resolve(__dirname, "__mocks__/next-navigation.ts"),
      "next/link": path.resolve(__dirname, "__mocks__/next-link.tsx"),
      "next-themes": path.resolve(__dirname, "__mocks__/next-themes.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest-setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
  },
})
