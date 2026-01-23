import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: '/ui/program-catalog/',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true
  }
})
