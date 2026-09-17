# CLAUDE.md

## Project Overview

Velogrimpe.fr - Community website for finding climbing crags accessible by bicycle and train in France. PHP 8.3+ + MySQL + Vue 3 (bun, Vite, TS), Tailwind + Daisy UI, maps with leaflet

## Project Structure

```
velo-grimpe-v2/
├── config.php                 # DB credentials, API keys (git-ignored)
├── .htpasswd.dev              # Basic auth /admin en dev (git-ignored)
├── public_html/               # Web root
│   ├── *.php                  # Main pages
│   ├── api/                   # REST endpoints
│   ├── ajout/                 # Contribution forms
│   ├── admin/                 # Admin interface
│   ├── js/                    # Legacy vanilla JS (map components, utils)
│   ├── dist/                  # Built frontend assets
│   └── public -> ../public    # Symlink vers le dossier de données
├── public/                    # Données hors web root (git-ignored)
│   ├── gpx/ barres/ …         # GPX, images falaises, GeoJSON barres, zones…
│   ├── images/                # Uploads admin
│   └── open-data/             # Exports GeoJSON
└── frontend/                  # Vue.js + Vite source
    └── vite.config.ts         # Vite config with 22 entry points
```

## Tech Stack

## Development

```bash
# Docker container: velogrimpe, port 4000. À lancer depuis la racine du repo.
# `public/` est git-ignoré : le créer avant (mkdir -p public/{gpx,barres,images,open-data})
# sinon le bind échoue. Monté en lecture/écriture : c'est le dossier de données
# (uploads images/GPX, GeoJSON générés), cible du symlink public_html/public.
docker run --platform linux/x86_64 --name velogrimpe -p 4001:22 -p 4000:80 -d \
  -v $PWD/public_html:/opt/lampp/htdocs \
  -v $PWD/public:/opt/lampp/public \
  --mount type=bind,source=$PWD/config.php,target=/opt/lampp/config.php,readonly \
  --mount type=bind,source=$PWD/.htpasswd.dev,target=/home/u829510062/domains/velogrimpe.fr/.htpasswd,readonly \
  tomsik68/xampp:8

# Access: http://localhost:4000
# phpMyAdmin: http://localhost:4000/phpmyadmin
```

La base MySQL du conteneur est **éphémère** : elle disparaît à chaque
re-création du conteneur (pas à un simple redémarrage). Les deux commandes
ci-dessous la remontent depuis zéro.

### Créer la base

`db_init.sql` (git-ignoré, il porte le mot de passe local) crée la base
`u829510062_bdd` et l'utilisateur attendu par `config.php`. Idempotent :

```bash
docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot < db_init.sql
```

### Re-seed depuis un export de la prod

`db_backup.sql` (git-ignoré) est un export de la prod — dump TablePlus ou
`mysqldump`. Il ne contient ni `CREATE DATABASE` ni `USE`, d'où le nom de base
passé en argument. Chaque table est précédée d'un `DROP TABLE IF EXISTS` :
rejouer la commande écrase les données locales par celles de l'export.

```bash
docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < db_backup.sql
```

Vérification (compte des falaises + connexion sous l'utilisateur de l'app) :

```bash
docker exec velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd \
  -e "SELECT COUNT(*) AS falaises FROM falaises;"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/carte.php
```

L'export ne couvre que les données SQL. Les fichiers associés (images de
falaises, GPX, GeoJSON de barres) vivent dans `public/` et se récupèrent
séparément.

## Architecture

**Databases:**

- `u829510062_bdd` - Main DB (falaises, velo, gares, villes, train, bus\_\*,
  sorties, pages, newsletters…). Nom et identifiants dans `config.php` ;
  connexion via `public_html/database/velogrimpe.php`.

**Chemins de données (`public_html/lib/paths.php`) :**

Les contenus téléversés et générés vivent **hors du dossier déployé**, dans
`public/` à la racine du dépôt (git-ignoré), atteint par le symlink versionné
`public_html/public -> ../public`. **Aucun chemin ne se construit à la main** :
tout passe par `vg_data_path()` / `vg_data_url()` / `vg_data_exists()` /
`vg_data_prepare()`, en lecture comme en écriture. Les arguments sont des
chemins relatifs à la racine des données (`'gpx/x.gpx'`), pas des chemins disque.

- `vg_data_url()` ne dépend jamais de l'emplacement de stockage : ces URL sont
  stockées en base, publiées et envoyées par mail. Ne jamais dériver une URL par
  `str_replace(DOCUMENT_ROOT, …)` sur un chemin disque — à travers le symlink,
  la cible est hors `DOCUMENT_ROOT`.
- `vg_data_prepare()` s'appelle **avant la première mutation** (avant l'`INSERT`,
  avant `move_uploaded_file`) : c'est le seul point où un échec ne laisse pas de
  ligne sans fichier.
- Chemin disque et URL coïncident : `public/gpx/x.gpx` est servi à
  `/public/gpx/x.gpx`. Deux exceptions qui n'utilisent pas `vg_data_url()` :
  `open-data/` (servi par `download.php`, URL `/open-data/*.geojson`) et
  `images/` (encore dupliqué avec `public_html/images`, URL `/images/…`).
- Les anciennes URL `/bdd/…` sont redirigées en 301 par le `.htaccess` racine.

Détails et règles `.htaccess` : section « Chemins de données » de
`public_html/README.md`.

**Vue-PHP Integration:**

1. PHP renders page with `data-*` attributes for Vue mount points
2. Vue enhances UI with reactive components
3. Vue emits `velogrimpe:*` custom events
4. Legacy JS listens and updates map/UI
5. PHP loads assets via `vite_js()` / `vite_css()` helpers
