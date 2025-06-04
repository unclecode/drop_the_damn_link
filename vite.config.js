import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    minify: 'terser',
    sourcemap: false,
    emptyOutDir: true
  },
  base: '/drop_the_damn_link/',
  server: {
    port: 3000,
    open: true
  }
})