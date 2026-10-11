import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app always runs on port 5173 because GitHub sign-in redirects back to
// exactly http://localhost:5173. strictPort makes Vite fail instead of
// silently picking another port.
const PORT = 5173

export default defineConfig({
  plugins: [react()],
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true, open: true },
  // three.js makes the bundle ~1.2 MB. That's fine for an app that runs from
  // your own computer, so don't warn about it.
  build: { chunkSizeWarningLimit: 2000 },
})
