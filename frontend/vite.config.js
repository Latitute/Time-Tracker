import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['toms-mac-mini.taile1277c.ts.net'],
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
