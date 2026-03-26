import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react({
    babel: {
      plugins: ['@lingui/babel-plugin-lingui-macro'],
    },
  })],
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
