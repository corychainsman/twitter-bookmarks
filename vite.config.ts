import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/twitter-bookmarks/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom')) {
            return 'react-vendor'
          }

          if (id.includes('/node_modules/@tanstack/react-router')) {
            return 'router-vendor'
          }

          if (
            id.includes('/node_modules/@huggingface/transformers') ||
            id.includes('/node_modules/onnxruntime')
          ) {
            return 'embedding-vendor'
          }

          if (
            id.includes('/node_modules/yet-another-react-lightbox') ||
            id.includes('/node_modules/@virtuoso.dev')
          ) {
            return 'media-vendor'
          }
        },
      },
    },
  },
  worker: {
    format: 'es',
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
