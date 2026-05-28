/**
 * MapLibre GL JS libraries bundle for inline-script pages (carte_maplibre.php).
 * Mirrors `map.ts` but for MapLibre instead of Leaflet:
 *  - bundles maplibre-gl + CSS
 *  - registers the pmtiles protocol
 *  - registers the gpx protocol (via maplibre-gl-vector-text-protocol)
 *  - exposes `maplibregl` globally so inline PHP scripts can use it
 */

// MapLibre core
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// PMTiles protocol
import { Protocol as PMTilesProtocol } from 'pmtiles'

// GPX/KML/CSV/... protocol
// @ts-ignore - the plugin ships JS only
import { VectorTextProtocol } from 'maplibre-gl-vector-text-protocol'
import type { AddProtocolAction } from 'maplibre-gl'

// Register protocols once at load
const pmtilesProtocol = new PMTilesProtocol()
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile)
// Cast : le plugin v0.0.5 expose encore la vieille signature MapLibre v3
// `(req, callback) => Cancelable | Promise`, alors que MapLibre v5 attend
// `(req, AbortController) => Promise`. À l'exécution les deux fonctionnent
// (MapLibre v5 garde la compat runtime), mais TS refuse — on cast.
maplibregl.addProtocol('gpx', VectorTextProtocol as AddProtocolAction)

// Expose globally for inline scripts
declare global {
  interface Window {
    maplibregl: typeof maplibregl
  }
}
window.maplibregl = maplibregl

export { maplibregl }
