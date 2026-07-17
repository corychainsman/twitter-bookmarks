import { fileURLToPath, URL } from "node:url"

import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "test"
      ? []
      : [
          VitePWA({
            strategies: "injectManifest",
            srcDir: "src/greenfield/service-worker",
            filename: "sw.ts",
            injectRegister: false,
            manifest: false,
            injectManifest: {
              globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
            },
          }),
          cloudflare(),
        ]),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/greenfield/test/setup.ts"],
    include: [
      "src/greenfield/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
      "worker/**/*.test.ts",
    ],
  },
}))
