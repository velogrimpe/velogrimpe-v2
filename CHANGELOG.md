# Changelog

Tous les changements notables de ce projet sont documentés dans ce fichier.

Le format s'appuie sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## 2026-06-18

### Added

- Indicateur de direction du soleil sur la carte de la page falaise (`falaise.php`) : une icône soleil + flèche (avec halo blanc) se déplace le long de la bordure de la carte selon la position calculée du soleil (azimut) pour la date et l'heure choisies ; la flèche pointe vers la falaise et la hauteur du soleil dans le ciel est affichée sur l'icône. Panneau de contrôle rétractable en haut à droite (rétracté par défaut) : sélecteur de date + curseur d'heure, frise jour/nuit et heures de lever/coucher. Quand le soleil passe sous l'horizon, l'icône bascule en lune sur fond bleu nuit (à la même position que le soleil). Calcul côté client via `suncalc` (heure locale du navigateur) ; composant Vue `SunIndicator.vue` monté via l'entrée Vite `falaise-sun`.
- Altitude des falaises : à l'ajout/édition d'une falaise (`api/add_falaise.php`), l'altitude du point `lat,lng` est récupérée automatiquement via l'API altimétrie de la Géoplateforme IGN (`data.geopf.fr`, sans clé) et stockée en mètres dans la nouvelle colonne `falaises.falaise_altitude`. L'appel est robuste : tout échec (réseau, timeout, point hors couverture) laisse l'altitude vide sans bloquer l'enregistrement. En édition, l'altitude n'est recalculée que si les coordonnées changent ou si elle est absente. Helper : `lib/altitude_lib.php`.
- Affichage de l'altitude et des coordonnées dans un item « localisation » du bandeau de stats de la page falaise (`falaise.php`).
- Endpoint admin `api/private/backfill_altitudes.php` (token requis) : renseigne `falaise_altitude` pour les falaises qui n'en ont pas encore (paramètre optionnel `limit`), avec un journal (`edit_logs`) par falaise modifiée. Test : `tests/backfill_altitudes.http`.

## 2026-06-17

### Added

- Formulaire d'ajout d'itinéraire vélo (`ajout/ajout_velo.php`) : carte de prévisualisation affichant en temps réel le marqueur de la gare de départ, le marqueur de la falaise d'arrivée et la trace GPX uploadée, pour vérifier leur cohérence avant l'envoi (2026-06-17).
- Export open data `itineraires-velo.geojson` : les tracés complets des itinéraires vélo, reconstruits à partir des fichiers GPX (`bdd/gpx/`) et agrégés en un unique GeoJSON de `LineString`/`MultiLineString`. Chaque tracé porte ses métadonnées (falaise, gare de départ, distance, dénivelés, description, lien GPX). Généré par le cron `export_open_data.php`, accessible via `/open-data/itineraires-velo.geojson` et listé sur la page « À propos » (#opendata).
- Export open data `gares.geojson` : les gares (points, hors gares supprimées) avec commune, département, codes UIC/OSM et flag TGV. Accessible via `/open-data/gares.geojson` et listé sur la page « À propos ».
- Export open data `complet.geojson` : fusion des collections (falaises, itinéraires vélo, gares, détails) en un seul GeoJSON. Chaque entité porte une propriété `vg_type` (`falaise` / `itineraire_velo` / `gare` / `detail`) pour pouvoir les re-filtrer. Accessible via `/open-data/complet.geojson` et listé sur la page « À propos ».

### Changed

- Upload GPX (`api/add_velo.php`) : les fichiers GPX uploadés sont désormais nettoyés de leurs waypoints `<wpt>` (marqueurs de début/fin, points isolés) avant stockage ; la trace (`<trk>`/`<trkseg>`/`<trkpt>`) et les routes (`<rte>`) sont conservées intégralement (2026-06-17).
- `export_open_data.php` : nouveau parseur GPX → géométrie GeoJSON robuste (tracés `<trk>` et routes `<rte>`, namespaces GPX 1/0 et 1/1, élévation incluse uniquement si tous les points en ont une pour éviter de mélanger positions 2D et 3D).
