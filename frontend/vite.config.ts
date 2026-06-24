import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Separamos SOLO React y el router en chunks propios: son eager,
        // compartidos por toda la app y casi nunca cambian, así que el navegador
        // los cachea entre deploys (clave para el tráfico que vuelve por la pauta).
        // El resto lo dividen Rollup/Vite automáticamente — importante: así NO
        // rompemos los imports dinámicos (socket.io-client, leaflet) que quedan
        // en sus chunks async y NO se descargan en la home anónima.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react'
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
