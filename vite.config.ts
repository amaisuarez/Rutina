/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages serves project sites from /<repo>/. In CI the repository name is
// read from GITHUB_REPOSITORY; VITE_BASE overrides it (e.g. "/" for a custom domain).
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.VITE_BASE ?? (repo ? `/${repo}/` : '/')

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts'
          if (id.includes('node_modules/react') || id.includes('react-router') || id.includes('scheduler')) return 'react'
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
