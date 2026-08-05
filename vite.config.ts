import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ckan': {
        target: 'https://api.neso.energy',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ckan/, ''),
      },
    },
  },
})
