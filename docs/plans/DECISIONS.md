# Décisions structurelles

Chaque décision est une section numérotée `DXXX`, avec une brève justification.

## D001 — L'extension d'un fichier téléversé est déduite de son contenu, jamais de son nom

`uploadImage()` (`api/add_falaise.php`) détermine l'extension de destination avec `getimagesize()`, et
non plus avec `pathinfo($_FILES[...]['name'], PATHINFO_EXTENSION)`.

**Pourquoi :** c'est la faille exploitée en juillet 2026 pour déposer un webshell (voir
`docs/incident-2026-07-29-compromission.md`). Une liste blanche d'extensions comparée au nom fourni par
le client reste une logique de refus, qui se contourne dès qu'une variante d'extension est oubliée
(`.phtml`, `.php7`, double extension, casse). Déduire l'extension du type réel est une logique
d'autorisation : aucune entrée cliente n'atteint plus le nom du fichier écrit.

À appliquer à tout nouveau point de téléversement.

## D002 — Les slugs qui composent un nom de fichier sont validés, pas reformatés

`falaise_nomformate` est rejeté s'il ne correspond pas à `^[a-z0-9-]{1,255}$`, au lieu d'être assaini
silencieusement côté serveur.

**Pourquoi :** ce champ est stocké en base _et_ utilisé comme nom de fichier, et `falaise.php`
reconstruit le chemin des images depuis la valeur en base. Un assainissement côté serveur produirait un
nom de fichier différent de celui que la base laisse attendre : les images disparaîtraient sans erreur
visible. Rejeter est le seul comportement qui garde la base et le disque cohérents. Le formulaire
produit déjà exactement cette forme (`formatNomFalaise()`), la validation est donc transparente pour les
contributeurs.

Appliqué de la même façon à `velo_depart`, `velo_arrivee` et `velo_varianteformate` dans
`api/add_velo.php`, qui composent le nom du fichier GPX : `falaise.php:835` et le helper `gpx_path()`
côté JS reconstruisent ce chemin depuis la base.

## D003 — Les dossiers de données n'exécutent aucun script, indépendamment de la validation d'upload

`public_html/bdd/.htaccess` refuse de servir les extensions exécutables et coupe l'interpréteur PHP.

**Pourquoi :** défense en profondeur. La validation d'upload (D001) et ce blocage traitent le même risque
par deux mécanismes indépendants ; il faut que les deux échouent pour qu'un fichier déposé devienne
exécutable. Le blocage protège aussi les points d'écriture non encore durcis (`add_velo.php`,
`falaise_details.php`) et les fichiers déjà présents sur le serveur.

`php_flag` est encadré par `<IfModule>` : hors mod_php (PHP-FPM), la directive provoque une erreur 500
sur tout le dossier, ce qui ferait disparaître les images du site. La barrière portable est donc
`<FilesMatch>` + `Require all denied`, `php_flag` n'étant qu'un renfort. Les deux syntaxes
d'autorisation (2.4 et 2.2) sont présentes car le `.htaccess` parent utilise encore `Allow from all`.

## D004 — Les dossiers servis par le web ne contiennent que des données inertes

Corollaire de D003 : tout nouveau dossier destiné à recevoir des contenus téléversés ou générés doit
hériter d'un blocage équivalent, ou être placé hors du webroot et servi par un script PHP dédié (comme
`open-data/download.php` le fait déjà pour les exports).

## D005 — Les formulaires de contribution restent publics ; on durcit les données, pas l'accès

`api/add_velo.php` et `api/add_falaise.php` ont été durcis sans y ajouter d'authentification.

**Pourquoi :** ce sont les formulaires de contribution décrits sur `contribuer.php` (« ajouter une
falaise », « ajouter un itinéraire »). Exiger un token supprimerait la contribution ouverte, qui est la
raison d'être du site. La sécurité doit donc porter sur ce que ces endpoints _écrivent_ — type réel des
fichiers, forme des noms, plafonds de taille — et non sur qui les appelle.

Corollaire : un endpoint public d'écriture doit être conçu en supposant l'appelant hostile. Toute
donnée entrante qui finit dans un nom de fichier, un chemin, du HTML rendu ou une requête SQL est
validée explicitement.

## D006 — Un endpoint privé répond 401 sans authentification et 403 sur token invalide

Appliqué à `api/private/falaises.php` ; à généraliser aux autres endpoints `/api/private/*`, qui
répondent aujourd'hui 403 dans les deux cas.

**Pourquoi :** la distinction est celle de HTTP. 401 signifie « je ne sais pas qui tu es, authentifie-toi »
et s'accompagne de `WWW-Authenticate` ; 403 signifie « je sais qui tu es, et c'est refusé ». Elle rend les
erreurs d'intégration diagnosticables — un token absent et un token périmé ne se corrigent pas de la même
façon — sans rien révéler d'exploitable.

Deux règles associées : l'authentification passe **avant** le contrôle de méthode, pour qu'un appelant non
authentifié n'apprenne pas quels verbes l'endpoint accepte ; et la comparaison des tokens utilise
`hash_equals()`, à temps constant, ce qui écarte aussi le piège des comparaisons `==` lâches.

Le préflight `OPTIONS` reste toujours ouvert : il précède l'envoi de l'en-tête `Authorization` par le
navigateur, le protéger casserait le CORS.

## D007 — Aucun secret dans un fichier versionné, fichiers de test compris

Le dépôt est public. `config.php` est git-ignoré ; la même exigence s'applique aux fichiers de test, qui
référencent les tokens via un fichier d'environnement non versionné (`Authorization: Bearer {{token}}`),
jamais par leur valeur.

**Pourquoi :** un fichier de test est un fichier versionné comme un autre. Les clients `.http` de VS Code
et de JetBrains lisent des fichiers d'environnement, il n'y a donc aucune raison d'y écrire une valeur en
clair.

Corollaire opérationnel : un secret committé dans un dépôt public est **définitivement brûlé**. Réécrire
l'historique est une mesure d'hygiène, pas une remédiation — seule la rotation ferme la porte.

## D008 — Un itinéraire vélo s'édite par `velo_id`, et ses champs qui composent le nom du fichier GPX ne sont pas éditables

La page `ajout/edit_velo.php` identifie la variante par `velo_id` (et non par le triplet gare / falaise /
slug de variante), et `api/edit_velo.php` ne modifie que `velo_km`, `velo_dplus`, `velo_dmoins` et,
optionnellement, le contenu du fichier GPX. `velo_depart`, `velo_arrivee` et `velo_varianteformate`
restent tels qu'en base.

**Pourquoi :** le nom du fichier GPX est reconstruit depuis ces trois champs et `velo_id`
(`falaise.php`, `gpx_path()` côté JS, cf. D002). Ne pas les toucher garantit que le fichier remplacé est
exactement celui que le site sert déjà, sans renommage ni orphelin sur le disque. `velo_id` est de plus
le seul identifiant stable : plusieurs variantes d'un même couple gare / falaise peuvent avoir un slug
vide. Le jour où le renommage de variante devient nécessaire, il devra déplacer le fichier dans la même
transaction logique que la mise à jour SQL.

## D009 — Le code de validation / nettoyage d'un GPX est partagé entre ajout et édition

`lib/velo_lib.php` porte la lecture des indicateurs, la validation des slugs et le chargement /
nettoyage du GPX téléversé ; `api/add_velo.php` et `api/edit_velo.php` l'utilisent tous deux.

**Pourquoi :** les contrôles de sécurité ajoutés en juillet 2026 (plafond de taille, `LIBXML_NONET`,
racine `<gpx>`, slugs) ne doivent exister qu'à un seul endroit, sinon le second point d'écriture finira
par diverger du premier — c'est exactement le scénario qui a conduit à l'incident.

## D010 — Un itinéraire vélo validé ne se modifie pas directement : les contributeurs suggèrent, les admins appliquent

`api/edit_velo.php` distingue trois cas. Admin (token) : tout est appliqué et l'itinéraire passe
`velo_public = 1`. Contributeur sur un itinéraire non validé (`velo_public ≠ 1`) : les modifications sont
appliquées, un mail aux admins porte un lien de validation (`api/private/accept_velo.php`, même principe
que `accept_falaise.php`). Contributeur sur un itinéraire validé : rien n'est écrit ; la description
proposée et le GPX sont envoyés aux admins en suggestion, et le formulaire désactive les indicateurs.

**Pourquoi :** les itinéraires validés sont ceux du topo, déjà vérifiés sur le terrain ; une écriture
directe et anonyme y ferait régresser une donnée relue. La contribution reste ouverte (D005) mais passe
par une relecture. Le lien Openrunner est réservé aux admins dans tous les cas : c'est une URL rendue
dans une `<iframe>`, on ne laisse pas un formulaire public en choisir la source.

Deux règles associées. Le GPX joint au mail de suggestion est **ré-sérialisé depuis le DOM nettoyé**
(`velo_charger_gpx_upload()`), jamais le fichier reçu : seul un XML GPX validé, sans `<wpt>`, part en
pièce jointe. Et avant tout remplacement de trace, l'ancienne est copiée dans `bdd/gpx-historique/`
(comme `bdd/barres-historique/` pour les GeoJSON), pour pouvoir revenir en arrière après une mauvaise
contribution.
