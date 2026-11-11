> **État final (Lots 1 à 11).** Ce document est la conception d'origine ; plusieurs de ses étapes ont évolué
> pendant l'implémentation. Schéma actuel : table `arrets` (remplace `gares` et `bus_arrets`), `acces_falaise`
> (remplace `velo` et `acces_pieton_falaise` ; ex-`bus_arrets_falaise` versée avec `type = 'pied'`),
> `lignes_transport` (remplace `bus_lignes` / `bus_liaisons`). Les anciennes tables n'existent plus : tout passe par
> la migration unique `sql_migrations/1_unification_arrets.sql`. Détail des écarts : `docs/plan-implementation-arrets.md`.

Récapitulons :

### Etape 1 : Modification DB

**Note**: prévoir un snapshot du schéma + des fichiers de migration DB.

#### Unification des tables d'arrêts bus / train --> arrêts multi-modaux

Dans la BDD, créer une nouvelle table "arrets" et y copier les données de bus_arrets et gares (ids de gares conservés, ids de bus décalés). Les tables gares/bus_arrets ne sont pas renommées ni supprimées : elles restent en place, pleinement fonctionnelles pour le code actuel, jusqu'à la bascule des endpoints puis une migration de nettoyage dédiée (cf. `docs/plan-implementation-arrets.md`, Lot 1 et Lot 9).
Description de la table arrets:

- id
- nom:text (nom libre)
- loc: Point (issu des champs latlng ou loc)
- slug:text (nom formatte)
- commune:text (nom)
- code_insee: varchar(10) (code insee commune)
- cp: varchar(10) (code postal)
- ter: boolean (l'arrêt est desservi en ter)
- tgv: boolean (l'arrêt est desservi en tgv)
- bus: boolean (l'arrêt est desservi en bus)
- tram: boolean (l'arrêt est desservi en tram)
- teleph: boolean (l'arrêt est desservi en telephérique)
- deleted: boolean (arrêt supprimé)
- description: text? (commentaire libre sur l'arrêt, repris de bus_arrets.description)

##### Migration des arrêts de bus

Les gares sont plus centrales dans le code actuel, donc pas de modification des ids de gares. Après migration du schéma de la table, on réimportera les arrêts de bus dans la nouvelle table arrets.

##### Gares TER/TGV

Actuellement notre base est moins expressive : on n'identifie que les gares TGV qui ne sont QUE des gares TGV (pas desservies en TER), mais pas les gares TER+TGV. Il faudra repasser sur l'ensemble des gares TER desservies en TGV, à la main.

#### Références externe des arrêts

Accompagné d'une table de références externes (références sncf, osm, motis, etc.). Il peut y avoir plusieurs références pour un même arrêt et une même source (ex. plusieurs tags osm), tant que le couple (arret_id, source, ref) reste unique — pas d'unicité globale sur `ref` seul, deux arrêts différents peuvent référencer le même id externe par erreur ou coïncidence.

- id
- arret_id: FK --> arrets.id
- libelle: text? (libelle externe, optionnel)
- source: varchar(64) (sncf, osm, motis, autre)
- ref: varchar(128) (code / id dans la référence)
- data: json? (données brutes de la source, ex. réponse Overpass complète)
- Contrainte : UNIQUE(arret_id, source, ref)

Migration : `bus_arrets.osm_id` → `references_externes.ref` (avec `source = 'osm'`), `bus_arrets.osm_data` → `references_externes.data`.

#### Liaisons Piétonnes Arrêts --> Falaise

Créer une nouvelle table acces_pieton_falaise (avec un champ description) et y copier les données de bus_arrets_falaise (ids remappés). bus_arrets_falaise n'est pas renommée ni supprimée : elle reste en place jusqu'à la bascule des endpoints puis une migration de nettoyage dédiée (cf. `docs/plan-implementation-arrets.md`, Lot 1 et Lot 9).

#### lignes de transports

cf. section dédiée dans l'étape 7.

### Etape 2 : Formulaire d'ajout d'arrêt (refonte formulaire ajout bus)

> [!NOTE] Ouvrir à toutes les modalités
> Je pense qu'il faut ouvrir à toutes les modalités pour permettre d'ajouter et de modifier des gares, surtout pour l'aspect TER / TGV et éviter de créer des exceptions. Les modifications seront toujours réversibles si jamais quelqu'un s'amuse à déplacer une gare TER. Concrètement, les gares deviennent éditables sans passer par la queue de validation admin, exactement comme les arrêts de bus aujourd'hui.

Modifier le formulaire d'ajout d'arrêt de bus, pour que ce soit un formulaire d'ajout d'arrêt toutes modalités.
On ajoute l'arrêt avec coord GPS ou scan overpass (comme actuellement).
On choisit la ou les types de TC désservis.
On permet aussi de lier aux falaises (accès piétons uniquement, indiquer que des accès nécessitant du vélo doivent être créés à partir du formulaire d'ajout d'itinéraire vélo) en réutilisant le mécanisme existant (carte et selecteur de falaise), mais en permettant en plus d'ajouter une description sur l'accès.

À sélection / modification de la position de l'arrêt, lancer un reverse-geocoding à l'API Adresse de la geoplateforme IGN pour remplir automatiquement les champs `commune`, `code_insee` et `cp`. (cf brief ci-après). Ajouter un retour visuel comme pour les zones dans l'ajout falaise.

Modifier la requête overpass de recherche d'arrêts de bus ou en créer d'autres pour les autres types d'arrêts BTT (mais pas de recherche de gares ter/tgv).

Sur la carte du formulaire, il faudrait ajouter les couches de lignes de trains (pmtiles et layers existants (trainlinesLayer et tgvLayers)), et montrer les arrêts existants dans la base de données.
Il faut que chaque type d'arrêt soit représenté par un icone différent, représentatif du type (icones existants: train, tgv, aerial-tram (telepherique), tram, bus-stop). Quand il y a plusieurs type voici la priorité d'icone : ter > tgv > tram > telepherique > bus). Cette logique va être réutilisée partout donc il faut factoriser la résolution et la création de marqueurs arrêts.

À l'écran de confirmation proposer d'ajouter un itinéraire vélo au départ de cet arrêt.

#### Brief — géocodage inverse unitaire (API Adresse / IGN Géoplateforme)

Requête GET sur `https://data.geopf.fr/geocodage/reverse?lon={longitude}&lat={latitude}` (paramètres `lon`/`lat` en degrés décimaux, WGS84). Réponse JSON de type GeoJSON : extraire `features[0].properties`, avec les clés `citycode` (code INSEE), `postcode` (CP) et `city` (nom de commune) — si `features` est vide, aucun résultat trouvé à proximité. Respecter une limite de 50 requêtes/seconde/IP (throttle ~20ms entre appels pour un traitement en boucle).

Le backfill des gares existantes se fait via l'endpoint `api/private/backfill_gares_geocode.php` (admin), qui appelle l'API batch `https://api-adresse.data.gouv.fr/reverse/csv/` (équivalent à `curl -X POST -F data=@gares.csv -F lat=lat -F lon=lon https://api-adresse.data.gouv.fr/reverse/csv/`) pour renseigner `gares.gare_com_insee`/`gare_com_nom`/`gare_com_cp` en un seul appel HTTP pour l'ensemble des gares. Volontairement un endpoint applicatif plutôt qu'un import de fichier dans la migration SQL : un chemin de fichier local (`LOAD DATA INFILE`) ne fonctionne qu'en dev (propre au montage du conteneur Docker), alors que cet endpoint fonctionne identiquement en dev et en prod. Depuis le Lot 9 il opère sur `arrets` (`code_insee` / `commune` / `cp`) et s'appelle APRÈS la migration, qui reprend déjà les valeurs de `gares.gare_com_*` quand elles existent. Les arrêts de bus n'ont pas d'équivalent connu à ce stade.

### Etape 3 : Éditeur de détails

- Afficher tous les arrêts déjà en BDD en jaune pâle sur l'éditeur de détail.
- Afficher les lignes de trains dans une couche optionnelle.
- Permettre de "lier" un arrêt BTT à la falaise en cliquant dessus (et remplir la table acces_pieton_falaise). Bien indiquer que cela signifie que l'on peut aller de l'arrêt à la falaise à pied.
- Permettre de lancer une recherche avec overpass pour faire apparaitre d'autres arrêts BTT non encore en base, et d'en ajouter (avec lien avec la falaise automatique)
- Permettre de placer un arrêt BTT "à la main" (avec liaison automatique à la falaise).
- Ajouter un bouton pour proposer d'ajouter un accès vélo depuis un arrêt (train/bus/etc.) = lien (nouvelle fenêtre) vers le formulaire d'ajout velo

### Etape 4 : Formulaire ajout velo --> Formulaire ajout accès

Modifier le formulaire d'ajout itinéraire vélo pour qu'il permette d'ajouter des accès vélo ou piéton.

Dans tous les cas on demande l'arrêt de départ (autocomplete pour chercher un arrêt existant) en cas d'arrêt introuvable ou inexistant, rediriger vers le formulaire d'ajout d'arrêt.

Faire remonter les options piétonnes (Itinéraire conçu pour la marche uniquement ? / Itinéraire conçu pour le vélo, mais faisable à pied ?), de manière à discriminer au plus tôt si c'est un ajout piéton ou vélo (GPX nécessaire). Dans le cas velo mais faisable à pied, on garde la version vélo du formulaire, en retenant cette indication.

#### Version Piéton

En version piéton, il n'y a plus qu'à sélectionner la falaise à relier et éventuellement une description.

#### Version vélo

En version vélo, on conserve le reste des champs du formulaire vélo actuel, avec l'ajout du GPX etc.

### Etape 5 : Carte globale

**Important**: Bien modifier les deux versions de la carte (leaflet + maplibre)

Faire apparaitre tous les arrêts de tous types reliés à des falaises sur la carte globale en utilisant les marqueurs par type définis en étape 2.
Comme actuellement l'apparence dépend du niveau de zoom (rien > point > icone).
Voici les steps de zoom et les options d'apparence:

- Gares TER+TGV : comportement actuel différent selon que la gare est reliée ou non à un itinéraire vélo affiché sur la carte (`gare.access.length`) :
  - Gares hors topo (aucun itinéraire vélo relié) : Rien -z=11-> point (cercle, rayon 4px, contour blanc, noir si TER seul / `#a00` si TGV)
  - Gares topo (reliées à un itinéraire vélo) : Rien -z=9-> icône train (PNG `icone_train_carte.png`, 24px, teinte rouge via la classe CSS `filterred` si TGV)
- Bus/Tram/Téléphérique : Rien -z=9-> Point jaune (html: gold) -z=11-> icone sur fond jaune (gold), inspiré de l'icone bus actuel.

On garde le même comportement hover/click des gares actuellement. La seule exception est le fait qu'il y aura des itinéraires piétons (liens arrêt -> falaise de la table acces_pieton_falaise) qui ne sont plus représentés par un trait droit arrêt -> falaise (supprimé : il laissait croire à un chemin) ; seule la liaison dans les panneaux d'info / listes les matérialise.

### Etape 6 Lignes BTT et représentation

Le but des lignes est de les représenter et de lier les arrêts BTT avec leurs terminus ou arrêts intéressants. Surtout dans le cas des bus qui parcourent des distances longues et sont souvent (mais pas toujours) reliés à des terminaux multi-modaux (gares). On ne s'occupe pas des lignes de trains (rails) qui sont toujours représentées sur les cartes.

#### Représentation en base de données

##### Lignes BTT

Créer un table lignes_transport qui permette de représenter les lignes BTT. Ces lignes peuvent avoir des géométries très variées donc on doit pouvoir stocker toute sorte de geometries (MultiLinestring)

Champs (? --> optionnel)

- id
- nom: text (nom officiel)
- numero: varchar(64) (identifiant de ligne : L21, C14, Zou 915...)
- operateur: varchar(64)? (Nom de l'opérateur)
- operateur_url: text? (URL du site de l'opérateur)
- horaire_url: text? (URL des horaires, ex: pdf, page web etc.)
- ref: text? (référence ou identifiant officiel de la ligne chez l'opérateur)
- couleur: varchar(64) (code couleur CSS, ex: #123456, gold, hsl(0 0% 0%)...)
- geometry: MultiLineString

##### Liens arrets -> lignes

Cette table permet de lier les arrêts aux lignes BTT

Champs:

- id
- ligne_id FK ligne_transport
- arret_id FK arrets

#### Gestion des lignes BTT : formulaire d'ajout (admin uniquement)

Formulaire ajout_ligne.php, avec un search param ligne_id qui permet de modifier une ligne

Permettre d'importer les données depuis un zip GTFS (Côté front : `fflate` pour dézipper + un parsing CSV maison ou une petite lib (papaparse par ex., browser-compatible)) :

- lister les lignes disponibles dans le GTFS à partir de routes.txt (et trips.txt pour les rattacher à leurs shape_id) pour permettre à l'utilisateur de choisir la ligne à importer, avant toute conversion de géométrie
- geometry : une fois la ligne choisie, résoudre le ou les shape_id associés (via trips.txt) et convertir shapes.txt en MultiLineString à envoyer à l'API
- reste des champs : lire agency.txt pour extraire agency_name (-> operateur), agency_url (-> operateur_url)

Champs du formulaire pour alimenter les champs texte.

Et une carte pour afficher la géométrie importée depuis le shapes.txt si présent dans le zip GTFS.
La carte affiche aussi tous les arrêts en BDD, avec comme dans le cas de l'ajout bus (lier falaise à un arrêt), la possibilité de lier les arrêts à la ligne via popup.

Boutons au-dessus de la carte (icônes, sur deux lignes : tracé, puis arrêts du GTFS) :

- Tracer à la main : active l'éditeur geoman qui permet de tracer des lignes à la main (lignes directes sans routage) avec snapping possible sur des arrêts existants. Quand on clique sur un arrêt existant ça trace le trait et ça ajoute l'arrêt à la liste des arrêts de la ligne.

Comme pour le cas de l'ajout bus, on liste les arrêts liés avec possibilité de lier via un champ auto-complete.

#### Affichage des lignes sur la carte globale ou la carte d'une falaise

Quand on clique sur un arrêt BTT relié à une ligne, en plus de montrer les itinéraires à partir de cette gare et les falaises reliées, toutes les lignes de l'arrêt s'affichent d'emblée (page carte et page falaise), sans bouton ni popup : tracé dans la couleur spécifiée en BDD avec un "halo" blanc, et pastille de la même couleur sur chaque arrêt lié.

### Etape 7 : Falaises accessibles en bus+marche

Dans le formulaire d'ajout de falaise, prévoir un champ "cette falaise est accessible à pied depuis un arrêt BTT", et si on clique dessus, ça demande lequel, avec possibilité d'en sélectionner plusieurs.
À l'ajout de la falaise, il faudra créer les accès piétons (acces_pieton_falaise) correspondants.

#### Migration des itinéraires vélo (à pied uniquement)

Les itinéraires dans la table velo marqués apieduniquement devront être migrés vers la table acces_pieton_falaise. Prévoir une requête SQL pour la migration.

#### Filtrage sur la carte et dans la page tableau

Permettre de filtrer sur le critère "accessible" à pied en se basant non plus sur velo_apieduniquement mais sur la table acces_pieton_falaise

#### Évolution : une seule table d'accès (Lot 8quater)

Les tables `velo` et `acces_pieton_falaise` ont ensuite été fusionnées en `acces_falaise` (colonne `type` : `velo` ou `pied`). Les accès à pied de cette étape sont les lignes `type = 'pied'` ; « accessible à pied » devient `type = 'pied'` ou `km <= 5` (calculé, plus de colonne `velo_apiedpossible`). Voir `docs/plan-implementation-arrets.md`, Lot 8quater.

### Etape 8 : Cleaning anciennes entités / tables liées aux bus

bus_lignes et bus_liaisons deviennent obsolètes. On ne supprime pas ces tables (les données restent en base indéfiniment) : on arrête simplement de les lire/écrire depuis le code applicatif une fois lignes_transport en production.

**Fait (Lot 9, 2026-11-09)** : plus aucune lecture ni écriture de `bus_lignes` / `bus_liaisons` (API, formulaires, fiche falaise, export open data). Les tables restent en base, sans `DROP`.

#### Mise à jour d'une ligne depuis un GTFS rechargé

En mode édition (`ajout_ligne.php?ligne_id=…`), après avoir chargé un zip GTFS et choisi la ligne, le bouton « Comparer les arrêts avec ceux de la ligne » affiche un aperçu en trois groupes (`GtfsComparaison.vue`, logique pure dans `frontend/src/utils/gtfs-match.ts`) :

- **toujours desservis** : arrêts GTFS rapprochés d'un arrêt déjà lié ;
- **nouveaux** (cochés par défaut) : à lier à un arrêt existant proche (< 100 m, même famille de modalité) ou à créer ;
- **absents du GTFS** (décochés par défaut, mis en évidence) : arrêts liés mais plus présents. Les cocher les **délie** de la ligne ; l'arrêt lui-même n'est jamais supprimé (il peut servir à d'autres lignes ou à des accès falaise).

Ordre de rapprochement : `stop_id` mémorisé parmi les arrêts déjà liés, puis proximité parmi les arrêts liés, puis proximité dans le catalogue, sinon nouvel arrêt. « Appliquer » ne modifie que le formulaire ; tout est écrit à l'envoi.

Mémorisation : le `route_id` est déjà dans `lignes_transport.ref` ; les `stop_id` sont dans `references_externes` (`source = 'gtfs'`, `ref = stop_id`, `libelle` = nom GTFS), écrits par `api/add_ligne.php` (`gtfs_refs` pour les arrêts existants, `nouveaux_arrets[].stop_id` pour les créés) et relus par `api/fetch_ligne.php` (`gtfs_refs`). Limite : un `stop_id` n'est unique que dans son GTFS, d'où la recherche restreinte aux arrêts liés à la ligne.
