/**
 * Build script for map libraries bundle.
 * Outputs IIFE format with versioned filenames so the browser can cache them
 * long-term: when the lib version changes the filename changes, busting cache
 * automatically. PHP reads `dist/map-bundles.json` to resolve the current name.
 */
import { build } from 'esbuild'
import { resolve } from 'path'
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises'

const root = import.meta.dir
const distDir = resolve(root, '../public_html/dist')

async function readVersion(pkg: string): Promise<string> {
  const raw = await readFile(resolve(root, 'node_modules', pkg, 'package.json'), 'utf-8')
  return JSON.parse(raw).version as string
}

/** Delete old versioned outputs for a given bundle so they don't accumulate
 *  across upgrades. `name` is "map" or "map-maplibre"; we delete files like
 *  `<name>-1.2.3.js` / `<name>-1.2.3.css` while leaving the OTHER bundle alone. */
async function cleanOldVersions(name: string) {
  const re = new RegExp(`^${name.replace(/[-]/g, '\\-')}-\\d[\\d.A-Za-z-]*\\.(?:js|css)(?:\\.map)?$`)
  let files: string[]
  try {
    files = await readdir(distDir)
  } catch {
    return
  }
  await Promise.all(
    files
      .filter((f) => re.test(f))
      // Don't delete `map-maplibre-*` when cleaning `map-*`
      .filter((f) => name === 'map-maplibre' || !f.startsWith('map-maplibre-'))
      .map((f) => unlink(resolve(distDir, f)).catch(() => {})),
  )
}

const leafletVer = await readVersion('leaflet')
const maplibreVer = await readVersion('maplibre-gl')

const commonOptions = {
  bundle: true,
  minify: true,
  format: 'iife' as const,
  outdir: distDir,
  assetNames: 'assets/[name]-[hash]',
  loader: { '.png': 'dataurl' as const },
  define: { 'process.env.NODE_ENV': '"production"' },
}

// Leaflet bundle (legacy, used by carte.php and falaise.php)
await cleanOldVersions('map')
await build({
  ...commonOptions,
  entryPoints: [resolve(root, 'src/apps/map.ts')],
  entryNames: `map-${leafletVer}`,
  // Ignore sideEffects annotations to ensure all plugins register with Leaflet
  ignoreAnnotations: true,
})
console.log(`Leaflet map bundle built: map-${leafletVer}.js`)

// MapLibre bundle (used by carte_maplibre.php)
await cleanOldVersions('map-maplibre')
await build({
  ...commonOptions,
  entryPoints: [resolve(root, 'src/apps/map-maplibre.ts')],
  entryNames: `map-maplibre-${maplibreVer}`,
})
console.log(`MapLibre bundle built: map-maplibre-${maplibreVer}.js`)

// Write a manifest PHP can consume (style Vite manifest).
const manifest = {
  map: {
    js: `/dist/map-${leafletVer}.js`,
    css: `/dist/map-${leafletVer}.css`,
    version: leafletVer,
  },
  'map-maplibre': {
    js: `/dist/map-maplibre-${maplibreVer}.js`,
    css: `/dist/map-maplibre-${maplibreVer}.css`,
    version: maplibreVer,
  },
}
await writeFile(resolve(distDir, 'map-bundles.json'), JSON.stringify(manifest, null, 2))
console.log('Manifest written: dist/map-bundles.json')
