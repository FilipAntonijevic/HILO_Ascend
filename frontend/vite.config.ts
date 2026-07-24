import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://<user>.github.io/HILO_Ascend/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/HILO_Ascend/',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5129',
        changeOrigin: true,
      },
    },
  },
})
