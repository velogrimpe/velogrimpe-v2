# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

Velogrimpe.fr - Community website for finding climbing crags accessible by bicycle and train in France. PHP 8.3+ backend with Vue 3 + Vite frontend components.

## Project Structure

```
velo-grimpe/
├── config.php                 # DB credentials, API keys (git-ignored)
├── config.sample.php          # Configuration template
├── public_html/               # Web root
│   ├── *.php                  # Main pages (carte, falaise, tableau, etc.)
│   ├── api/                   # REST endpoints
│   │   ├── public/            # No auth (oblyk-get-id.php)
│   │   └── private/           # Admin auth (batch-geocode.php, etc.)
│   ├── ajout/                 # Contribution forms (9 files)
│   ├── admin/                 # Admin interface (oblyk.php, tableau_trains.php)
│   ├── database/              # DB connections (velogrimpe.php, sncf.php)
│   ├── lib/                   # PHP utilities (vite.php, sendmail.php, geocode_lib.php)
│   ├── components/            # Shared HTML (header.php, footer.php, etc.)
│   ├── js/                    # Legacy vanilla JS (map components, utils)
│   ├── bdd/                   # Data files (images, GPX, GeoJSON)
│   └── dist/                  # Built frontend assets
├── frontend/                  # Vue.js + Vite source
│   ├── src/apps/              # 12 entry points (carte-filters, tableau, etc.)
│   ├── src/components/        # 22 Vue components
│   │   ├── filters/           # 12 filter components
│   │   └── shared/            # 5 shared components
│   ├── src/stores/            # 5 Pinia stores
│   ├── src/types/             # 6 TypeScript definitions
│   ├── build-map.ts           # esbuild script for map bundle (IIFE)
│   └── vite.config.ts         # Vite config with 11 entry points
├── CLAUDE/                    # Extended documentation
└── .githooks/                 # Auto-build on commit
```

## Tech Stack

| Category        | Technology    | Version |
| --------------- | ------------- | ------- |
| Backend         | PHP           | 8.3+    |
| Database        | MySQL/MariaDB | MySQLi  |
| Frontend        | Vue 3         | ^3.4.0  |
| Build           | Vite          | ^5.0.0  |
| Types           | TypeScript    | ^5.3.0  |
| State           | Pinia         | ^2.1.0  |
| CSS             | Tailwind CSS  | ^4.1.18 |
| UI              | DaisyUI       | ^5.5.14 |
| Maps            | Leaflet       | ^1.9.4  |
| Package Manager | Bun           | latest  |

## Development

```bash
# Docker (from parent directory)
docker run --platform linux/x86_64 --name myXampp -p 4001:22 -p 4000:80 -d \
  -v $PWD/velo-grimpe/public_html:/opt/lampp/htdocs \
  --mount type=bind,source=$PWD/velo-grimpe/config.php,target=/opt/lampp/config.php,readonly \
  tomsik68/xampp:8

# Frontend
cd frontend
bun install          # Install dependencies
bun run watch:php    # Dev mode (PHP)
bun run dev          # Vite dev server only (HMR Vue)
bun run build        # Production build to dist/
bun run build:map    # Rebuild map bundle only
bun run typecheck    # TypeScript validation

# Git hooks (auto-build on commit)
git config core.hooksPath .githooks
```

## Architecture

**Databases:**

- `velogrimpe` - Main DB (falaises, velo, gares, villes, train)

**Auth:** Bearer tokens in `config.php`

- `admin_token` - Full admin access
- `contrib_token` - Contributor access
- `oblyk_token` - Oblyk API integration

**Vue-PHP Integration:**

1. PHP renders page with `data-*` attributes for Vue mount points
2. Vue enhances UI with reactive components
3. Vue emits `velogrimpe:*` custom events
4. Legacy JS listens and updates map/UI
5. PHP loads assets via `vite_js()` / `vite_css()` helpers

**Key PHP Pages:**

- `carte.php` - Interactive map with filters
- `falaise.php` - Crag detail page
- `tableau.php` - Table view of routes
- `ajout/ajout_falaise.php` - Add new crag form
- `ajout/ajout_velo.php` - Add bike route form
- `ajout/ajout_train.php` - Add train connection form
- `admin/index.php` - Admin dashboard
- `admin/tableau_trains.php` - Train data management

## Coding Guidelines

- PHP 8.3+ features, MySQLi for database
- Vue Composition API with `<script setup>`
- Prefer comment blocks above functions
- Reuse existing functions from `lib/`

# TODO list

- [x] Ajouter un système de watcher pour build auto à chaque changement du front end
- [ ] Amélioration SEO (meta tags dynamiques)
- [ ] Tests automatisés (PHPUnit, Vitest)

# TODO someday (ne pas commencer)

- [ ] Optimisation bundle map.js (actuellement 479KB)

## Additional Documentation

| File                                                         | Description                                   |
| ------------------------------------------------------------ | --------------------------------------------- |
| [CLAUDE/database-schema.md](CLAUDE/database-schema.md)       | Tables, relationships, common queries         |
| [CLAUDE/vue-components.md](CLAUDE/vue-components.md)         | Adding Vue components and autocomplete fields |
| [CLAUDE/leaflet-plugins.md](CLAUDE/leaflet-plugins.md)       | Adding Leaflet plugins, map bundling          |
| [CLAUDE/architecture-notes.md](CLAUDE/architecture-notes.md) | Notes d'architecture, travaux futurs          |
