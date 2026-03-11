# CLAUDE.md

## Project Overview

Velogrimpe.fr - Community website for finding climbing crags accessible by bicycle and train in France. PHP 8.3+ + MySQL + Vue 3 (bun, Vite, TS), Tailwind + Daisy UI, maps with leaflet

## Project Structure

```
velo-grimpe/
├── config.php                 # DB credentials, API keys (git-ignored)
├── public_html/               # Web root
│   ├── *.php                  # Main pages
│   ├── api/                   # REST endpoints
│   ├── ajout/                 # Contribution forms
│   ├── admin/                 # Admin interface
│   ├── js/                    # Legacy vanilla JS (map components, utils)
│   └── dist/                  # Built frontend assets
└── frontend/                  # Vue.js + Vite source
    └── vite.config.ts         # Vite config with 11 entry points
```

## Tech Stack

## Development

```bash
# Docker container: velogrimpe-v2, port 4002
docker run --platform linux/x86_64 --name velogrimpe-v2 -p 4003:22 -p 4002:80 -d \
  -v $PWD/velo-grimpe/public_html:/opt/lampp/htdocs \
  --mount type=bind,source=$PWD/velo-grimpe/config.php,target=/opt/lampp/config.php,readonly \
  tomsik68/xampp:8

# Access: http://localhost:4002
```

## Architecture

**Databases:**

- `velogrimpe` - Main DB (falaises, velo, gares, villes, train)

**Vue-PHP Integration:**

1. PHP renders page with `data-*` attributes for Vue mount points
2. Vue enhances UI with reactive components
3. Vue emits `velogrimpe:*` custom events
4. Legacy JS listens and updates map/UI
5. PHP loads assets via `vite_js()` / `vite_css()` helpers
