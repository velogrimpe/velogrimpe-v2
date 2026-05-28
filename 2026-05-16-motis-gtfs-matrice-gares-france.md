---
title: "Calculer une matrice gare-à-gare en France avec Motis et les GTFS"
description: "Guide complet et sourcé : installer Motis localement, récupérer les GTFS français sur le PAN, composer une matrice origine-destination, et pourquoi l'approche par produit matriciel min-plus échoue sur un graphe temporel."
date: 2026-05-16
lang: fr
---

Pour velogrimpe.fr j'ai besoin d'une matrice : pour chaque paire (gare A, gare B) en France, le temps de trajet minimal en train et le nombre minimal de correspondances. L'idée derrière : pouvoir afficher rapidement, depuis une gare donnée, toutes les falaises atteignables en moins de N heures en combinant train + vélo.

Faire ça correctement n'est pas trivial. Le réseau ferroviaire français contient ~3 000 gares actives, ce qui donne ~9 millions de paires. Chaque trajet possible est défini par un horaire — partir à 8h12 ou 8h13 change tout — et un changement de train introduit une attente non-déterministe. Ce n'est pas un graphe statique : c'est un graphe temporel.

Cet article documente la démarche : installer Motis en local, agréger les GTFS de France, et — c'est la partie intéressante — comprendre pourquoi l'intuition matricielle naïve (matrice des trajets directs, puis puissances pour obtenir 1, 2, 3 correspondances) tombe à l'eau dès qu'on prend les horaires au sérieux.

---

## 1. Motis : c'est quoi, pour quoi ?

[MOTIS (Modular Open Transportation Information System)](https://github.com/motis-project/motis) est un moteur de routage multimodal open source écrit en C++, maintenu par l'université de Darmstadt et la communauté Transitous. Il consomme :

- **OpenStreetMap** (`.osm.pbf`) pour le réseau routier, piéton et cyclable
- **GTFS** et **NeTEx** pour les horaires théoriques de transports en commun
- **GTFS-RT**, **SIRI-ET/SX/FM**, **VDV 454 AUS** pour les mises à jour temps réel
- **GBFS** pour les feeds de vélos/trottinettes en libre-service

Source : [MOTIS README](https://github.com/motis-project/motis)

En interne, le routage transport collectif est porté par [nigiri](https://github.com/motis-project/nigiri), un cœur de routage écrit en data-oriented programming. Nigiri convertit toutes les heures en UTC en amont — un trajet "normal" en zone à heure d'été est dupliqué en version hiver/été, et un trajet qui passe minuit peut avoir encore plus de variantes — pour ensuite faire tourner un RAPTOR très compact. Source : [nigiri repo](https://github.com/motis-project/nigiri).

### Pourquoi Motis plutôt qu'OpenTripPlanner ou r5 ?

| Critère | Motis (nigiri) | OpenTripPlanner 2 | r5 (Conveyal) |
| --- | --- | --- | --- |
| Langage | C++ | Java | Java |
| Empreinte mémoire | Très faible | Élevée | Moyenne |
| Vitesse d'import GTFS | Rapide | Lente | Moyenne |
| API REST | OpenAPI v5/plan, v1/one-to-many | GraphQL + REST | Pas d'API REST officielle |
| Many-to-many transit | Via plusieurs `/plan` ou one-to-many | Script `analysis` | Natif via `travel_time_matrix` |
| Multimodal vélo + train | Bon | Bon | Excellent |

Motis est aujourd'hui le moteur derrière [transitous.org](https://transitous.org), une instance communautaire qui agrège les feeds de plusieurs dizaines de pays. C'est aussi celui qui a la documentation la moins amicale, mais l'installation et la consommation des GTFS sont triviales en CLI, ce qui le rend adapté à une utilisation jetable pour faire tourner un calcul de matrice en local.

Source : [Transitous documentation](https://transitous.org/doc/), [r5r paper — Findings 2023](https://findingspress.org/article/21262-r5r-rapid-realistic-routing-on-multimodal-transport-networks-with-r-5-in-r).

---

## 2. Installer Motis en local

Motis propose des binaires précompilés Linux/macOS/Windows sur ses [releases GitHub](https://github.com/motis-project/motis/releases) (actuellement v2.9.2, avril 2026). Pas besoin de Docker pour un usage en local.

```bash
# Linux x86_64 — adapter pour macOS/Windows
curl -L -o motis.tar.gz \
  https://github.com/motis-project/motis/releases/latest/download/motis-linux-amd64.tar.gz
tar xzf motis.tar.gz
chmod +x motis
```

### Préparer les données

Motis a besoin d'au minimum un ou plusieurs `.zip` GTFS. **L'OSM est optionnel** — j'y reviens juste après.

```bash
mkdir motis-fr && cd motis-fr
# Les GTFS arrivent à l'étape suivante, on les met dans le même dossier
```

### OSM : strictement nécessaire ?

Motis est modulaire. L'OSM n'est requis **que pour** :

- le **street routing** (rabattement à pied/vélo/voiture vers et depuis les gares),
- le **géocodage** (résoudre "Lyon" en coordonnées) et le reverse-geocoding,
- le **serveur de tuiles** pour afficher une carte.

Source : [Motis README — configuration](https://github.com/motis-project/motis), [setup.md — OSM requis par tiles/street routing/geocoding](https://github.com/motis-project/motis/blob/master/docs/setup.md).

**Pour une matrice gare-à-gare pure** où on alimente Motis avec des `stop_id` issus du GTFS, l'OSM n'est strictement pas nécessaire. Un `config.yml` minimal :

```yaml
server:
  port: 8080
timetable:
  datasets:
    sncf:        { path: sncf-gtfs.zip }
    transilien:  { path: transilien-gtfs.zip }
    idfm:        { path: idfm-gtfs.zip }
```

Et on lance directement :

```bash
./motis import       # < 5 min sans OSM
./motis server
```

L'empreinte mémoire tombe à <2 Go, l'import à quelques minutes, et le disque (`data/`) à 1-2 Go. C'est l'option idéale si l'objectif est **uniquement** la matrice OD entre gares ferroviaires.

**Quand est-ce qu'on a quand même besoin d'OSM ?** Trois cas pratiques :

1. **Requêtes par coordonnées** ("depuis cet hôtel") — Motis calcule le rabattement à pied jusqu'aux gares voisines.
2. **Sélection automatique de gare dans une ville** (voir section 8) — Motis a besoin de marcher entre la coordonnée fournie et les gares candidates.
3. **Multimodal vélo + train** — typiquement le besoin de velogrimpe : "quelles falaises sont accessibles depuis la gare X en moins de Y minutes à vélo" implique du routage rue jusqu'à la falaise.

**Si on prend OSM, faut-il toute la France ?** Non. Le PBF France entière (5 Go) est un défaut commode mais on peut :

- Prendre uniquement une **région Geofabrik** (`rhone-alpes-latest.osm.pbf` à ~250 Mo) si l'usage est régional. Source : [Geofabrik download Europe/France](https://download.geofabrik.de/europe/france.html).
- Faire un **extract OSM ciblé** avec [osmium](https://osmcode.org/osmium-tool/) autour des gares : un bbox étendu de 30 km autour de chaque gare suffit pour un rabattement vélo réaliste, ce qui réduit massivement le PBF.
- **Combiner plusieurs PBF régionaux** avec `osmium merge`, ce qui est plus rapide à importer dans Motis qu'un PBF national. Source : [Motis discussion #513 — multiple OSM files](https://github.com/motis-project/motis/discussions/513).

```bash
# Extract ciblé autour des gares françaises (exemple avec un fichier gares.osm.pbf)
osmium extract -p stations-30km-buffer.geojson france-latest.osm.pbf \
  -o france-stations.osm.pbf
# Résultat typique : 5 Go → ~800 Mo
```

Téléchargement du PBF si on veut OSM :

```bash
curl -L -o france.osm.pbf https://download.geofabrik.de/europe/france-latest.osm.pbf
```

### Configurer et importer

La commande `motis config` génère un `config.yml` minimal à partir des fichiers passés en argument :

```bash
./motis config france.osm.pbf sncf-tgv.zip sncf-ter.zip sncf-intercites.zip transilien.zip
./motis import      # préprocessing : ~10-30 minutes pour la France
./motis server      # démarre l'API HTTP sur :8080
```

Source : [Motis quick start](https://github.com/motis-project/motis#quick-start).

Le dossier `data/` créé par `import` contient les structures précalculées (typiquement 2-5 Go pour la France ferroviaire selon le nombre de feeds). C'est ce qui rend les requêtes ensuite quasi-instantanées.

### Empreinte mémoire et disque

Motis a la réputation d'être l'un des moteurs de routage transit les plus légers. Le README annonce **moins de 2 Go de RAM pour charger un timetable annuel complet**, grâce aux *traffic day bitsets* (un trip qui circule certains jours est représenté par un bitset de 365 bits plutôt qu'une duplication des données). Source : [Motis README — features](https://github.com/motis-project/motis).

En pratique pour la France entière (ferroviaire + IDFM + grandes métropoles + OSM France) :

| Ressource | Pic à l'import | Régime de service |
| --- | --- | --- |
| RAM | 6-10 Go (OSM dominé par le graphe routier) | 3-5 Go |
| Disque (`data/`) | — | 4-8 Go |
| Disque (sources) | 8-12 Go (OSM + GTFS) | — |
| CPU | Multi-coeur utilisé pendant `import` | 1 coeur par requête, sub-seconde |

Pour ne couvrir que le ferroviaire **sans le routage rue**, on tombe à <2 Go de RAM. Le coût mémoire vient principalement du graphe OSM (5 Go de `.pbf` France → ~3-4 Go de structures en mémoire). Source : [DeepWiki — Motis architecture](https://deepwiki.com/motis-project/motis).

Concrètement : un MacBook 16 Go ou un VPS Scaleway DEV1-M (8 Go) suffit largement pour faire tourner Motis France en local. Inutile de provisionner gros.

### Vérifier que ça tourne

Une fois `motis server` lancé, l'OpenAPI est servie sur `http://localhost:8080/` et la spec est dans le repo : [openapi.yaml](https://github.com/motis-project/motis/blob/master/openapi.yaml).

```bash
# Géocodage rapide
curl 'http://localhost:8080/api/v1/geocode?text=Grenoble'

# Plan d'un trajet Paris-Gare-de-Lyon → Grenoble demain à 8h
curl 'http://localhost:8080/api/v5/plan' \
  --data-urlencode 'fromPlace=2.373505,48.844548' \
  --data-urlencode 'toPlace=5.713,45.191' \
  --data-urlencode 'time=2026-05-17T08:00:00+02:00' \
  --data-urlencode 'transitModes=RAIL'
```

---

## 3. Récupérer les GTFS de France

En France, **transport.data.gouv.fr** (le Point d'Accès National, PAN) centralise les données ouvertes de transport au format GTFS, NeTEx et GTFS-RT.

### Le PAN n'est pas du volontariat

Contrairement à une idée reçue, publier sur le PAN **n'est pas une démarche volontaire** pour les opérateurs de transport régulier de personnes. C'est une **obligation légale** :

- Le règlement délégué européen [UE 2017/1926](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32017R1926) impose à chaque État membre la mise en place d'un Point d'Accès National et la publication des données de transport selon des formats normalisés.
- L'article 9 de la **Loi d'Orientation des Mobilités (LOM)** de 2019 transpose cette obligation en droit français : toutes les autorités organisatrices de mobilité (AOM), opérateurs de service public et délégataires doivent publier leurs horaires théoriques sur le PAN, au format GTFS et/ou NeTEx.

Source : [doc.transport.data.gouv.fr — FAQ producteurs](https://doc.transport.data.gouv.fr/type-donnees/operateurs-de-transport-regulier-de-personnes/ressources/faq), [Étude ORT BFC — État des lieux ouverture des données mobilité (PDF)](https://www.ort.bourgogne-franche-comte.developpement-durable.gouv.fr/IMG/pdf/etat-des-lieux-ouverture-et-reutilisation-des-donnees-de-mobilite-2021-1.pdf).

Ce qu'on observe parfois comme un "trou" dans la couverture vient de **la conformité inégale** des opérateurs (retards de mise à jour, feeds expirés, granularité variable), pas d'un défaut de référencement. Le PAN agrège tout ce qui devrait être publié — si un feed manque, c'est l'AOM concernée qui est en défaut d'obligation, et le PAN dispose de moyens de relance.

En pratique, **pour le ferroviaire, la couverture est quasi-complète** (SNCF Voyageurs et Île-de-France Mobilités sont des contributeurs constants). Pour les réseaux urbains, ~95 % des AOM publient au moins un feed GTFS, mais la fraîcheur varie. Source : [autorite-transports.fr — État des lieux 2021](https://www.ort.bourgogne-franche-comte.developpement-durable.gouv.fr/IMG/pdf/etat-des-lieux-ouverture-et-reutilisation-des-donnees-de-mobilite-2021-1.pdf).

### Agrégateurs internationaux : Mobility Database et Transitland

Si on veut **dépasser le PAN français** (par exemple pour un calcul couvrant aussi des trajets transfrontaliers, ou pour comparer des feeds entre pays), deux agrégateurs internationaux référencent les feeds français au même titre que ceux du reste du monde :

- **[Mobility Database](https://mobilitydatabase.org/)** (porté par l'organisation [MobilityData](https://mobilitydata.org/), responsable de la spécification GTFS) — catalogue de 6 000+ feeds GTFS, GTFS-RT et GBFS dans 99+ pays. Son API ([swagger](https://github.com/MobilityData/mobility-feed-api)) permet de filtrer par `country_code=FR`, par bounding box, ou par date de mise à jour. Authentification gratuite par token. Source : [Mobility Database — FAQ](https://mobilitydatabase.org/faq).

- **[Transitland](https://www.transit.land/)** (Interline Technologies) — le plus ancien et le plus utilisé des agrégateurs GTFS. Plus de 50 pays couverts, API REST avec endpoints `/feeds`, `/operators`, `/stops`. Source : [Interline — Transitland](https://www.interline.io/transitland/).

**Mais attention** : pour les feeds français, ces agrégateurs **redistribuent en fait ce que le PAN expose**. Ils ne contiennent ni plus de feeds, ni des feeds plus frais. Leur intérêt est :

1. Un format de catalogue unifié si on travaille multi-pays (un seul schéma JSON à parser).
2. Des métadonnées normalisées (bounding box, fenêtre de validité) calculées de manière homogène.
3. Un accès quand le PAN est temporairement indisponible.

Pour un usage 100 % France, le PAN reste le canal officiel et le plus à jour. Le tableau récap :

| Source | Couverture France | Couverture monde | API | Fraîcheur |
| --- | --- | --- | --- | --- |
| transport.data.gouv.fr (PAN) | Officielle, exhaustive | — | Publique, sans token | Quotidienne |
| Mobility Database | Mirror du PAN | 99+ pays | Token gratuit | Quotidienne à hebdo |
| Transitland | Mirror du PAN | 50+ pays | Token (free tier) | Quotidienne |

Source : [transport.data.gouv.fr](https://transport.data.gouv.fr/), [doc.transport.data.gouv.fr](https://doc.transport.data.gouv.fr/).

### Les feeds qui couvrent le ferroviaire

Pour bâtir une matrice gare-à-gare complète en France, il faut au minimum :

| Feed | Périmètre | URL PAN |
| --- | --- | --- |
| TGV + Intercités + TER | Réseau national SNCF Voyageurs | [horaires-sncf](https://transport.data.gouv.fr/datasets/horaires-sncf) |
| Intercités | Lignes Intercités SNCF (national) | [horaires-des-lignes-intercites-sncf](https://transport.data.gouv.fr/datasets/horaires-des-lignes-intercites-sncf) |
| Transilien | Île-de-France ferroviaire | [horaires-des-lignes-transilien-1](https://transport.data.gouv.fr/datasets/horaires-des-lignes-transilien-1) |
| IDFM (multimodal) | Métro, RER, bus, tram IDF | [reseau-urbain-et-interurbain-dile-de-france-mobilites](https://transport.data.gouv.fr/datasets/reseau-urbain-et-interurbain-dile-de-france-mobilites) |
| TER (par région) | Certaines régions exposent leur propre feed | filtrer sur le PAN avec `type=public-transit` |

À cela s'ajoutent éventuellement les réseaux urbains majeurs si on veut le maillage fin (TBM Bordeaux, Lignes d'Azur Nice, Le Met' Metz, etc.) — chacun a sa fiche sur le PAN.

### API pour scripter le téléchargement

Le PAN expose une API REST documentée à `https://transport.data.gouv.fr/api/`. L'endpoint qui nous intéresse :

```bash
# Lister tous les datasets GTFS de transit
curl 'https://transport.data.gouv.fr/api/datasets' \
  | jq '.[] | select(.resources[].format == "GTFS") | {slug, title, resources}'
```

Pour chaque ressource GTFS, le champ `original_url` (ou `url`) donne l'URL directe du `.zip`. Quelques pièges à anticiper :

- Le PAN expose à la fois l'URL d'origine (chez le producteur) et une URL stable (`stable_url`) cachée par le PAN. **Préférer `stable_url`** : les producteurs changent régulièrement leurs URLs.
- Certains gros feeds (IDFM notamment) demandent un token API à récupérer côté producteur. Le PAN documente cela par dataset.
- La fraîcheur des feeds est vérifiée quotidiennement par le PAN qui calcule des [indicateurs de qualité](https://transport.data.gouv.fr/datasets) (`metadata.modes`, `metadata.start_date`, `metadata.end_date`). Filtrer ces métadonnées pour éviter d'importer un feed expiré.

### Téléchargement automatisé

Un petit script suffit pour récupérer tous les GTFS transit publiés :

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p gtfs
curl -s 'https://transport.data.gouv.fr/api/datasets' \
  | jq -r '.[] | select(.type == "public-transit")
             | .resources[]
             | select(.format == "GTFS")
             | "\(.id)\t\(.original_url // .url)"' \
  | while IFS=$'\t' read -r id url; do
      echo "→ $id"
      curl -fsSL -o "gtfs/$id.zip" "$url" || echo "FAIL: $url"
    done
```

Une fois tous les zip téléchargés, Motis sait digérer une liste arbitraire de feeds en une seule passe. La déduplication des arrêts entre feeds (un même Gare-de-Lyon présent dans SNCF + IDFM) est gérée par Motis via les `stop_id` et la proximité géographique.

---

## 4. La tentation de la matrice de directs

Maintenant la partie matricielle. L'intuition est séduisante : construire d'abord la matrice $D$ des trajets **directs** entre toutes paires de gares (un trajet est direct s'il existe au moins un train qui va de A à B sans changement), puis "composer" pour obtenir les trajets avec 1, 2, 3 correspondances.

### L'algèbre min-plus, en deux minutes

Le bon cadre formel est le **semi-anneau tropical**, ou min-plus. On remplace $(\mathbb{R}, +, \times)$ par $(\mathbb{R} \cup \{+\infty\}, \min, +)$. La "multiplication matricielle" devient :

$$ (A \otimes B)_{ij} = \min_k \left( A_{ik} + B_{kj} \right) $$

Source : [Min-plus matrix multiplication — Wikipedia](https://en.wikipedia.org/wiki/Min-plus_matrix_multiplication), [Antimatroid — Tropical representation of APSP](https://antimatroid.wordpress.com/2012/06/01/tropical-representation-of-the-all-pairs-shortest-path-problem/).

Avec $D$ = matrice des temps directs (et $+\infty$ là où il n'y a pas de direct), on a :

- $D$ : temps minimal avec 0 correspondance
- $D^{\otimes 2} = D \otimes D$ : temps minimal avec **au plus** 1 correspondance
- $D^{\otimes k}$ : temps minimal avec au plus $k-1$ correspondances

C'est exactement le cœur de l'algorithme de **Floyd-Warshall** vu sous l'angle algébrique, et plus généralement la fermeture de Kleene dans le semi-anneau tropical. Source : [Dijkstra, Floyd and Warshall Meet Kleene](https://trustworthy.systems/publications/nicta_full_text/5506.pdf).

Sur 3 000 gares, $D$ fait $3000 \times 3000 = 9 \cdot 10^6$ cases — gérable en mémoire (~70 Mo en float32). Une multiplication min-plus en $O(n^3)$ tient en quelques secondes avec numpy ou en GPU.

```python
import numpy as np

INF = np.inf

def min_plus(A, B):
    # (n, n) ⊗ (n, n) → (n, n)
    return np.min(A[:, :, None] + B[None, :, :], axis=1)

# D[i][j] = temps min d'un direct i → j, INF si pas de direct
D = build_direct_matrix(gtfs_feed)

D1 = D
D2 = min_plus(D, D)        # ≤ 1 correspondance
D3 = min_plus(D2, D)       # ≤ 2 correspondances
```

Le compte des correspondances peut être fait en parallèle dans une seconde matrice $C$ : à chaque composition, on garde le $k^*$ qui a réalisé le min et on additionne $C_{ik^*} + 1 + C_{k^*j}$.

**Et là c'est tentant de conclure : on a notre matrice.**

---

## 5. Pourquoi cette approche est fausse pour un réseau de transit

Le problème, c'est que **le réseau ferroviaire n'est pas un graphe statique**. Le temps d'un trajet de Lyon à Marseille n'est pas un nombre — c'est une fonction de l'heure de départ. Un produit min-plus naïf en ignore deux phénomènes essentiels.

### Piège 1 : le temps d'attente à la correspondance

Si $D_{AC} = 60$ min (Paris → Lyon direct) et $D_{CB} = 50$ min (Lyon → Marseille direct), $D^{\otimes 2}_{AB} = 110$ min. Mais dans la réalité, votre train arrive à Lyon à 11h00 et le prochain Lyon-Marseille part à 11h47 : il faut ajouter **47 minutes d'attente** qui ne sont nulle part dans $D$.

L'attente dépend de l'horaire effectif et n'est pas une propriété de l'arête $(A, C)$ ni de l'arête $(C, B)$ prises isolément. Elle dépend du **couple** (train précédent, train suivant) et de l'heure dans la journée. Aucune opération matricielle sur des $D_{ij}$ scalaires ne peut la capturer.

### Piège 2 : la non-superposition des trajets

Min-plus suppose qu'on peut "coller" deux trajets directs librement. Mais si le dernier Paris→Lyon arrive à 22h30 et que le premier Lyon→Marseille de la journée part à 6h12, le trajet composé existe mathématiquement mais n'a aucun sens opérationnel (vous dormez 8 heures en gare).

### Piège 3 : ce que veut dire "direct"

Définir $D_{ij}$ comme "temps minimum d'un trajet direct" suppose qu'il existe une seule réponse. En pratique, plusieurs trains directs Paris-Lyon par jour, avec des durées différentes (TGV inOui 1h57 vs OUIGO 1h59 vs un TER hypothétique 4h). $D$ ne capture qu'un seul nombre par paire. Et "le plus court trajet direct" n'est pas forcément utile dans la composition — il faut parfois prendre un direct plus lent pour arriver à temps pour la connexion.

### Conséquence : le résultat est au mieux une borne, au pire absurde

Concrètement, l'approche min-plus naïve donne :

- Une **borne inférieure** sur le temps de trajet réel (on n'a pas compté l'attente)
- Avec une borne potentiellement **inatteignable** (correspondance impossible)
- Et un nombre de correspondances correct **uniquement si** on accepte ces compositions invalides

Si l'objectif est juste de répondre "existe-t-il un trajet ferroviaire entre A et B avec au plus 3 correspondances ?", la composition booléenne de la matrice d'adjacence (semi-anneau $(\{0,1\}, \vee, \wedge)$) marche : c'est de la fermeture transitive classique, et 3 multiplications suffisent pour $\le 3$ correspondances. Mais dès qu'on veut le **temps minimal**, l'approche tombe à plat.

---

## 6. La bonne approche : RAPTOR et le routage par rounds

Le bon algorithme pour ce problème — celui qu'utilise Motis via nigiri — s'appelle **RAPTOR** (Round-bAsed Public Transit Optimized Router), publié par Delling, Pajor et Werneck chez Microsoft Research en 2012.

Source : [Round-Based Public Transit Routing — Delling, Pajor, Werneck (PDF)](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf).

### L'idée centrale

RAPTOR est exactement organisé par nombre de correspondances. À chaque round $k$, l'algorithme calcule l'heure d'arrivée optimale dans chaque gare en utilisant **au plus $k$ trajets** (donc $k-1$ correspondances). Pour passer du round $k$ au round $k+1$ :

1. Identifier les gares dont l'heure d'arrivée a été améliorée au round $k$ (les "marquées").
2. Pour chaque route (ligne commerciale) passant par une gare marquée : parcourir la route depuis la première gare marquée, en prenant le train le plus tôt possible compte tenu de l'heure d'arrivée déjà connue, et marquer les gares aval améliorées.
3. Appliquer les **footpaths** (correspondances à pied entre quais/gares proches).

L'algorithme s'arrête quand un round n'améliore plus rien, ou après un nombre fixé de rounds (typiquement 5-8 suffisent en pratique).

```
Round 0 : seule la gare de départ A a une heure d'arrivée (= heure de départ)
Round 1 : toutes les gares atteignables en un seul train depuis A
Round 2 : ajout des gares atteignables avec 1 correspondance
Round 3 : 2 correspondances
...
```

Source : [RAPTOR algorithm — Linus Norton](https://ljn.io/posts/raptor-journey-planning-algorithm), [kuanbutts — RAPTOR simple example](http://kuanbutts.com/2020/09/12/raptor-simple-example/).

### Pourquoi RAPTOR fait mieux que min-plus

RAPTOR opère sur la **représentation horaire native** : il connaît tous les passages individuels (trips × stops × heures), pas une matrice agrégée. Du coup :

- L'attente à la correspondance est calculée exactement (heure d'arrivée du train précédent → heure de départ du suivant).
- Un trajet "direct plus lent mais qui rate moins la correspondance" peut être préféré au "direct le plus rapide".
- L'optimisation est multi-critère : on calcule simultanément le Pareto-front (heure d'arrivée, nombre de correspondances), ce qui correspond exactement à ce que demande l'utilisateur initial.
- Pas de préprocessing requis (contrairement à Contraction Hierarchies pour la route) : RAPTOR fonctionne directement sur les GTFS importés.

### Many-to-many : RAPTOR appelé pour chaque origine

Pour bâtir la matrice OD complète, l'approche standard est de faire tourner RAPTOR $N$ fois, une fois par gare d'origine. Le coût d'un RAPTOR est en $O(R \cdot S + T)$ avec $R$ routes, $S$ stops marqués, $T$ transferts — typiquement quelques millisecondes par origine sur un feed français.

Source : [Delling et al. — section 6.1 Performance evaluation](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf).

Il existe des variantes spécialisées **one-to-many** (rRAPTOR, rTBTR) qui réduisent encore le coût quand on parcourt toutes les destinations depuis une origine donnée, et qui sont implémentées dans r5/r5r si on veut industrialiser massivement le calcul de matrices. Source : [r5r travel_time_matrix doc](https://rdrr.io/cran/r5r/man/travel_time_matrix.html).

Motis expose un endpoint `/api/v1/one-to-many` mais — attention au piège — il est documenté pour le **routage rue** (street routing), pas pour le transit. Pour le transit, on appelle `/api/v5/plan` une fois par paire (ou par origine en variant les destinations). Source : [Motis OpenAPI spec](https://github.com/motis-project/motis/blob/master/openapi.yaml).

```python
import httpx, asyncio
from datetime import datetime

async def plan(client, from_coords, to_coords, t):
    r = await client.get('http://localhost:8080/api/v5/plan', params={
        'fromPlace': f'{from_coords[1]},{from_coords[0]}',
        'toPlace':   f'{to_coords[1]},{to_coords[0]}',
        'time':      t.isoformat(),
        'transitModes': 'RAIL',
        'maxTransfers': 3,
        'numItineraries': 1,
    })
    j = r.json()
    if not j['itineraries']:
        return None
    it = j['itineraries'][0]
    transfers = sum(1 for leg in it['legs'] if leg['mode'] != 'WALK') - 1
    return it['duration'], transfers

# Paralléliser N×N appels avec asyncio + semaphore
```

---

## 7. Motis vs lecture directe des GTFS

La dernière question de l'utilisateur : pourquoi passer par Motis plutôt que de lire les `.txt` du GTFS directement et écrire l'algo soi-même ?

Réponses ordonnées par importance :

### 7.1 Les GTFS ne sont pas conçus pour le routage

Le GTFS est un format de **publication** d'horaires (`stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, `transfers.txt`, ...). Pour faire du routage efficace, il faut le transformer en structures de données très différentes :

- Indexer les `stop_times` par stop et par trip, dans l'ordre temporel.
- Convertir tous les horaires en UTC en tenant compte des transitions été/hiver (un trip qui passe minuit lors du changement d'heure devient plusieurs trips dans la représentation runtime). Source : [nigiri README — UTC conversion](https://github.com/motis-project/nigiri).
- Reconstituer les "routes" au sens RAPTOR (séquences de stops avec un ordre identique partagé par plusieurs trips), qui ne correspondent **pas** aux `route_id` du GTFS.
- Gérer les `stay-seated` transfers (changement de numéro de train sans descendre — Motis concatène ces trips en un seul transport).
- Fusionner les arrêts spatialement proches (la "Gare de Lyon" est souvent éclatée en 5-10 stops entre métro/RER/grandes lignes).

Faire ça à la main pour la France entière, en gérant correctement les cas limites de calendrier (jours d'exception, périodes de validité multiples, services additionnels), c'est plusieurs semaines de travail. Et encore : ce qu'on vient de coder, c'est le préprocessing nigiri à 80 %.

### 7.2 Les algorithmes corrects sont non triviaux

Au-delà du préprocessing : RAPTOR, CSA (Connection Scan Algorithm), Trip-Based, Transfer Patterns... chacun a ses subtilités (Pareto multi-critère, gestion correcte des footpaths, élagage des dominations). Implémenter RAPTOR proprement à partir du papier reste un travail sérieux. Source : [Connection Scan Algorithm — Dibbelt et al. (PDF)](https://arxiv.org/pdf/1703.05997).

### 7.3 La maintenance, le multimodal, le temps réel

Une fois la matrice gare-à-gare obtenue, l'envie suivante est d'ajouter le rabattement à vélo : "quelles falaises sont à X minutes d'une gare atteignable en Y minutes depuis chez moi ?". Ça implique un routeur de rue + un fusionneur transit/rue. Motis fait les deux, plus le temps réel via GTFS-RT, plus le géocodage. Réimplémenter, c'est multiplier les semaines.

### 7.4 Quand lire les GTFS direct se justifie

Il y a des cas où Motis est overkill :

- **Statistiques sur l'offre théorique** : combien de trains par jour entre A et B, à quelle fréquence ? Là on lit directement `stop_times.txt` filtré par `trip_id` et c'est plus simple.
- **Analyse d'un feed unique sur une question ad-hoc** : la librairie [gtfs-kit](https://github.com/mrcagney/gtfs_kit) en Python ou [r5r](https://ipeagit.github.io/r5r/) en R sont des bons compagnons.
- **Routage approché** : si on accepte de raisonner sur des fréquences moyennes (avec un calcul du type "temps de trajet + 0.5 × headway"), une représentation graphe + Dijkstra peut suffire. C'est le modèle "frequency-based" qui sous-tend une partie de l'analyse d'accessibilité urbaine académique.

Mais dès qu'on veut **des temps de trajet exacts à l'horaire**, ou qu'on veut industrialiser sur tout un pays, Motis (ou OTP, ou r5) est le bon outil. Le coût d'apprentissage est concentré dans l'écriture du `config.yml` et la récupération des feeds — deux heures de travail.

---

## 8. Départ depuis une ville à plusieurs gares (Paris, Lyon…)

Question naturelle : pour la matrice OD, doit-on traiter chaque gare individuellement, ou peut-on raisonner au niveau **ville** (Lyon Part-Dieu + Perrache + Jean-Macé + Vaise…) et laisser Motis choisir la meilleure ?

Les deux approches existent, avec des compromis différents.

### Approche 1 : requête par coordonnées (Motis choisit la gare)

Si on appelle `/api/v5/plan` avec `fromPlace=lat,lon` (les coordonnées du centre de Lyon) **et que OSM est chargé**, Motis fait ce qu'il appelle de l'*offset computation* : il calcule en amont, pour chaque point géographique, les distances à pied (ou à vélo, ou en voiture) vers les arrêts de transit voisins, dans un rayon configurable. Source : [DeepWiki — Motis routing architecture](https://deepwiki.com/motis-project/motis).

```
            coordonnée Lyon centre
                     │
        offset computation (OSM walking)
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
   Part-Dieu     Perrache      Jean-Macé
   (12 min)     (15 min)      (8 min)
       │             │             │
       └───── RAPTOR depuis chaque ─────┐
                                        ▼
                              Pareto-front d'itinéraires
                              (le meilleur compromis gagne)
```

Chacune de ces gares devient un point de départ candidat pour RAPTOR, avec son temps d'accès propre ajouté à l'arrivée. Le moteur choisit naturellement la combinaison qui minimise (temps total, nombre de correspondances). Si prendre Perrache (15 min de marche) permet d'attraper un TGV plus rapide que Part-Dieu, Motis le verra.

Côté API :

```bash
curl 'http://localhost:8080/api/v5/plan' \
  --data-urlencode 'fromPlace=4.8357,45.7640' \
  --data-urlencode 'toPlace=2.3522,48.8566' \
  --data-urlencode 'time=2026-05-17T08:00:00+02:00' \
  --data-urlencode 'transitModes=RAIL' \
  --data-urlencode 'accessModes=WALK' \
  --data-urlencode 'maxPreTransitTime=1200'  # 20 min de marche max
```

Paramètres clés à connaître :

- `accessModes` / `egressModes` : modes pour le rabattement (`WALK`, `BIKE`, `CAR`, combinaisons).
- `maxPreTransitTime` / `maxPostTransitTime` : plafond du rabattement, en secondes. Important : ce plafond définit le rayon de recherche des gares candidates.
- `maxMatchingDistance` (paramètre de configuration de Motis) : la distance max OSM-vers-stop, par défaut 200 m.

**Avantages** : ergonomique pour l'utilisateur final, ne nécessite pas de connaître les `stop_id`. **Inconvénients** : nécessite OSM, coût de calcul plus élevé par requête (l'offset computation s'ajoute à RAPTOR), et le résultat est sensible au point géographique exact choisi pour représenter "Lyon".

### Approche 2 : utiliser `parent_station` du GTFS

Le format GTFS définit une **hiérarchie d'arrêts** via `location_type` et `parent_station` (référence : [gtfs.org/schedule/reference/#stopstxt](https://gtfs.org/schedule/reference/#stopstxt)) :

- `location_type=0` : un quai/arrêt physique
- `location_type=1` : une **gare** (station parent qui regroupe ses quais)
- `parent_station` : référence du parent

Dans le GTFS SNCF, "Paris-Gare-de-Lyon" est une station (`location_type=1`) qui contient des quais grandes lignes, banlieue et accès RER. Pour grouper "Lyon, toutes gares confondues", il n'y a en revanche **pas de parent commun standard** entre Part-Dieu et Perrache — ce sont deux stations distinctes côté GTFS, parce qu'elles sont à 2 km l'une de l'autre.

**Conséquence pratique** : `parent_station` règle le cas des plusieurs quais dans une même gare (et Motis le sait : un changement quai-à-quai dans la même station n'est pas compté comme une correspondance), mais pas le cas du **groupement multi-gares d'une même ville**.

### Approche 3 : pré-agréger côté requête (recommandé pour la matrice OD)

Pour une matrice OD ville → ville, la solution la plus propre est de **pré-grouper soi-même** les stations en "ensembles ville", puis pour chaque paire (Ville A, Ville B) :

1. Lister les gares de A et de B.
2. Lancer un RAPTOR `/plan` par couple (gare_A_i, gare_B_j) — ou exploiter l'extension *many-to-many* de RAPTOR via une seule passe par origine (voir section 6).
3. Garder le **minimum** sur toutes les combinaisons.

```python
def city_to_city(stations_a, stations_b, t):
    best = None
    for a in stations_a:
        for b in stations_b:
            r = plan(a, b, t, transitModes='RAIL')
            if r and (best is None or r['duration'] < best['duration']):
                best = r
    return best
```

Avantages : déterministe, pas besoin d'OSM, on contrôle exactement la définition de "ville". Inconvénients : il faut soi-même produire le mapping gare → ville (un join sur le code INSEE de la commune contenant la gare est suffisant, via les coordonnées des stops et un shapefile communal IGN/OpenStreetMap).

Pour la matrice complète : si la France a ~3 000 gares mais ~150 villes ferroviaires significatives, la matrice OD ville → ville devient un objet de 22 500 paires — beaucoup plus exploitable côté UX que les 9 millions de paires gare → gare.

### Que choisir ?

- **Affichage utilisateur final** (saisie d'une ville) → approche 1, avec OSM chargé.
- **Calcul batch d'une matrice OD agrégée par ville** → approche 3, sans OSM nécessaire, sans dépendance à un point géographique arbitraire.
- **Affichage gare précise** (le contexte de velogrimpe : on connaît la gare proche de la falaise) → ni l'un ni l'autre, on travaille directement en `stop_id`.

---

## 9. Recette complète pour la matrice gare-à-gare France

En synthèse, le pipeline qui marche :

```
1. Récupérer france.osm.pbf depuis geofabrik.de
2. Lister les feeds GTFS via l'API du PAN
3. Télécharger les zips (en priorité SNCF national + IDFM + grandes métropoles)
4. ./motis config france.osm.pbf *.zip
5. ./motis import
6. ./motis server &
7. Lister les ~3000 stop_id "gare" (filtrer dans les GTFS sur location_type=1
   et vehicle_type rail, ou sur regex du nom)
8. Pour chaque paire (gare_i, gare_j) :
     appeler /api/v5/plan avec maxTransfers=3, transitModes=RAIL
     extraire (duration, transfers) du premier itinerary
9. Stocker en CSR ou en parquet → matrice ~3000×3000
```

Quelques optimisations utiles :

- **Paralléliser** les appels HTTP avec `asyncio` + `httpx` (Motis encaisse 50+ requêtes simultanées sans broncher).
- **Fixer une heure de référence** raisonnable (mardi 8h en pleine semaine d'octobre) et accepter que la matrice soit "pour cette heure-là". Pour une matrice multi-périodes, refaire le calcul à 14h et à 18h.
- **Borner `maxTravelTime`** à 8 heures pour élaguer les paires absurdes (Lille-Hendaye via 4 correspondances).
- **Borner `maxTransfers`** à 3 : au-delà, le confort utilisateur s'effondre et le nombre de paires concernées est marginal.

---

## 10. Pour aller plus loin

- [Motis OpenAPI spec](https://github.com/motis-project/motis/blob/master/openapi.yaml) — la référence pour tous les endpoints, paramètres et formats.
- [nigiri README](https://github.com/motis-project/nigiri) — le détail du préprocessing GTFS → représentation interne.
- [transitous.org/api](https://transitous.org/api/) — instance Motis publique avec couverture multi-pays, utile pour prototyper sans installer.
- [Round-Based Public Transit Routing — Delling, Pajor, Werneck 2012 (PDF)](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf) — le papier RAPTOR original.
- [Connection Scan Algorithm — Dibbelt et al. (PDF)](https://arxiv.org/pdf/1703.05997) — l'alternative à RAPTOR, plus simple et compétitive sur petits réseaux.
- [UnLimited TRAnsfers — Phan et Wagner 2019 (PDF)](https://arxiv.org/pdf/1906.04832) — extensions multimodales modernes.
- [r5r — Findings 2023](https://findingspress.org/article/21262-r5r-rapid-realistic-routing-on-multimodal-transport-networks-with-r-5-in-r) — l'alternative R/Java optimisée pour les matrices.
- [Min-plus matrix multiplication — Wikipedia](https://en.wikipedia.org/wiki/Min-plus_matrix_multiplication) — le cadre algébrique général dont min-plus est un cas particulier.

La leçon générale : l'intuition matricielle est correcte pour les graphes statiques (réseaux routiers avec temps fixe par arête), mais elle s'effondre dès qu'on introduit la dimension temporelle des horaires. Le bon outil pour ce problème existe depuis 2012, est implémenté dans Motis, et tient en une demi-journée d'installation.
