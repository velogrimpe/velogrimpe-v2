# Tests API — PHPUnit

Tests d'intégration HTTP contre le conteneur Docker `velogrimpe` (cf. CLAUDE.md
« Development »). Deux familles de tests, avec des stratégies de données
différentes :

1. **Tests d'endpoint** (ex. `AddBusTest`, `LinkBusFalaiseTest`,
   `AddVeloTest`, `AddAccesTest`) : chaque test crée ses propres fixtures en base (falaise,
   arrêt, gare…) — ou s'appuie sur les entités témoins existantes (cf.
   `ApiTestCase::WITNESS_*`) quand le comportement testé doit s'exercer dans
   un contexte réel (jointures déjà peuplées) plutôt qu'un contexte minimal —
   appelle l'endpoint réel via HTTP, vérifie la réponse JSON et l'état DB,
   puis nettoie ce qu'il a créé.
2. **Tests de non-régression sur les pages** (`CartePageDataTest`,
   `TableauPageDataTest`, `FalaisePageDataTest`) : ne créent aucune fixture,
   ne testent pas le rendu (pas de navigateur) — ils récupèrent le HTML de
   `carte.php`/`tableau.php`/`falaise.php` via HTTP, extraient les données
   JSON qui y sont embarquées pour le JS/Vue (cf. `ApiTestCase::extractJsValue()`),
   et vérifient leur intégrité relationnelle (itinéraire relié à une gare et
   une falaise qui existent bien, gare non orpheline/supprimée, coordonnées
   exploitables) en utilisant les **données réelles existantes comme témoin**
   plutôt que des fixtures synthétiques — cf. `ApiTestCase::WITNESS_FALAISE_ID`
   / `WITNESS_GARE_ID` / `WITNESS_VILLE_ID`, qui reprennent les mêmes ids que
   `tests/e2e` (falaise "Pont de Barret", ville de Lyon). Si `db_backup.sql`
   est régénéré et que ces ids ne correspondent plus aux mêmes entités, ces
   trois constantes sont le seul endroit à mettre à jour.

   `FalaisePageDataTest` surveille en plus trois falaises témoins couvrant
   chacune une configuration d'accès particulière (cf.
   `ApiTestCase::WITNESS_FALAISE_HOSTIAZ_ID` / `_VIRIEU_ID` / `_CONTREVOZ_ID`) :
   Hostiaz (accès piéton uniquement + accès vélo depuis la même gare), Virieu
   le Grand (accès vélo faisable aussi à pied) et Contrevoz (accès vélo depuis
   deux gares différentes).

## Pré-requis

- Le conteneur `velogrimpe` doit tourner (`docker ps`) et répondre sur
  `http://localhost:4000`.
- `composer install` à la racine du dépôt (une seule fois).

Le port MySQL du conteneur n'est pas exposé à l'hôte (seuls 80 et 22 le sont,
cf. `docker run` dans CLAUDE.md) : l'accès DB depuis les tests passe par
`docker exec velogrimpe /opt/lampp/bin/mysql -uroot …`, comme `db_init.sql` /
`db_backup.sql`. Pas de connexion mysqli directe depuis l'hôte.

## Lancer les tests

```bash
composer test
# ou directement :
./vendor/bin/phpunit
```

## Fixtures et nettoyage

Toute ligne créée par un test porte `contrib = 'phpunit'` (ou un nom préfixé
`PHPUnit `) pour rester identifiable. `ApiTestCase` (`tests/api/ApiTestCase.php`)
fournit :

- `httpGet()` / `httpPostJson()` / `httpPostMultipart()` — requêtes contre le conteneur (JSON ou formulaire multipart à l'ancienne, type `add_velo.php`)
- `dbExec()` / `dbQuery()` / `dbQueryOne()` / `dbInsert()` — requêtes SQL via `docker exec`
- `createFixtureFalaise()` / `createFixtureArret()` — fixtures courantes, nettoyées automatiquement
- `createFixtureAcces()` / `createFixtureAccesPied()` — accès arrêt → falaise (`acces_falaise`, vélo ou pied). La table n'a pas de `ON DELETE CASCADE` : les fixtures falaise et arrêt purgent d'elles-mêmes les accès qui les référencent, y compris ceux créés via l'API pendant le test
- `cleanupOnTearDown($sql)` / `cleanupCallbackOnTearDown($fn)` / `registerFixtureArret($id)` — nettoyage manuel (SQL ou autre, ex. fichier GPX) pour les cas non couverts par les helpers ci-dessus
- `extractJsValue($html, $marker)` — extrait un JSON embarqué dans une réponse HTML après un marqueur (ex. `'const falaisesBase = '`), par appariement de profondeur plutôt que regex gourmande (robuste aux valeurs texte contenant `];`/`};`)

Ces tests couvrent aujourd'hui les endpoints bus (`add_arret.php`, `fetch_arret.php`,
`fetch_arrets.php`, `link_arret_falaise.php`, cf. `docs/conception-bus.md`)
et accès vélo/pied (`add_velo.php` en modes `velo` et `pied`, `edit_velo.php`) et lignes BTT (`add_ligne.php`, `fetch_ligne.php`, `fetch_lignes.php`, `delete_ligne.php` — `LigneTransportTest`, Lot 7) : ils serviront de garde-fou
pendant la migration vers la table `arrets` multimodale, et seront adaptés
au fil de l'eau plutôt que réécrits.

Volontairement non couvert : `backfill_gares_geocode.php` (script d'admin ponctuel, pas de valeur ajoutée
à le tester automatiquement — cf. `tests/backfill_gares_geocode.http` pour
un test manuel).

## Mail désactivé pendant la suite

Plusieurs endpoints testés ici (`add_arret.php`, `add_velo.php`,
`link_arret_falaise.php`...) envoient un mail de notification via
`lib/sendmail.php` (Mailgun) — sans coupure, chaque run de la suite enverrait
de vrais mails à `admin_mail`/`contact_mail`. `tests/api/bootstrap.php` pose
un fichier marqueur (`public/tmp/phpunit-disable-mail.flag` — visible du
conteneur car `public/` y est monté en lecture/écriture) au début de la
suite et le supprime à la fin (`register_shutdown_function`, donc même si la
suite plante) ; `sendMail()` le détecte et renvoie `true` sans faire l'appel
réseau. Un fichier plutôt qu'un en-tête HTTP : un en-tête serait un signal
falsifiable par n'importe quel client externe, un fichier ne l'est pas.

Si les mails de dev cessent d'arriver en local en dehors des tests, vérifier
qu'un `public/tmp/phpunit-disable-mail.flag` orphelin n'est pas resté après
un crash de la suite (`kill -9`, par ex.) — le supprimer suffit.

À partir du Lot 2 du plan (`docs/plan-implementation-arrets.md`), tout
nouveau test ici s'écrit en TDD strict : le test avant le code, vérifié rouge
avant d'implémenter.
