# Changelog

Tous les changements notables de ce projet sont documentés dans ce fichier.

Le format s'appuie sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## 2026-06-17

### Added

- Formulaire d'ajout d'itinéraire vélo (`ajout/ajout_velo.php`) : carte de prévisualisation affichant en temps réel le marqueur de la gare de départ, le marqueur de la falaise d'arrivée et la trace GPX uploadée, pour vérifier leur cohérence avant l'envoi (2026-06-17).
- Export open data `itineraires-velo.geojson` : les tracés complets des itinéraires vélo, reconstruits à partir des fichiers GPX (`bdd/gpx/`) et agrégés en un unique GeoJSON de `LineString`/`MultiLineString`. Chaque tracé porte ses métadonnées (falaise, gare de départ, distance, dénivelés, description, lien GPX). Généré par le cron `export_open_data.php`, accessible via `/open-data/itineraires-velo.geojson` et listé sur la page « À propos » (#opendata).
- Export open data `gares.geojson` : les gares (points, hors gares supprimées) avec commune, département, codes UIC/OSM et flag TGV. Accessible via `/open-data/gares.geojson` et listé sur la page « À propos ».
- Export open data `complet.geojson` : fusion des collections (falaises, itinéraires vélo, gares, détails) en un seul GeoJSON. Chaque entité porte une propriété `vg_type` (`falaise` / `itineraire_velo` / `gare` / `detail`) pour pouvoir les re-filtrer. Accessible via `/open-data/complet.geojson` et listé sur la page « À propos ».

### Changed

- Upload GPX (`api/add_velo.php`) : les fichiers GPX uploadés sont désormais nettoyés de leurs waypoints `<wpt>` (marqueurs de début/fin, points isolés) avant stockage ; la trace (`<trk>`/`<trkseg>`/`<trkpt>`) et les routes (`<rte>`) sont conservées intégralement (2026-06-17).
- `export_open_data.php` : nouveau parseur GPX → géométrie GeoJSON robuste (tracés `<trk>` et routes `<rte>`, namespaces GPX 1/0 et 1/1, élévation incluse uniquement si tous les points en ont une pour éviter de mélanger positions 2D et 3D).
