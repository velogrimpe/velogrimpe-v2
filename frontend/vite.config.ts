import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],

  build: {
    outDir: '../public_html/dist',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        'carte-filters': resolve(__dirname, 'src/apps/carte-filters.ts'),
        'tableau': resolve(__dirname, 'src/apps/tableau.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
      external: [
        /^\/images\//,
        /^\/symbols\//,
      ],
    },

    manifest: true,
  },

  server: {
    port: 5173,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
