# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

Velogrimpe.fr is a community website for finding climbing crags accessible by bicycle and train in France. PHP/HTML/CSS/JS project with Vue.js + Vite frontend components.

## Project Structure

```
velo-grimpe/
├── config.php              # Database credentials and API keys
├── public_html/            # Main web application
│   ├── *.php               # Main pages (carte, falaise, tableau, etc.)
│   ├── api/                # REST API endpoints (public/ and private/)
│   ├── ajout/              # Contribution forms
│   ├── admin/              # Admin interface
│   ├── database/           # DB connections (velogrimpe.php, sncf.php)
│   ├── lib/                # PHP utilities
│   ├── components/         # Shared HTML components
│   ├── js/                 # JavaScript files
│   └── bdd/                # Data files (images, GPX, GeoJSON)
└── frontend/               # Vue.js + Vite (builds to public_html/dist/)
    ├── src/apps/           # Entry points per PHP page
    ├── src/components/     # Vue components
    ├── src/stores/         # Pinia stores
    └── src/types/          # TypeScript definitions
```

## Development

```bash
# Docker (from parent directory)
docker run --platform linux/x86_64 --name myXampp -p 4001:22 -p 4000:80 -d \
  -v $PWD/velo-grimpe/public_html:/opt/lampp/htdocs \
  --mount type=bind,source=$PWD/velo-grimpe/config.php,target=/opt/lampp/config.php,readonly \
  tomsik68/xampp:8

# Frontend
cd frontend
bun install && bun run dev    # Dev server
bun run build                 # Production build

# Git hooks (auto-build on commit)
git config core.hooksPath .githooks
```

## Architecture

**Databases:** `velogrimpe` (crags, routes, stations), `sncf` (train schedules)

**Frontend Stack:** Vue 3 + Vite, Pinia, Leaflet, Tailwind CSS + DaisyUI, TypeScript

**Auth:** Bearer tokens in `config.php` (admin_token, contrib_token)

**Vue-PHP Integration:**
- PHP renders pages; Vue enhances with reactive components
- Data passed via `data-*` attributes on mount elements
- Vue emits `velogrimpe:*` custom events for Leaflet interop

## Coding Guidelines

- PHP 8.3+, Vue Composition API with `<script setup>`
- Prefer comment blocks above functions over inline comments
- Reuse existing functions from `lib/`

## Additional Documentation

| File | Description |
|------|-------------|
| [CLAUDE/database-schema.md](CLAUDE/database-schema.md) | Database tables, relationships, common queries |
| [CLAUDE/vue-components.md](CLAUDE/vue-components.md) | Adding Vue components and autocomplete fields |
| [CLAUDE/leaflet-plugins.md](CLAUDE/leaflet-plugins.md) | Adding Leaflet plugins, map bundling config |
| [CLAUDE/architecture-notes.md](CLAUDE/architecture-notes.md) | TODOs, migration plans, future work |
