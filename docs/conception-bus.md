Récapitulons :

### Etape 1 : Modification DB

**Note**: prévoir un snapshot du schéma + des fichiers de migration DB.

#### Unification des tables d'arrêts bus / train --> arrêts multi-modaux

Dans la BDD, fusionner les tables bus_arrets et gares, et renommer la table obtenue en "arrets".
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

#### Références externe des arrêts

Accompagné d'une table de références externes (références sncf, osm, motis, etc.). Il peut y avoir plusieurs références pour un même arret et une même source, pas de contraintes d'unicité, donc.

- id
- arret_id: FK --> arrets.id
- libelle: text? (libelle externe, optionnel)
- source: varchar(64) (sncf, osm, motis, autre)
- ref: varchar(128) (code / id dans la référence)

#### Liaisons Piétonnes Arrêts --> Falaise

Renommer la table bus_arrets_falaise en arrets_falaise et ajouter un champ description

### Etape 2 : Formulaire d'ajout d'arrêt (refonte formulaire ajout bus)

> [!NOTE] Ouvrir à toutes les modalités
> Je pense qu'il faut ouvrir à toutes les modalités pour permettre d'ajouter et de modifier des gares, surtout pour l'aspect TER / TGV et éviter de créer des exceptions. Les modifications seront toujours réversibles si jamais quelqu'un s'amuse à déplacer une gare TER.

Modifier le formulaire d'ajout d'arrêt de bus, pour que ce soit un formulaire d'ajout d'arrêt toutes modalités.
On ajoute l'arrêt avec coord GPS ou scan overpass (comme actuellement).
On choisit la ou les types de TC désservis.
On permet aussi de lier aux falaises (accès piétons uniquement, indiquer que des accès nécessitant du vélo doivent être créés à partir du formulaire d'ajout d'itinéraire vélo) en réutilisant le mécanisme existant (carte et selecteur de falaise), mais en permettant en plus d'ajouter une description sur l'accès.

À sélection / modification de la position de l'arrêt, lancer un reverse-geocoding à l'API Adresse de la geoplateforme IGN pour remplir automatiquement les champs `commune`, `code_insee` et `cp`. (cf brief ci-après). Ajouter un retour visuel comme pour les zones dans l'ajout falaise.

Modifier la requête overpass de recherche d'arrêts de bus ou en créer d'autres pour les autres types d'arrêts BTT (mais pas de recherche de gares ter/tgv).

Sur la carte il faudrait ajouter les couches de lignes de trains, montrer les arrêts existants dans la base de données.
Il faut que chaque type d'arrêt soit représenté par un icone différent, représentatif du type (icones existants: train, tgv, aerial-tram (telepherique), tram, bus-stop). Quand il y a plusieurs type voici la priorité d'icone : ter > tgv > tram > telepherique > bus). Cette logique va être réutilisée partout donc il faut factoriser la résolution et la création de marqueurs arrêts.

À l'écran de confirmation proposer d'ajouter un itinéraire vélo au départ de cet arrêt.

#### Brief — géocodage inverse unitaire (API Adresse / IGN Géoplateforme)

Requête GET sur `https://data.geopf.fr/geocodage/reverse?lon={longitude}&lat={latitude}` (paramètres `lon`/`lat` en degrés décimaux, WGS84). Réponse JSON de type GeoJSON : extraire `features[0].properties`, avec les clés `citycode` (code INSEE), `postcode` (CP) et `city` (nom de commune) — si `features` est vide, aucun résultat trouvé à proximité. Respecter une limite de 50 requêtes/seconde/IP (throttle ~20ms entre appels pour un traitement en boucle).

### Etape 3 : Éditeur de détails

- Afficher tous les arrêts déjà en BDD en jaune pâle sur l'éditeur de détail.
- Afficher les lignes de trains dans une couche optionnelle.
- Permettre de "lier" un arrêt BTT à la falaise en cliquant dessus (et remplir la table arrets_falaise). Bien indiquer que cela signifie que l'on peut aller de l'arrêt à la falaise à pied.
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

### Etape 6 : Carte globale

**Important**: Bien modifier les deux versions de la carte (leaflet + maplibre)

Faire apparaitre tous les arrêts de tous types reliés à des falaises sur la carte globale en utilisant les marqueurs par type définis en étape 2.
Comme actuellement l'apparence dépend du niveau de zoom (rien > point > icone).
Voici les steps de zoom et les options d'apparence:

- Gares TER+TGV : {% Comme actuellement, complète ce passage avec les valeurs réelles %}
- Bus/Tram/Téléphérique : Rien -z=9-> Point jaune ({% Couleur actuelle de l'arrêt de bus %}) -z=11-> icone sur fond jaune, inspiré de l'icone bus actuel.

On garde le même comportement hover/click des gares actuellement. La seule exception est le fait qu'il y aura des itinéraires piétons (liens arrêt -> falaise de la table arrets_falaise) qu'il faut représenter par un trait droit arrêt -> falaise.

### Etape 7 Lignes BTT et représentation

Le but des lignes est de les représenter et de lier les arrêts avec leurs terminus ou arrêts intéressants. Surtout dans le cas des bus qui parcourent des distances longues et sont souvent (mais pas toujours) reliés à des terminaux multi-modaux (gares).

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

#### Gestion des lignes BTT : formulaire d'ajout

Formulaire ajout_ligne.php, avec un search param ligne_id qui permet de modifier une ligne

Permettre d'importer les données depuis un zip GTFS

Champs du formulaire pour alimenter les champs texte.

Et une carte pour afficher la géométrie importée depuis le shapes.txt si présent dans le zip GTFS.
La carte affiche aussi tous les arrêts en BDD, avec comme dans le cas de l'ajout bus (lier falaise à un arrêt), la possibilité de lier les arrêts à la ligne via popup.

Ajouter deux boutons au dessus de la carte :

- Importer un fichier shapes.txt (Remplace la geometry de la ligne)
- Tracer à la main : active l'éditeur geoman qui permet de tracer des lignes à la main (lignes directes sans routage) avec snapping possible sur des arrêts existants. Quand on clique sur un arrêt existant ça trace le trait et ça ajoute l'arrêt à la liste des arrêts de la ligne.

Comme pour le cas de l'ajout bus, on liste les arrêts liés avec possibilité de lier via un champ auto-complete.

#### Affichage des lignes sur la carte globale ou la carte d'une falaise

Quand on clique sur un arrêt BTT relié à une ligne, en plus de montrer les itinéraires à partir de cette gare et les falaises reliées, on va faire apparaitre un bouton (dans le panel d'info) "voir la ligne de bus" qui va faire afficher la ligne de bus dans la couleur spécifiée en BDD + "halo" blanc et mettre en évidence les arrêts liés.

### Etape 8 : Falaises accessibles en bus+marche

// TODO

- dans le formulaire d'ajout de falaise, prévoir un champ "cette falaise est accessible à pied depuis un arrêt BTT", et si on clique dessus, ça demande lequel, et en facultatif ajouter km, d+, d-, avec calculatrice qui donne le temps de marche. Afficher ça automatiquement dans le champ acces_bus de la falaise.
- permettre de filtrer sur ce critère
