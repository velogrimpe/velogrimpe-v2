# Architecture Notes

Notes techniques et analyse pour le développement.

> **Note:** Les tâches actives sont dans [tasks.md](tasks.md)

## Completed Work

### Map Libraries Bundling

- Leaflet + plugins bundled locally via esbuild (IIFE format) → `dist/map.js` (479KB)
- Removed all CDN dependencies for maps
- Turf.js: only import needed functions (`@turf/boolean-clockwise`, `@turf/center-of-mass`, `@turf/helpers`)

### Tailwind/DaisyUI Local Build

- Migrated from CDN to local Vite build
- DaisyUI v5 with custom "velogrimpe" theme
- Output: `dist/main.css` (~126KB)

## Future Work

### Inline JS to Modules Migration (not started)

Scope analysis:
- `carte.php`: ~853 lines (most complex, main map page)
- `oblyk.php`: ~323 lines (admin)
- `ajout_falaise.php`: ~287 lines (form + map picker)
- `falaise.php`: ~172 lines (detail page)
- `js/components/map/*.js`: ~1695 lines (15 files, already semi-modular)

Challenges: PHP data injection (`json_encode`), cross-script dependencies, Vue interop via events.

### Vue + Leaflet Migration (deferred)

Considered moving all map logic to Vue but deferred because:
- Significant effort
- Current setup works
- Risk of regression on critical map features

**Recommended approach: incremental migration**

1. New map features → build in Vue
2. When modifying existing pages → migrate that part
3. Keep `velogrimpe:*` events as bridge between Vue and vanilla Leaflet code
4. If migrating, start with `falaise.php` (~170 lines) as test before tackling `carte.php`
