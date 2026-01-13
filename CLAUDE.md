# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velogrimpe.fr is a community website for finding climbing crags accessible by bicycle and train in France. It's a PHP/HTML/CSS/JS project hosted on Hostinger single web hosting. Frontend components are built with Vue.js + Vite.

## Development Environment

### Local Setup
```bash
# Start the Docker container (from parent directory containing velo-grimpe/)
export ROOTPARENT=/path/to/parent
docker run --platform linux/x86_64 --name myXampp -p 4001:22 -p 4000:80 -d \
  -v $ROOTPARENT/velo-grimpe/public_html:/opt/lampp/htdocs \
  --mount type=bind,source=$ROOTPARENT/velo-grimpe/config.php,target=/opt/lampp/config.php,readonly \
  tomsik68/xampp:8
```

- **Site**: http://localhost:4000
- **phpMyAdmin**: http://localhost:4000/phpmyadmin
- Changes are live-reloaded (manual browser refresh needed)

### Git Setup (after cloning)
```bash
# Enable git hooks (auto-builds frontend on commit)
git config core.hooksPath .githooks

# Create config.php from template
cp config.sample.php config.php
# Edit config.php with your credentials
```

### API Testing
HTTP test files in `tests/` directory can be used with REST Client extensions (VS Code, IntelliJ):
- `tests/tests.http` - Main API endpoint tests
- `tests/geocode.http` - Geocoding tests

## Project Structure

```
velo-grimpe/
├── config.php              # Database credentials and API keys (outside public_html)
├── public_html/            # Main web application (git repo)
│   ├── *.php               # Main pages (carte, falaise, tableau, etc.)
│   ├── api/                # REST API endpoints
│   │   ├── public/         # Public APIs (oblyk integration)
│   │   └── private/        # Admin-only APIs (require admin_token)
│   ├── ajout/              # Contribution forms (add crag, route, station)
│   ├── admin/              # Admin interface
│   ├── database/           # Database connection files
│   │   ├── velogrimpe.php  # Main DB connection ($mysqli)
│   │   └── sncf.php        # Train schedules DB connection
│   ├── lib/                # PHP utilities (mail, logging, geocoding)
│   ├── components/         # Shared HTML components (header, footer)
│   ├── js/                 # JavaScript files
│   └── bdd/                # Data files (images, GPX tracks, GeoJSON)
├── frontend/               # Vue.js + Vite frontend (builds to public_html/dist/)
│   ├── src/apps/           # Entry points per PHP page
│   ├── src/components/     # Vue components
│   ├── src/stores/         # Pinia stores
│   └── src/types/          # TypeScript definitions
├── gares/                  # Bun/TypeScript project for train station data
├── misc/                   # Data processing scripts (Bun/JS, SQL imports)
└── climbing-away/          # Climbing-away.com data processing pipeline
```

## Architecture

### Two Databases
- **velogrimpe**: Main database with tables for `falaises` (crags), `velo` (bike routes), `gares` (train stations), `villes` (cities), `train` (train connections)
- **sncf**: Train schedules and connections data

### Key Data Relationships
- `falaises` → climbing crags with location, difficulty, exposure info
- `velo` → bike routes connecting `gares` to `falaises`
- `train` → train connections from `villes` to `gares`

### Frontend Stack
- **Vue.js 3** + **Vite** for reactive UI components (filters, forms)
- **Pinia** for state management
- **Leaflet** for interactive maps with protomaps-leaflet for train line tiles
- **Tailwind CSS** + **DaisyUI** (loaded via CDN)
- TypeScript for Vue components

### Authentication
- Admin APIs use Bearer token from `config.php['admin_token']`
- Contributor APIs use `config.php['contrib_token']`
- External API integrations: Oblyk (climbing data), Mailgun (email)

## Frontend Development

```bash
cd frontend
bun install        # Install dependencies
bun run dev        # Vite dev server with HMR
bun run build      # Build to public_html/dist/
bun run typecheck  # TypeScript validation
```

### Vue-PHP Integration
- PHP renders pages; Vue enhances with reactive components
- Data passed via `data-*` attributes on mount elements
- Vue emits changes via custom events (`velogrimpe:filters`)
- Existing Leaflet code listens to events and updates map

### Adding New Vue Components
1. Create component in `frontend/src/components/`
2. Add entry point in `frontend/src/apps/` if new page
3. Update `vite.config.ts` rollupOptions.input for new entry points
4. Build and include script in PHP: `<script type="module" src="/dist/[name].js">`

## Coding Guidelines

- Use PHP 8.3+ features
- Prefer comment blocks above functions/sections over inline comments
- Reuse existing functions from `lib/` when appropriate
- Stick to existing project conventions and PHP standards
- Vue components use Composition API with `<script setup>`

## Future Improvements

- **Icons**: Optimize icon storage/loading and improve reuse DX (currently inline SVGs in Vue components; consider a shared icon component or sprite system)
