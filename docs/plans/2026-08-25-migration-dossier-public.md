# Plan de migration — sortir les contenus téléversés du dossier déployé

**Date** : 2026-08-25
**Statut** : proposé, en attente de validation
**Motif** : depuis la refonte du déploiement Git d'Hostinger, les fichiers déposés
manuellement dans `public_html/images/` disparaissent à chaque déploiement.

## 1. Diagnostic (rappel)

La chaîne de déploiement a deux étages :

1. `.github/workflows/deploy.yml` : `rsync -av --delete public_html/ deploy-repo/`
   vers la branche `deploy` de `velogrimpe/velogrimpe.fr`, puis `git add -A` + push.
2. Hostinger déploie cette branche dans `public_html`.

Le rsync copie `public_html/.gitignore`, qui devient **le `.gitignore` racine de la
branche `deploy`**. Vérifié sur la branche distante (commit `841590e`) : il n'ignore
que des chemins sous `bdd/` — les trois lignes qui couvriraient `images/` sont
commentées.

Conséquence, côté serveur :

| Fichier déposé à la main | Statut dans la branche `deploy` | Sort du déploiement |
| --- | --- | --- |
| `images/grave2026/x.pdf` | non suivi, **non ignoré** | supprimé |
| `bdd/images_falaises/x.jpg` | non suivi, **ignoré** | conservé |
| `bdd/gpx/x.gpx` | non suivi, **ignoré** | conservé |

Le déploiement Hostinger effectue donc un nettoyage du répertoire qui **respecte le
`.gitignore`** (comportement d'un `git clean -fd` sans `-x`, ou d'une synchro
équivalente). `bdd/` n'est pas protégé par une règle d'Hostinger : il est protégé par
la coïncidence entre ses extensions et nos patterns d'ignore. Cette protection tombe
dès qu'Hostinger passe à `clean -fdx`, à un déploiement « dossier neuf + bascule »,
ou dès qu'on dépose dans `bdd/` un fichier d'une extension non couverte (`bdd/trains/x.json`
et `bdd/barres/x.json` sont aujourd'hui **non ignorés**).

## 2. Cible

```
/home/<user>/
├── public/                     ← contenus téléversés et générés, HORS dépôt
│   ├── images_falaises/  images_news/  images_pages/
│   ├── gpx/  barres/  barres-historique/
│   ├── zones/  ca/  trains/  biodiv/  datatourisme/
│   ├── open-data/
│   └── .htaccess               ← aucun exécutable, pas de listing
├── config.php                  ← déjà hors dépôt, même principe
└── public_html/                ← dossier déployé, 100 % versionné
    └── public -> ../public     ← lien symbolique VERSIONNÉ
```

Trois propriétés :

- **Ce qui est déployé est intégralement versionné.** Plus aucun fichier de données ne
  dépend d'un pattern d'ignore pour survivre.
- **Le lien symbolique est suivi par git** : `git clean` ne le touche pas, et un
  `checkout -f` — voire un clone neuf — le recrée. La cible étant hors du dossier
  déployé, elle est structurellement hors d'atteinte de tout changement de
  comportement côté Hostinger.
- **Les noms de dossiers sont conservés** (`bdd/gpx` → `public/gpx`), ce qui rend la
  règle de compatibilité des anciennes URLs un simple échange de préfixe.

### Pourquoi un lien symbolique et pas un `Alias` Apache

`Alias`/`AliasMatch` sont des directives de configuration serveur, **interdites en
`.htaccess`** ; et `mod_rewrite` en `.htaccess` ne peut pas réécrire vers un chemin
filesystem hors du DocumentRoot. Le lien symbolique versionné est le seul mécanisme
qui expose un dossier hors docroot en mutualisé, tout en conservant le service
**statique** — indispensable pour les `.pmtiles` (requêtes HTTP Range) et le cache
long des images.

L'alternative « servir via un script PHP » est écartée : coût PHP sur chaque image,
et gestion manuelle des Range requests pour les pmtiles.

## 3. Inventaire

### 3.1 À déplacer vers `~/public` (données)

| Chemin actuel | Taille | Producteur | Lecteurs |
| --- | --- | --- | --- |
| `bdd/images_falaises/` | 313 Mo | `api/add_falaise.php` (upload public) | `falaise.php` (+ JSON-LD), `ajout/ajout_falaise.php` |
| `bdd/gpx/` | 26 Mo | `api/add_velo.php` | `carte.php`, `carte_maplibre.php`, `js/components/map/velo.js`, `js/components/falaise-details-editor.js`, `falaise.php`, `export_open_data.php` |
| `bdd/barres/`, `bdd/barres-historique/` | 2,8 Mo | `api/private/falaise_details.php` | `export_open_data.php` (+ `details_url` public) |
| `bdd/images_news/`, `bdd/images_pages/` | 270 Ko | `lib/admin_image_upload.php` via `api/private/{newsletter,pages}/upload-image.php` | tables `newsletters` / `pages`, mails déjà envoyés |
| `bdd/zones/*.geojson` | 1,5 Mo | import manuel | `api/geocode.php`, `api/private/batch-geocode.php`, `ajout/ajout_falaise.php` |
| `bdd/ca/*.geojson` | 660 Ko | import manuel | `articles/2025-10-18-…php`, `ajout/falaises_accessibles_a_pied.php` |
| `bdd/trains/*.pmtiles`, `gares.geojson` | 27 Mo | génération externe | `carte_maplibre.php`, `js/components/map/load-vector-tiles.js` |
| `bdd/biodiv/*.pmtiles` | 8,8 Mo | génération externe | idem |
| `bdd/datatourisme/*.pmtiles,*.csv,*.geojson` | 36 Mo | `bdd/datatourisme/extract-campings.js` | idem |
| `open-data/*.geojson` | 52 Mo | cron `api/private/crons/export_open_data.php` | `open-data/download.php` |

Total ≈ 470 Mo, copie locale sur le serveur (pas de transfert réseau).

### 3.2 Qui restent dans le dépôt, dans `public_html`

- `images/` en entier : `icons/`, `map/`, `mw/`, `captures/`, `pages/`, `articles/`,
  `news/`, `grave2026/`, logos — ce sont des assets du site, pas des données.
- `bdd/styles/*.json`, `bdd/trains/gares.json`, `bdd/cartotrain/tableau.xlsx`,
  `bdd/datatourisme/{extract-campings.js,package.json,README.md}`, `bdd/biodiv/README.md`,
  les `.htaccess`.

Deux dossiers deviennent donc mixtes : `bdd/trains/` garde `gares.json` (versionné) et
perd ses `.pmtiles`/`.geojson` ; `bdd/datatourisme/` garde ses scripts et perd ses
sorties. C'est cohérent — la frontière passe entre « entrée versionnée » et « sortie
générée ».

> **À confirmer** : `bdd/cartotrain/tableau.xlsx` est versionné et lu par le cron
> `ingest_cartotrain.php`. S'il t'arrive de le remplacer directement sur le serveur,
> il doit passer dans `~/public` comme les autres données.

### 3.3 À arbitrer un par un (phase 5)

Les fichiers présents sur le serveur et absents de la branche `deploy` : ce sont eux
qui disparaissent. Ils se répartissent en deux catégories, à trancher à l'unité :
asset du site → à committer ; donnée → à déplacer dans `~/public`.

## 4. Phases

### Phase 0 — Vérification préalable (bloquante)

Rien ne bouge avant d'avoir prouvé les deux hypothèses. En SSH :

```bash
# a) Établir ce que fait réellement le déploiement Hostinger
ls -la ~/public_html/.git 2>/dev/null && git -C ~/public_html status --porcelain --ignored | head
git -C ~/public_html log --oneline -3          # confirme la mécanique (checkout local ?)
# + relire le log de déploiement dans hPanel

# b) Préparer la cible
mkdir -p ~/public && chmod 755 ~/public
echo ok > ~/public/ping.txt
printf '<?php echo "EXEC";' > ~/public/probe.php
```

Puis, dans un commit dédié :

```bash
ln -s ../public public_html/public
git add public_html/public && git commit   # doit apparaître en mode 120000
```

Après déploiement, les cinq contrôles :

1. `curl -I https://velogrimpe.fr/public/ping.txt` → **200** (lien suivi).
   Si **403/404** : ajouter `Options +FollowSymLinks` dans `public_html/.htaccess`
   (attention, 500 si `AllowOverride Options` est refusé → voir repli).
2. `curl https://velogrimpe.fr/public/probe.php` → **403**, jamais `EXEC`.
3. Redéclencher un déploiement, puis `curl .../public/ping.txt` → toujours **200**
   (le contenu hors dossier déployé est intact).
4. `ls -la ~/public_html/public` → toujours un lien symbolique après déploiement
   (le rsync du workflow utilise `-a`, donc `-l` : il ne doit **jamais** passer à
   `-aL` / `--copy-links`).
5. Un `.pmtiles` de test servi depuis `~/public` répond bien à
   `curl -H 'Range: bytes=0-99' -I` → **206**.

**Repli si le lien symbolique n'est pas suivi** : un vrai dossier
`public_html/public/`, créé une fois à la main sur le serveur et **ignoré
explicitement** dans `public_html/.gitignore`. C'est le mécanisme qui protège `bdd/`
aujourd'hui — il fonctionne, mais il reste à la merci d'un `clean -fdx`. À n'adopter
que si le lien échoue, et à documenter comme dette.

### Phase 1 — Socle, sans déplacer de données

1. **`public_html/lib/paths.php`** — source unique de vérité :

   ```php
   const VG_DATA_URL = '/public';

   function vg_data_path(string $rel = ''): string   // filesystem, via DOCUMENT_ROOT
   function vg_data_url(string $rel): string         // URL publique
   function vg_data_realpath(string $rel): ?string   // null si sortie du dossier
   ```

   Base filesystem = `$_SERVER['DOCUMENT_ROOT'] . '/public'`, donc identique en dev et
   en prod et traversant le lien symbolique.

   > **Piège à éviter** : ne jamais faire `str_replace(DOCUMENT_ROOT, '', realpath($p))`
   > sur un chemin de données. À travers le lien, `realpath()` renvoie
   > `/home/<user>/public/…`, qui n'est **pas** sous `DOCUMENT_ROOT`. Les contrôles
   > d'évasion de dossier doivent comparer à `realpath(vg_data_path())`, ce que fait
   > `vg_data_realpath()`. `api/add_falaise.php` fait aujourd'hui un `realpath()` sur
   > `'../bdd/images_falaises/'` : c'est exactement le point à reprendre.

2. **`public_html/.htaccess`** — à insérer juste après la redirection canonique :

   ```apache
   # --- Contenus téléversés / générés (cf. D008) --------------------------------
   # /public est un lien symbolique versionné vers ~/public. La cible est hors du
   # dossier déployé : aucun déploiement ne peut l'effacer.

   # Aucun exécutable servi sous /public. Règle placée ici et pas seulement dans
   # ~/public/.htaccess : derrière un lien symbolique hors DocumentRoot, un
   # .htaccess peut être ignoré selon la configuration d'AllowOverride.
   RewriteRule ^public/.*\.(php|phar|phtml|php[0-9]|phps|pht|inc|shtml|cgi|pl|py|rb|sh|lua)$ - [F,L,NC]

   # Compatibilité des anciennes URLs /bdd/*, à conserver INDÉFINIMENT : elles sont
   # dans des newsletters déjà envoyées, dans des exports open data déjà
   # téléchargés (gpx_url, details_url) et dans l'index des moteurs.
   RewriteRule ^bdd/(images_falaises|images_news|images_pages|gpx|barres|barres-historique|ca|zones|biodiv|datatourisme)/(.*)$ /public/$1/$2 [L]
   RewriteRule ^bdd/trains/(.+\.(?:pmtiles|geojson))$ /public/trains/$1 [L]
   ```

   La règle `[F]` est placée **avant** les règles de compatibilité : une réécriture
   interne relance le jeu de règles, donc une URL `/bdd/…/x.php` est bloquée aussi.
   Les `<FilesMatch>` existants (`Content-Disposition` sur `.gpx`, `ForceType` sur
   `.geojson`, cache long sur les images) s'appliquent aux fichiers servis sous
   `/public` puisqu'ils sont déclarés dans le `.htaccess` parent : comportement
   inchangé.

3. **`deploy/public-htaccess`** (versionné, installé une fois à la main dans
   `~/public/.htaccess`) : reprise du durcissement de `bdd/.htaccess` — `FilesMatch`
   + `Require all denied`, `php_flag engine off` sous `<IfModule>`, `Options -Indexes`.
   Défense en profondeur ; la barrière garantie reste la règle `[F]` ci-dessus.

4. **`deploy/bootstrap-public.sh`** : script idempotent de création de `~/public`,
   de ses sous-dossiers et de son `.htaccess`. Documente le setup serveur, à rejouer
   en cas de changement d'hébergement.

5. **`.gitignore` racine** : ajouter `/public/` (dossier de dev local).

6. **Dev local** : le lien `public_html/public -> ../public` pointe hors du volume
   monté. Monter le dossier de données à côté, exactement comme `config.php` :

   ```bash
   -v $PWD/public:/opt/lampp/public
   ```

   (`/opt/lampp/htdocs/public` → `../public` → `/opt/lampp/public`). À reporter dans
   `CLAUDE.md` et le `README.md` — la commande docker documentée y est de toute façon
   à rafraîchir depuis le passage en v2.

### Phase 2 — Bascule des lectures/écritures serveur

Passage à `vg_data_path()` / `vg_data_url()`, sans rien déplacer encore (les deux
arborescences coexistent le temps de la phase 3) :

| Fichier | Lignes | Nature |
| --- | --- | --- |
| `api/add_falaise.php` | 362 | écriture images falaises (+ reprise du `realpath`) |
| `api/add_velo.php` | 136 | écriture GPX |
| `api/private/falaise_details.php` | 261, 320 | écriture barres + historique |
| `lib/admin_image_upload.php` | 74, 93 | préfixe URL explicite au lieu du `str_replace(DOCUMENT_ROOT…)` dérivé |
| `api/private/newsletter/upload-image.php` | 4 | base dir |
| `api/private/pages/upload-image.php` | 4 | base dir |
| `api/geocode.php` | 19-20 | lecture zones |
| `api/private/batch-geocode.php` | 39-40 | lecture zones |
| `api/private/crons/export_open_data.php` | 244, 400 | lectures gpx / barres |
| `api/private/crons/export_open_data.php` | 259, 402 | **URLs publiées** dans les exports (`gpx_url`, `details_url`) |
| `api/private/crons/export_open_data.php` | 499-541 | écritures des 5 exports |
| `open-data/download.php` | 29 | lecture des exports |
| `falaise.php` | 240-241 | `file_exists()` + URL JSON-LD |

Les URLs `/open-data/*.geojson` documentées dans `infos.php` **ne changent pas** :
elles passent par la réécriture interne vers `download.php`, seul le chemin de lecture
bouge. En revanche `gpx_url` et `details_url` **à l'intérieur** des exports passent en
`/public/…` : les anciennes valeurs déjà diffusées restent servies par la règle de
compatibilité.

Écrire un `.http` de non-régression par endpoint d'upload touché
(`tests/add_falaise.http`, `tests/add_velo.http` couvrent déjà les cas de sécurité :
y ajouter les nouveaux chemins et garder les assertions sur `.php` non exécutable).

### Phase 3 — Déplacement des données sur le serveur

Copie d'abord, suppression seulement après validation. Le site continue de fonctionner
sur les anciens chemins pendant toute la copie.

```bash
cd ~
bash deploy/bootstrap-public.sh                  # crée l'arborescence + .htaccess

for d in images_falaises images_news images_pages gpx barres barres-historique \
         zones ca trains biodiv datatourisme; do
  rsync -a --info=stats2 public_html/bdd/$d/ public/$d/
done
rsync -a public_html/open-data/ public/open-data/
rm -f public/open-data/download.php public/open-data/.gitignore   # code, pas données

# Contrôle avant bascule
for d in images_falaises gpx barres trains open-data; do
  echo "$d  src=$(find public_html/bdd/$d -type f 2>/dev/null | wc -l)  dst=$(find public/$d -type f | wc -l)"
done
du -sh public
```

Puis : déployer la phase 2, vérifier le site (fiche falaise avec photos, carte
Leaflet + MapLibre, tuiles pmtiles, téléchargement open data, formulaire d'ajout de
falaise et d'itinéraire en bout en bout), **et seulement ensuite** supprimer les
sources. Rollback = revert du déploiement ; les données sont intactes aux deux
endroits.

Ne pas oublier de conserver dans `public_html/bdd/` les fichiers versionnés :
`styles/`, `trains/gares.json`, `cartotrain/tableau.xlsx`, les scripts
`datatourisme/`, les `README.md`, le `.htaccess`.

### Phase 4 — Réécriture des liens

**Code** — 20 occurrences d'URLs `/bdd/…` en dur :

- `carte.php:232`, `carte_maplibre.php:630,1040,1050,1083,1115,1153`
- `falaise.php:240,835,906,923,941`
- `js/components/map/velo.js:66`, `js/components/map/load-vector-tiles.js:12,57,233,258,321,364`
- `js/components/falaise-details-editor.js:207`
- `ajout/ajout_falaise.php:449,1084-1086` (dont trois URLs absolues en `https://www.velogrimpe.fr/…`)
- `ajout/falaises_accessibles_a_pied.php:120`
- `articles/2025-10-18-falaises-prioritaires-velogrimpe.php:155`

**Base de données** — d'abord découvrir, ensuite remplacer :

```sql
-- Découverte : toute colonne texte contenant '/bdd/'
SELECT 'newsletters' t, COUNT(*) FROM newsletters WHERE sections LIKE '%/bdd/%' OR description LIKE '%/bdd/%'
UNION ALL SELECT 'pages', COUNT(*) FROM pages
  WHERE sections LIKE '%/bdd/%' OR banner_img LIKE '%/bdd/%' OR description LIKE '%/bdd/%';

-- Remplacement (après dump de sécurité)
UPDATE newsletters SET sections   = REPLACE(sections, '/bdd/images_', '/public/images_'),
                       description= REPLACE(description, '/bdd/images_', '/public/images_');
UPDATE pages SET sections   = REPLACE(sections, '/bdd/images_', '/public/images_'),
                 banner_img = REPLACE(banner_img, '/bdd/images_', '/public/images_'),
                 description= REPLACE(description, '/bdd/images_', '/public/images_');
```

Étendre la découverte aux autres tables texte (`falaises.falaise_txt*`,
`falaises_liens`, `commentaires_falaises`) avant de conclure : un lien collé à la main
dans une description est possible.

Les **mails déjà envoyés** sont immuables et référencent
`https://velogrimpe.fr/bdd/images_news/…`. C'est la raison pour laquelle la règle de
compatibilité de la phase 1 est **permanente**, pas transitoire.

### Phase 5 — Reprise des statiques déposés à la main

Établir la liste exacte de ce qui a été perdu ou risque de l'être, en comparant le
serveur à la branche déployée :

```bash
cd ~ && git clone --depth 1 -b deploy https://github.com/velogrimpe/velogrimpe.fr.git /tmp/deployed
diff -rq /tmp/deployed public_html | grep '^Only in .*public_html' | sort
```

Chaque ligne est un fichier présent sur le serveur et absent du déploiement, donc
condamné. Arbitrage à l'unité :

- asset du site (affiche, logo, image d'article) → **committer** dans
  `public_html/images/…` ;
- donnée ou contenu téléversé → **déplacer** dans `~/public/…` et corriger le lien.

Pour `images/grave2026/` : les 5 fichiers présents dans le dépôt sont déjà déployés,
ce sont les ajouts ultérieurs qui sautent — cette comparaison les nommera.

### Phase 6 — Garde-fous

1. **`deploy.yml`** : échouer tôt plutôt que déployer une structure cassée.

   ```yaml
   - name: Vérifier le lien symbolique des données
     run: |
       test -L public_html/public || { echo "::error::public_html/public n'est plus un lien symbolique"; exit 1; }
       test "$(readlink public_html/public)" = "../public" || { echo "::error::cible inattendue"; exit 1; }
   - name: Aucune donnée téléversée versionnée
     run: |
       if git ls-files public_html/public | grep -q .; then
         echo "::error::des fichiers ont été committés sous public_html/public"; exit 1; fi
   ```

   Et vérifier après le rsync que `deploy-repo/public` est bien resté un lien
   (`test -L`) : `-a` implique `-l`, mais un passage à `--copy-links` recopierait
   470 Mo dans le dépôt de déploiement.

2. **`public_html/.gitignore`** : conserver les patterns `bdd/**` en filet le temps
   d'un cycle, puis les retirer et les remplacer par un commentaire expliquant que
   les données ne sont plus dans le dossier déployé. Retirer aussi les trois lignes
   commentées `# images/*` qui laissent croire à une protection inexistante.

3. **Sauvegardes** : `~/public` devient le seul exemplaire des 470 Mo de données, et
   il n'est dans aucun dépôt. Ce n'est pas une régression (c'est déjà le cas
   aujourd'hui pour `bdd/`), mais il faut le dire : vérifier que les sauvegardes
   Hostinger couvrent bien le répertoire personnel et pas seulement `public_html`,
   sinon ajouter un `tar` planifié.

4. **`docs/plans/DECISIONS.md`** : ajouter `D008 — Les contenus téléversés vivent hors
   du dossier déployé`, dans la continuité de D003 et D004.

5. **`CHANGELOG.md`**, `README.md`, `CLAUDE.md` : nouvelle arborescence, commande
   docker de dev, et mention du `deploy/bootstrap-public.sh` pour un nouvel
   hébergement.

## 5. Risques et parades

| Risque | Probabilité | Parade |
| --- | --- | --- |
| Lien symbolique non suivi par LiteSpeed | faible | Détecté en phase 0. `Options +FollowSymLinks`, sinon repli sur dossier ignoré |
| `Options` interdit en `.htaccess` → 500 | faible | Tester sur une URL de spike avant de committer ; retirer la directive si 500 |
| `.htaccess` de `~/public` ignoré | moyenne | La barrière effective est la règle `[F]` du `.htaccess` racine, pas celui de la cible |
| Un futur `--copy-links` dans le workflow | faible | Test `test -L` en phase 6 |
| Nouveau dossier d'upload créé sous `public_html` par oubli | moyenne | `vg_data_path()` comme seule API d'écriture + contrôle CI |
| URLs `/bdd/*` cassées (mails, SEO, open data) | élevée si oubliée | Règle de compatibilité permanente, posée en phase 1 avant tout déplacement |
| Cache LiteSpeed de 404 pendant la bascule | moyenne | Copier avant de basculer le code ; purger le cache après déploiement |

## 6. Séquencement et charge

| Phase | Charge | Déployable seule ? |
| --- | --- | --- |
| 0 — vérification | 1 h | oui (lien + fichier de test uniquement) |
| 1 — socle | 2 h | oui, sans effet visible |
| 2 — lectures/écritures | 3 h | non : à déployer avec la phase 3 |
| 3 — déplacement | 1 h + copie | avec la phase 2 |
| 4 — liens code + base | 2 h | oui |
| 5 — reprise manuelle | variable | oui |
| 6 — garde-fous et doc | 1 h | oui |

Les phases 2 et 3 forment la seule fenêtre sensible ; tout le reste est réversible
indépendamment.
