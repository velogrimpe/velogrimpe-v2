/**
 * Map libraries bundle
 * This module bundles Leaflet and all map plugins for use across the site.
 * Import CSS and expose libraries globally for use by inline PHP scripts.
 */

// Leaflet core
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Leaflet Fullscreen plugin
import 'leaflet-fullscreen'
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css'

// Leaflet Locate Control
// @ts-ignore - ESM exports not in types
import { LocateControl, locate } from 'leaflet.locatecontrol'
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css'

// Register locate control with Leaflet (types extended below)
// @ts-ignore - extending L.Control
L.Control.Locate = LocateControl
// @ts-ignore - extending L.control
L.control.locate = locate

// Leaflet GPX
import 'leaflet-gpx'

// Leaflet Geoman (for polygon/polyline editing)
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

// Turf.js - only import used functions (saves ~500KB)
import booleanClockwise from '@turf/boolean-clockwise'
import centerOfMass from '@turf/center-of-mass'
import { lineString } from '@turf/helpers'

// Create minimal turf object with only the functions we use
const turf = { booleanClockwise, centerOfMass, lineString }

// Fix Leaflet default marker icon paths (broken by bundlers)
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix default icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
})

// Expose globally for use by inline PHP scripts
declare global {
  interface Window {
    L: typeof L
    turf: {
      booleanClockwise: typeof booleanClockwise
      centerOfMass: typeof centerOfMass
      lineString: typeof lineString
    }
  }
}

window.L = L
window.turf = turf

export { L, turf }
