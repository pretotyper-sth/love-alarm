import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ublDev from './ublDev.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    ublDev(),
    react({
      jsxImportSource: '@emotion/react',
    }),
  ],
  // root는 현재 디렉토리(frontend)가 기본값이므로 명시하지 않음
  publicDir: 'public',
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
  },
})
