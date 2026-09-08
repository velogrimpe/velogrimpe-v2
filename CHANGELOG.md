# Changelog

Tous les changements notables de ce projet sont documentés dans ce fichier.

Le format s'appuie sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## 2026-09-08

### Added

- Commandes de mise en place de la base de dev, documentées dans `CLAUDE.md` et le `README.md` : création de la base et de son utilisateur (`db_init.sql`), puis re-seed depuis un export de la prod (`db_backup.sql`) et vérification. La base du conteneur étant éphémère, ces deux commandes la remontent de zéro.

### Changed

- `db_init.sql` ne crée plus que la base principale et son utilisateur. La base `sncf` et l'utilisateur `u829510062_sncf` en ont été retirés : aucun code PHP ne les référence plus (cf. D011).
- Commande `docker run` documentée (`CLAUDE.md`, `README.md`) mise à jour pour la v2 : sources des binds relatives à la racine du repo (le préfixe `velo-grimpe/` n'existe plus), ajout du montage du dossier de données `public/` — **en lecture/écriture**, puisqu'il reçoit les images de falaises et GPX téléversés — et du montage du `.htpasswd.dev`, qui remplace le `docker cp` manuel.
- `README.md` : `config.php` d'exemple aligné sur `config.sample.php` (clés `sncf_db_*` retirées, `base_url` ajoutée), et création du dossier `public/` ajoutée aux pré-requis.

### Fixed

- Commande `docker run` du `README.md` : le nom de l'image (`tomsik68/xampp:8`) manquait en fin de commande, qui était donc incopiable telle quelle.
- Sélecteur admin d'arrêt existant sur `/ajout/ajout_bus.php` : le lien de navigation utilisait une variable `$token` inexistante, donc le rechargement perdait le mode admin. Il pointe désormais vers `$config['admin_token']`, reflète l'arrêt courant (`selected`) et affiche le nombre d'arrêts en base.

## 2026-08-30

### Fixed

- Erreur en production à la lecture des fichiers PMTiles (`bdd/trains/*.pmtiles`) : « Server returned no content-length header… Check that your storage backend supports HTTP Byte Serving ». Sans MIME connu, Apache servait les `.pmtiles` en `text/plain`, la compression gzip (règle DEFLATE + CDN Hostinger) s'appliquait et supprimait le `Content-Length` tout en ignorant les requêtes `Range`. Le `.htaccess` force désormais `application/octet-stream` et désactive la compression (`no-gzip`) pour `*.pmtiles`, avec un cache d'un jour.

## 2026-08-28

### Added

- Utilitaire toast vanilla `public_html/js/components/utils/toast.js` (`showToast(message, type, duration)`, classes Daisy UI identiques au `ToastContainer.vue`) pour les pages non montées en Vue.

### Changed

- Import Overpass des arrêts de bus (éditeur de falaise et `ajout/ajout_bus.php`) : en cas d'échec, une notification toast d'erreur remplace l'`alert()`. `overpassFetch()` lève désormais une `OverpassError` portant le statut HTTP ; `overpassErrorMessage()` donne un message dédié pour le 429 (« Service Overpass surchargé, ré-essayez dans 1 minute. ») et le 504 (timeout).
- Éditeur de falaise et `ajout/ajout_bus.php` : le bouton d'import Overpass est désactivé et affiche un spinner pendant l'appel Overpass (évite les doubles requêtes).

## 2026-08-26

### Added

- Dev local : procédure d'accès à `/admin/` sans toucher au `.htaccess` (fichier `.htpasswd.dev` versionné, monté ou copié au chemin absolu attendu dans le conteneur), documentée dans `public_html/README.md`.
- **Page d'édition d'un itinéraire vélo** (`ajout/edit_velo.php`) : sélection en cascade Falaise (autocomplete) → Gare de départ (select) → Variante (select), chaque sélecteur ne se dégrisant qu'une fois le précédent renseigné, avec options déduites des itinéraires réellement en base (gares desservant la falaise, variantes du couple gare + falaise) et sélection automatique quand une seule option existe. Presets par l'URL (`?falaise_id=&gare_id=&velo_id=`) vérifiés contre la base — un preset incohérent est ignoré au niveau où il devient faux — et URL synchronisée avec la sélection courante. Une fois la variante choisie : champs longueur / D+ / D- pré-remplis, bouton de téléchargement du GPX existant, upload optionnel d'une nouvelle trace, et carte de vérification (gare, falaise, trace existante en bleu pointillé, nouvelle trace en vert).
- `api/edit_velo.php` (POST multipart) : met à jour `velo_km`, `velo_dplus`, `velo_dmoins` et `date_modification`, remplace le fichier GPX si fourni (mêmes contrôles qu'à l'ajout : plafond 10 Mo, `LIBXML_NONET`, racine `<gpx>`, retrait des `<wpt>`, validation des slugs du nom de fichier — validé **avant** l'UPDATE, un GPX invalide ne modifie rien), journalise en `edit_logs` (type `update`, anciennes/nouvelles valeurs), notifie par mail hors admin et redirige vers `confirmation_velo.php?type=update`. Formulaire de contribution public, comme l'ajout (D005). Les champs qui composent le nom du fichier GPX ne sont pas éditables (D008).
- `api/fetch_velos.php?falaise_id=` (GET, JSON) : itinéraires d'une falaise avec leur gare et l'URL du GPX s'il existe sur le disque.
- **Workflow de validation des itinéraires vélo** (D010) : `api/edit_velo.php` distingue trois cas. Admin (token dans l'URL depuis le panneau d'admin) : tout est appliqué (km, D+, D-, description, lien Openrunner, GPX) et l'itinéraire passe en `velo_public = 1` ; le mail de notification part vers `admin_mail` (vers `contact_mail` hors admin, comme pour les falaises et les bus — `add_velo.php` aligné sur ce schéma, il n'envoyait rien en mode admin). Contributeur sur un itinéraire non validé : modifications appliquées, mail aux admins avec **lien de validation** et lien d'édition admin. Contributeur sur un itinéraire **validé** : rien n'est écrit — la description proposée et le GPX (ré-sérialisé depuis le DOM nettoyé, jamais le fichier reçu) sont envoyés aux admins en pièce jointe, une ligne `edit_logs` de type `suggestion` est tracée, les champs km / D+ / D- sont désactivés côté formulaire et ignorés côté API, et la page de confirmation (`type=suggestion`) explique que la modification n'est pas immédiate.
- `api/private/accept_velo.php?admin=&velo_id=` : validation d'un itinéraire (`velo_public = 1`), même principe qu'`accept_falaise.php`, 401 / 403 / 404 (D006). Le mail d'ajout (`add_velo.php`) porte désormais aussi ce lien.
- Page d'édition : champ **description** (tout le monde), champ **Openrunner** (admin uniquement, ignoré côté API sinon), section admin « ⚠️ Itinéraires à valider » en haut de page (select des `velo_public = 2`, ouvre l'itinéraire pré-sélectionné), mention « — à valider » dans la liste des variantes.
- Archivage de l'ancienne trace dans `bdd/gpx-historique/` (`velo_archiver_gpx()`) avant tout remplacement de GPX, comme `bdd/barres-historique/` pour les GeoJSON.
- Panneau d'admin : bouton « 🚲 Itinéraire vélo à vérifier / modifier » (avec le nombre en attente) vers `edit_velo.php?admin=`.
- `confirmation_velo.php` : messages pour `type=update` et `type=suggestion`, bouton « Modifier à nouveau cet itinéraire ».
- Tests : `tests/edit_velo.http` (trois modes), `tests/accept_velo.http`, `tests/fetch_velos.http`. Icône `download` ajoutée au sprite.
- Mails en dev : `sendMail()` préfixe le sujet par `[DEV]` quand `base_url` pointe sur `localhost` (même convention de détection que `newsletter_renderer.php` et `fetch_mail_template.php`), pour distinguer les envois de test en boîte de réception.

### Fixed

- Page d'édition : la carte était créée dans une section masquée, d'où des tuiles partiellement chargées et une trace GPX mal cadrée à l'affichage (Leaflet mesurait un conteneur de taille nulle). `velo-form-map.js` observe désormais la taille du conteneur (`ResizeObserver`) et appelle `invalidateSize()` + recadrage dès qu'il devient visible.

### Security

- `.htaccess` : `X-Content-Type-Options: nosniff` ajouté sur les `.gpx` (en plus du `Content-Disposition: attachment` déjà en place). Les GPX étant des XML fournis par les contributeurs et servis sur l'origine du site, cela empêche un navigateur de les rendre comme document (XSS stocké via `xml-stylesheet` / XHTML embarqué). Sans effet sur les `fetch()` de la carte.

### Changed

- **Factorisation ajout / édition** (D009) : `lib/velo_lib.php` porte la lecture des indicateurs, la vérification des champs obligatoires, la validation des slugs, le chargement / nettoyage du GPX téléversé et la construction du chemin GPX ; `api/add_velo.php` l'utilise (comportement inchangé). La carte de vérification inline de `ajout_velo.php` devient le module partagé `js/components/map/velo-form-map.js` (événements `velogrimpe:velo-form:gare|falaise|gpx-url`, anciennement `velogrimpe:ajout-velo:*`), et les types/helpers des deux apps Vue sont regroupés dans `frontend/src/utils/velo-form.ts`.

## 2026-08-25

### Fixed

- **Carte MapLibre** (`carte_maplibre.php`) : les popups des falaises hors topo ne se fermaient pas automatiquement. MapLibre n'a pas d'équivalent à l'`autoClose` de Leaflet, et le `closeOnClick` interne (branché sur l'event `click` de la carte) était court-circuité par le `stopPropagation()` des handlers de clic sur les markers — les popups s'empilaient donc à chaque clic. Ajout d'un `openPopup()`/`closePopup()` centralisé qui ne garde qu'un popup ouvert à la fois (falaises hors topo, gares hors topo PMTiles, résultats de recherche), avec toggle sur re-clic du même marker comme `bindPopup`, et fermeture depuis `teardown()`.
- **Carte MapLibre** : style des popups aligné sur celui de Leaflet (`carte.php`) — coins arrondis à 12px sur les quatre angles, padding `13px 24px 13px 20px`, ombre portée, bouton de fermeture en 24×24, `maxWidth` à 300px. `focusAfterOpen` désactivé sur les popups hors topo : MapLibre focusait le bouton « Renseigner la falaise » et faisait apparaître un focus ring daisyUI absent de la version Leaflet.

## 2026-07-29

### Security

- **Correction de la faille ayant permis la compromission du serveur** (webshell déposé dans `bdd/images_falaises/` puis remplacement de trois pages par du spam SEO — rapport complet : `docs/incident-2026-07-29-compromission.md`). `uploadImage()` dans `api/add_falaise.php` construisait le nom du fichier de destination avec l'extension lue dans le nom envoyé par le client, sur un endpoint POST non authentifié écrivant dans un dossier servi par le serveur web : un fichier nommé `shell.php` était déposé tel quel, puis exécuté par simple appel HTTP.
  - L'extension est désormais **déduite du type réel de l'image** via `getimagesize()` (JPEG, PNG ou WebP uniquement) ; le nom envoyé par le client n'intervient plus. Ajout d'un contrôle `is_uploaded_file()` et d'un plafond de 10 Mo.
  - `falaise_nomformate`, qui compose l'autre moitié du nom de fichier, est validé contre `^[a-z0-9-]{1,255}$` — la forme produite par `formatNomFalaise()` côté formulaire. C'est une validation et non un reformatage, car `falaise.php` reconstruit le chemin des images depuis la valeur stockée en base : les deux doivent rester identiques. Sans effet sur les données existantes (les 278 valeurs en base respectent déjà ce motif).
- Nouveau `public_html/bdd/.htaccess` : refus de servir toute extension exécutable dans les dossiers de données (`images_falaises/`, `gpx/`, `barres/`…), `php_flag engine off` en renfort (encadré par `<IfModule>` pour ne pas provoquer d'erreur 500 en PHP-FPM), et `Options -Indexes`. Seconde barrière indépendante de la validation d'upload.
- **Durcissement du formulaire d'ajout d'itinéraire vélo** (`api/add_velo.php`), qui présentait le même défaut de conception : le nom du fichier GPX écrit sur disque était composé de `velo_depart`, `velo_arrivee` et `velo_varianteformate`, des `$_POST` bruts sans même un `trim()`, permettant une traversée de répertoire. L'extension `.gpx` étant codée en dur, il n'y avait pas d'exécution de code possible, mais l'écrasement de traces existantes l'était.
  - Les trois champs sont validés contre `^[a-z0-9-]{0,255}$`. Sans effet sur les données existantes (les 337 itinéraires en base et les 464 fichiers GPX respectent déjà ce motif). L'authentification n'a **pas** été ajoutée : c'est un formulaire de contribution public.
  - Plafond de 10 Mo sur le fichier téléversé (plus grosse trace actuelle : 553 Ko), `loadXML()` avec `LIBXML_NONET` et contrôle de sa valeur de retour — un XML malformé produisait un warning PHP au lieu d'un message clair. Garde sur `insert_id` avant écriture du fichier.
- `api/private/falaises.php` exige désormais `Authorization: Bearer <admin_token>` : **401** sans en-tête (avec `WWW-Authenticate`), **403** sur token invalide, comparaison par `hash_equals()`. L'endpoint répondait jusqu'ici 200 à toute requête anonyme, alors que son commentaire d'en-tête annonçait un contrôle du token. Le préflight `OPTIONS` reste ouvert pour ne pas casser le CORS.
- Cas de régression ajoutés dans `tests/add_falaise.http` et `tests/add_velo.http` : dépôt d'un `.php` déguisé en image, slugs avec traversée de répertoire ou accents, XML malformé, et vérifications d'après-déploiement (shell non exécutable, images et GPX toujours servis). L'ensemble a été vérifié de bout en bout dans le conteneur de développement, contribution légitime incluse.

- Les fichiers de test `.http` ne contiennent plus de valeurs de tokens : elles sont référencées via un fichier d'environnement non versionné.

## 2026-07-13

### Added

- Mise à niveau de la carte MapLibre (`carte_maplibre.php`) sur les évolutions déjà en place sur la carte Leaflet (`carte.php`), en vue de son passage en production :
  - **Filtre par altitude** (#114) : lecture des bornes `filters.altitude.min/max` émises par le composant Vue partagé, helper `altitudeMatches()` (altitude inconnue exclue dès qu'une borne est définie) et prise en compte dans `applyVueFilters`. Le champ `falaise_altitude` est désormais sélectionné en base et sérialisé vers le JS ; le tri et l'affichage de l'altitude (bundles Vue partagés) fonctionnent donc à l'identique.
  - **Données structurées JSON-LD** (`vg_jsonld` via `lib/schema.php`) et **lien RSS** vers `/feed/nouveautes.xml`, alignés sur `carte.php`. Les URL du JSON-LD (WebPage + fil d'Ariane) pointent vers `/carte_maplibre.php` (URL actuelle de la page).

### Fixed

- Carte MapLibre : gares manquantes — la requête ne restreignait plus l'affichage aux gares reliées à un itinéraire vélo public (`WHERE g.deleted = 0` seul), comme sur la carte Leaflet. Les deux cartes affichent désormais le même jeu de gares.
- Carte MapLibre : le filtre par cotation exclut désormais les falaises sans cotation min/max renseignée (garde `!!falaise_cotmin && !!falaise_cotmax`), évitant de les inclure à tort quand un filtre de cotation est actif.

## 2026-07-10

### Added

- Redimensionnement des images dans l'éditeur de texte riche des newsletters et des pages (`SectionTextEditor`) : poignées de glissement aux quatre coins de l'image sélectionnée (ou au survol) pour ajuster sa taille, avec ratio verrouillé. Seule la largeur est persistée, en attribut HTML `width` (pixels) ; la hauteur reste automatique, garantissant un affichage responsive. La largeur choisie est respectée sur les pages publiques et dans les emails (`newsletter_renderer.php` conserve l'attribut `width` et force `height="auto"`). S'appuie sur le node view de resize intégré à TipTap v3 (extension `ResizableImage`, `frontend/src/components/newsletter/resizable-image.ts`).
- Alignement dans l'éditeur de texte riche (`SectionTextEditor`), via un nouveau groupe de boutons dans la barre d'outils :
  - **Texte** (paragraphes et titres) : gauche, centré, droite, justifié — sérialisé en `style="text-align: …"` (respecté par le CSS `prose` des pages publiques et par les clients mail ; les titres conservent leur couleur dans l'email). Extension `TextAlign` maison (`frontend/src/components/newsletter/text-align.ts`).
  - **Images** : gauche, centré, droite (le bouton « justifié » est désactivé quand une image est sélectionnée). L'alignement est stocké en attribut `data-align` (robuste au nettoyage des styles côté email) + `style` margin pour les pages publiques ; dans l'éditeur il pilote le `justify-content` du node view de resize. Le renderer email centre/aligne à droite via une table, aligne à gauche en image inline (défaut historique : centré).

### Fixed

- `vite_css()` (`lib/vite.php`) : le CSS des composants importés statiquement par une entrée (ex. les styles de `SectionTextEditor`, éclatés dans un chunk séparé par Vite) n'était jamais chargé en production, faute de remonter la chaîne d'imports du manifest. La résolution récurse désormais dans les `imports` (hors `dynamicImports`, injectés au runtime par Vite), avec dédoublonnage. Corrige au passage l'absence des styles de l'éditeur sur les pages admin (couleurs des titres, arrondi et contour des images, poignées de redimensionnement).

## 2026-06-19

### Added

- Éditeur de texte riche des newsletters et des pages (`SectionTextEditor`) : nouveau format de bloc « Légende d'image » (bouton dédié dans la barre d'outils, à côté de P/H2/H3). Le texte est centré, en italique, légèrement grisé et collé sans marge ni padding en haut à l'élément précédent (typiquement une image). Rendu cohérent en preview, sur les pages publiques (`.prose .vg-caption`) et dans les emails (conversion en styles inline via `newsletter_renderer.php`). Extension TipTap `caption` produisant `<p class="vg-caption">`.

## 2026-06-18

### Added

- Indicateur de direction du soleil sur la carte de la page falaise (`falaise.php`) : une icône soleil + flèche (avec halo blanc) se déplace le long de la bordure de la carte selon la position calculée du soleil (azimut) pour la date et l'heure choisies ; la flèche pointe vers la falaise et la hauteur du soleil dans le ciel est affichée sur l'icône. Panneau de contrôle rétractable en haut à droite (rétracté par défaut) : sélecteur de date + curseur d'heure, frise jour/nuit et heures de lever/coucher. Quand le soleil passe sous l'horizon, l'icône bascule en lune sur fond bleu nuit (à la même position que le soleil). Calcul côté client via `suncalc` (heure locale du navigateur) ; composant Vue `SunIndicator.vue` monté via l'entrée Vite `falaise-sun`.
- Altitude des falaises : à l'ajout/édition d'une falaise (`api/add_falaise.php`), l'altitude du point `lat,lng` est récupérée automatiquement via l'API altimétrie de la Géoplateforme IGN (`data.geopf.fr`, sans clé) et stockée en mètres dans la nouvelle colonne `falaises.falaise_altitude`. L'appel est robuste : tout échec (réseau, timeout, point hors couverture) laisse l'altitude vide sans bloquer l'enregistrement. En édition, l'altitude n'est recalculée que si les coordonnées changent ou si elle est absente. Helper : `lib/altitude_lib.php`.
- Affichage de l'altitude et des coordonnées dans un item « localisation » du bandeau de stats de la page falaise (`falaise.php`).
- Endpoint admin `api/private/backfill_altitudes.php` (token requis) : renseigne `falaise_altitude` pour les falaises qui n'en ont pas encore (paramètre optionnel `limit`), avec un journal (`edit_logs`) par falaise modifiée. Test : `tests/backfill_altitudes.http`.
- Filtre par altitude (intervalle libre min/max en mètres) sur la page carte (`carte.php`) et la page tableau (`tableau.php`). Le filtre Exposition et le filtre Altitude sont regroupés dans un même menu « Expo 🔅 / Alti 🏔️ » à deux sous-rubriques. Les falaises sans altitude connue sont exclues dès qu'une borne est définie. État synchronisé dans l'URL (`altmin`, `altmax`). Store partagé `stores/filters.ts` (helper `matchesAltitude`).
- Page tableau : affichage de l'altitude (icône + valeur en m) sous la zone/département de chaque falaise, et tri par altitude dans le menu « Tri ».

## 2026-06-17

### Added

- Formulaire d'ajout d'itinéraire vélo (`ajout/ajout_velo.php`) : carte de prévisualisation affichant en temps réel le marqueur de la gare de départ, le marqueur de la falaise d'arrivée et la trace GPX uploadée, pour vérifier leur cohérence avant l'envoi (2026-06-17).
- Export open data `itineraires-velo.geojson` : les tracés complets des itinéraires vélo, reconstruits à partir des fichiers GPX (`bdd/gpx/`) et agrégés en un unique GeoJSON de `LineString`/`MultiLineString`. Chaque tracé porte ses métadonnées (falaise, gare de départ, distance, dénivelés, description, lien GPX). Généré par le cron `export_open_data.php`, accessible via `/open-data/itineraires-velo.geojson` et listé sur la page « À propos » (#opendata).
- Export open data `gares.geojson` : les gares (points, hors gares supprimées) avec commune, département, codes UIC/OSM et flag TGV. Accessible via `/open-data/gares.geojson` et listé sur la page « À propos ».
- Export open data `complet.geojson` : fusion des collections (falaises, itinéraires vélo, gares, détails) en un seul GeoJSON. Chaque entité porte une propriété `vg_type` (`falaise` / `itineraire_velo` / `gare` / `detail`) pour pouvoir les re-filtrer. Accessible via `/open-data/complet.geojson` et listé sur la page « À propos ».

### Changed

- Upload GPX (`api/add_velo.php`) : les fichiers GPX uploadés sont désormais nettoyés de leurs waypoints `<wpt>` (marqueurs de début/fin, points isolés) avant stockage ; la trace (`<trk>`/`<trkseg>`/`<trkpt>`) et les routes (`<rte>`) sont conservées intégralement (2026-06-17).
- `export_open_data.php` : nouveau parseur GPX → géométrie GeoJSON robuste (tracés `<trk>` et routes `<rte>`, namespaces GPX 1/0 et 1/1, élévation incluse uniquement si tous les points en ont une pour éviter de mélanger positions 2D et 3D).
