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
# Docker container: velogrimpe-2, port 4002
docker run --platform linux/x86_64 --name velogrimpe-2 -p 4003:22 -p 4002:80 -d \
  -v $PWD/velo-grimpe/public_html:/opt/lampp/htdocs \
  --mount type=bind,source=$PWD/velo-grimpe/config.php,target=/opt/lampp/config.php,readonly \
  tomsik68/xampp:8

# Access: http://localhost:4002

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

**NOTE** : Tâches à réaliser, une par une, avec confirmation utilisateur avant commit :

(liste vide)

# TODO someday (ne pas commencer)

- [ ] Amélioration SEO (meta tags dynamiques)
- [ ] Optimisation bundle map.js (actuellement 479KB)

## Tests E2E

Tests Playwright configurés dans `tests/e2e/`. Serveur requis sur `localhost:4002`.

```bash
bun run test          # Lancer tous les tests
bun run test:ui       # Interface visuelle
bun run test:headed   # Voir le navigateur
```

## Database schema

Main table only, the rest is described in [CLAUDE/database-schema.md](CLAUDE/database-schema.md)

```sql
CREATE TABLE falaises (
  falaise_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  falaise_nom text NOT NULL,
  falaise_nomformate text NOT NULL,           -- URL-safe name
  falaise_latlng text NOT NULL,               -- "lat,lng" format
  falaise_zone smallint(6) DEFAULT -1,        -- Geographic zone ID
  falaise_cotmin text,                        -- Min grade (6a, 6b+, etc.)
  falaise_cotmax text,                        -- Max grade
  falaise_exposhort1 text,                    -- Primary exposure (S, SE, etc.)
  falaise_exposhort2 text,                    -- Secondary exposure
  falaise_nbvoies smallint(6),                -- Number of routes
  falaise_maa int(11),                        -- Approach time (minutes)
  falaise_mar int(11),                        -- Return time (minutes)
  falaise_bloc smallint(6),                   -- 0=no, 1=bouldering, 2=psicobloc
  falaise_fermee text DEFAULT '',             -- Closed reason (if any)
  falaise_public int(11),                     -- 1=validated, 2=pending, 3=unofficial
  falaise_contrib varchar(256),               -- Contributor name/email
  falaise_zonename varchar(255),
  falaise_deptcode varchar(10),               -- Department code
  falaise_deptname varchar(255),              -- Department name
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp
);

CREATE TABLE gares (
  gare_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  gare_nom text NOT NULL,
  gare_nomformate text NOT NULL,              -- URL-safe name
  gare_latlng text NOT NULL,                  -- "lat,lng" format
  gare_departement text,
  gare_commune text,
  gare_codeuic varchar(64) UNIQUE,            -- SNCF unique code
  gare_codeosm varchar(64) UNIQUE,            -- OSM ID (fallback)
  gare_tgv tinyint(4) NOT NULL,               -- 1 if TGV station
  deleted tinyint(4) DEFAULT 0
);

CREATE TABLE villes (
  ville_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  ville_nom text NOT NULL UNIQUE,
  ville_tableau int(11) DEFAULT 0             -- 1 if shown in main table
);

CREATE TABLE train (
  train_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  ville_id smallint(6) NOT NULL,              -- FK to villes
  gare_id smallint(6) NOT NULL,               -- FK to gares
  train_depart text NOT NULL,                 -- Departure station name
  train_arrivee text NOT NULL,                -- Arrival station name
  train_temps int(255),                       -- Min travel time (minutes)
  train_tempsmax smallint(6),                 -- Max travel time
  train_correspmin smallint(6),               -- Min transfers
  train_correspmax smallint(6),               -- Max transfers
  train_nbparjour smallint(6),                -- Trains per day
  train_descr text NOT NULL,                  -- Description
  train_tgv tinyint(1) DEFAULT 0,             -- 1 if TGV route
  train_public int(11) NOT NULL,              -- Validation status
  train_contrib varchar(256),
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp
);

CREATE TABLE velo (
  velo_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  gare_id smallint(6) NOT NULL,               -- FK to gares
  falaise_id smallint(6) NOT NULL,            -- FK to falaises
  velo_depart text NOT NULL,                  -- Station name
  velo_arrivee text NOT NULL,                 -- Crag name
  velo_km float,                              -- Distance (km)
  velo_dplus int(11),                         -- Elevation gain (m)
  velo_dmoins int(11),                        -- Elevation loss (m)
  velo_descr text NOT NULL,                   -- Route description
  velo_openrunner text,                       -- OpenRunner URL
  velo_variante text NOT NULL,                -- Variant name
  velo_apieduniquement smallint(6) DEFAULT 0, -- 1 if walking only
  velo_apiedpossible int(11),                 -- 1 if walking possible
  velo_public int(11) NOT NULL,               -- Validation status
  velo_contrib varchar(256),
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp
```
