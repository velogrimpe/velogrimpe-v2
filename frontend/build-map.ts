/**
 * Build script for map libraries bundle
 * Outputs IIFE format so it can be loaded synchronously by inline scripts
 */
import { build } from 'esbuild'
import { resolve } from 'path'

await build({
  entryPoints: [resolve(import.meta.dir, 'src/apps/map.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  outdir: resolve(import.meta.dir, '../public_html/dist'),
  entryNames: 'map',
  assetNames: 'assets/[name]-[hash]',
  loader: {
    '.png': 'dataurl',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // Ignore sideEffects annotations to ensure all plugins register with Leaflet
  ignoreAnnotations: true,
})

console.log('Map bundle built successfully')
