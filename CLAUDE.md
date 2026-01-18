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

**NOTE** : Tâches à réaliser, une par une, avec confirmation utilisateur avant commit :

- [x] Ajouter un système de watcher pour build auto à chaque changement du front end
- [x] sur carte.php, les étiquettes (tooltips) de durée d'itinéraire n'utilisent plus les bons styles (classes tw/daisyui ?)
- [x] idem pour les étiquettes des gares quand on sélectionne une falaise ou une gare et vice versa (étiquettes falaises). Elles sont encore bonnes sur la page falaise.php
- [-] page carte.php, l'autocomplete ne fonctionne pas toujours bien avec les flèches. si j'écris, puis je fais fleche du bas, le 1er est bien sélectionné, mais si je recommence, ça désélectionne, encore fleche bas et re-sélection du 1e résultat. Cela ne se produit pas systématiquement, mais par exemple sur la recherche "limas". Ex dans Image #1, le 2e et 4e résultats ne sont pas sélectionnables avec les fleches.
- [x] Les styles de la navigation ne sont pas conformes avec le site de prod : velogrimpe.fr
- [x] page tableau.php, le bouton réinitialiser ne fonctionne pour aucun filtre à part les voies.
- [x] En mode mobile, sur carte.php, pendant le filtrage, ce serait bien d'afficher le nombre de falaise correspondantes dans l'interface de filtrage.
- [x] Avec la migration à daisyUI v5, est-ce que les variables --p, --s etc. ne sont pas devenues obsolètes ? Si c'est le cas, il faut faire une nouvelle passe sur toutes les utilisations de variables. Je peux te passer l'ancienne référence des variables si besoin.
- [ ] Les classes de la popup de falaise-voisine sont cassées. il faudrait surement repasser sur tous les composants de carte (/js/components/map) pour éviter d'utiliser des classes tailwind/daisyUI, ou trouver un autre système plus fiable pour charger les classes utilisées dans du texte html de ces composants.
- [ ] sur l'index.php, j'aimerais que le dropdown des villes utiliser la version popover-api de daisyUI plutôt que le comportement actuel.
- [x] Il faut reprendre le styling des liens. Il y a une règle CSS trop générale qu'il faut enlever. Que recommandes tu ?
- [ ] dans ajout_falaise.php il y a des règles flex qui ont sauté, par exemple dans Précisions sur les cotations le titre, le champ et la précision sont en flex-row alors qu'ils devraient être en flex-col. Vérifie aussi les autres formulaires d'ajout pour ce problème. De même, j'ai l'impression qu'avant les champs étaient en w-full par défaut et maintenant ils ne le sont plus.
- [x] Dans l'éditeur falaise (flow ajout falaise) les boutons texte geoman (quand on clique sur un des icones d'édition) sont stylisés involontairement, je voudrais qu'ils aient le style par défaut de geoman. Demande moi des capture ou des détails sur les classes qui s'appliquent.
- [ ] Le tableau récapitulatif est tout désorganisé. La grille ne fonctionne plus ? (classes tailwind non buildées ?). Quelle approche utiliser ? composant vue ?
- [ ] Suite à l'ajout d'un itinéraire vélo, rajouter un écran de confirmation comme pour les falaise qui propose différents choix tels que consulter la falaise concernée, ajouter un autre itinéraire vélo pour la même falaise etc.
- [ ] Sur la page actus, au hover sur les cartes d'actu, il y a un underline qui se rajoute, enlève le
- [ ] Dans l'admin Supprime le bouton de création de zone, c'est obsolète.
- [ ] Sur le formulaire d'ajout train, l'api renvoie une erreur : "Il manque une info obligatoire : train_arrivee"
- [ ] sur la page oblyk.php, l'icone link n'est plus centré dans le bouton bleu
- [ ] sur la page oblyk.php, au moment du click sur le bouton de lien, l'api renvoie cette erreur : "Error: TypeError: selected.site_ids?.includes is not a function"
- [ ] sur la page tableau_train.php, il manque une partie des boutons d'action : sur une corresp gare/falaise, il n'y a que le bouton d'ajout, et pas les boutons d'exclusion du couple (juste une fois ou de manière globale)
- [ ] Il faut ajouter du versionning sur les détails falaise : à chaque sauvegarde dans l'interface, créer une sauvegarde de la version précédente dans le dossier barres-historique. en ajoutant la date (ex: 2026-01-01-10H24) de sauvegarde à la fin du nom du fichier avant l'extension.

# TODO someday (ne pas commencer)

- [ ] Amélioration SEO (meta tags dynamiques)
- [ ] Tests automatisés (PHPUnit, Vitest)
- [ ] Optimisation bundle map.js (actuellement 479KB)

## Additional Documentation

| File                                                         | Description                                   |
| ------------------------------------------------------------ | --------------------------------------------- |
| [CLAUDE/database-schema.md](CLAUDE/database-schema.md)       | Tables, relationships, common queries         |
| [CLAUDE/vue-components.md](CLAUDE/vue-components.md)         | Adding Vue components and autocomplete fields |
| [CLAUDE/leaflet-plugins.md](CLAUDE/leaflet-plugins.md)       | Adding Leaflet plugins, map bundling          |
| [CLAUDE/architecture-notes.md](CLAUDE/architecture-notes.md) | Notes d'architecture, travaux futurs          |
