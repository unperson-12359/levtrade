import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('react-dom')) return 'react-vendor'
          if (id.includes('lightweight-charts')) return 'charts-vendor'
          if (id.includes('zustand')) return 'state-vendor'
          return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
