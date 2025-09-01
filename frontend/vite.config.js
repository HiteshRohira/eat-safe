import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Match jsconfig.json paths: "@/*": ["./*"]
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
