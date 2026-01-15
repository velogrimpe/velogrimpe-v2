# Leaflet Plugins Guide

Map libraries are bundled in `frontend/src/apps/map.ts` and built as IIFE format via `frontend/build-map.ts`. This exposes `L` (Leaflet) and `turf` globally for use by inline PHP scripts.

## Currently Bundled

- `leaflet` - Core mapping library
- `leaflet-fullscreen` - Fullscreen control
- `leaflet.locatecontrol` - Geolocation control
- `leaflet-gpx` - GPX track rendering
- `@geoman-io/leaflet-geoman-free` - Drawing/editing tools
- `@turf/boolean-clockwise`, `@turf/center-of-mass`, `@turf/helpers` - Geospatial calculations (only needed functions)

## Adding a New Plugin

### 1. Install the package

```bash
cd frontend
bun add leaflet-my-plugin
bun add -D @types/leaflet-my-plugin  # if types exist
```

### 2. Update `frontend/src/apps/map.ts`

```typescript
// Import the plugin (check if it auto-registers or needs manual registration)
import "leaflet-my-plugin";
import "leaflet-my-plugin/dist/leaflet-my-plugin.css"; // if CSS exists

// Some ESM plugins don't auto-register. Check the package exports:
// If the plugin exports classes instead of auto-registering, do:
import { MyPlugin, myPlugin } from "leaflet-my-plugin";
L.Control.MyPlugin = MyPlugin;
L.control.myPlugin = myPlugin;
```

### 3. Rebuild

```bash
bun run build:map   # Just the map bundle
# or
bun run build       # Full build (includes map)
```

### 4. Use in PHP

The plugin is now available on the global `L` object in any PHP page that includes:

```html
<script src="/dist/map.js"></script>
<link rel="stylesheet" href="/dist/map.css" />
```

## Checking if a Plugin Auto-Registers

Look at the plugin's source or package.json:

- **Auto-registers**: Import as `import 'leaflet-plugin'` (side effect)
- **Needs manual registration**: Check `sideEffects` in package.json or if ESM exports classes

Example of manual registration (leaflet.locatecontrol):

```typescript
import { LocateControl, locate } from "leaflet.locatecontrol";
L.Control.Locate = LocateControl;
L.control.locate = locate;
```

## Build Configuration

The map bundle uses esbuild (not Vite) to output IIFE format for synchronous loading. See `frontend/build-map.ts` for configuration.

Key settings:
- `format: 'iife'` - Synchronous loading for inline scripts
- `ignoreAnnotations: true` - Ensures plugins with `sideEffects: false` still run

## Bundle Size

Current bundle: ~479KB (minified)
- Turf.js optimized: only import needed functions instead of full library
