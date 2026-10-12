import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5184',
      // фото речей роздає API
      '/uploads': 'http://localhost:5184',
    },
  },
})
