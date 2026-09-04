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
ou dès qu'on dépose dans `bdd/` un fichier d'une extension non couverte
(`bdd/trains/x.json` et `bdd/barres/x.json` sont aujourd'hui **non ignorés**).

## 2. Cible

Le point de montage **reflète l'espace d'URL** : `public/bdd/...` et `public/images/...`
reprennent exactement l'arborescence actuelle.

```
/home/<user>/
├── public/                     ← contenus téléversés et générés, HORS dépôt
│   ├── bdd/                    ← mêmes sous-dossiers qu'aujourd'hui
│   │   ├── images_falaises/  images_news/  images_pages/
│   │   ├── gpx/  barres/  barres-historique/
│   │   └── zones/  ca/  trains/  biodiv/  datatourisme/
│   ├── images/                 ← dépôts manuels (affiches, PDF, visuels d'événement)
│   ├── open-data/
│   └── .htaccess               ← aucun exécutable, pas de listing
├── config.php                  ← déjà hors dépôt, même principe
└── public_html/                ← dossier déployé, 100 % versionné
    ├── bdd/                    ← ne garde que les entrées versionnées
    ├── images/                 ← assets du site, versionnés
    └── public -> ../public     ← lien symbolique VERSIONNÉ
```

Quatre propriétés :

- **Ce qui est déployé est intégralement versionné.** Plus aucun fichier de données ne
  dépend d'un pattern d'ignore pour survivre.
- **Le lien symbolique est suivi par git** : `git clean` ne le touche pas, et un
  `checkout -f` — voire un clone neuf — le recrée. La cible étant hors du dossier
  déployé, elle est structurellement hors d'atteinte de tout changement de
  comportement côté Hostinger.
- **Aucune URL publique ne change.** Le miroir permet une règle de repli unique :
  un fichier absent du dossier déployé est cherché dans le point de montage. Les
  URLs restent `/bdd/gpx/…`, `/images/grave2026/…`, `/open-data/…`.
- **La frontière est mécanique** : sous `bdd/`, `images/` et `open-data/`, tout ce qui
  n'est pas suivi par la branche `deploy` est une donnée et vit dans `~/public`, au
  même chemin relatif.

### Pourquoi un lien symbolique et pas un `Alias` Apache

`Alias`/`AliasMatch` sont des directives de configuration serveur, **interdites en
`.htaccess`** ; et `mod_rewrite` en `.htaccess` ne peut pas réécrire vers un chemin
filesystem hors du DocumentRoot. Le lien symbolique versionné est le seul mécanisme
qui expose un dossier hors docroot en mutualisé, tout en conservant le service
**statique** — indispensable pour les `.pmtiles` (requêtes HTTP Range) et le cache
long des images.

L'alternative « servir via un script PHP » est écartée : coût PHP sur chaque image,
et gestion manuelle des Range requests pour les pmtiles.

### Conséquence : ni réécriture de liens, ni migration de base

Comme l'espace d'URL est préservé, les 20 URLs `/bdd/…` en dur dans le code
(`carte.php`, `carte_maplibre.php`, `falaise.php`, `js/components/map/*.js`,
`ajout/*`, un article) **restent justes**, et les contenus stockés en base
(`newsletters.sections`, `pages.sections`, `pages.banner_img`) n'ont pas à être
réécrits. Les mails déjà envoyés et les exports open data déjà téléchargés, qui
référencent `https://velogrimpe.fr/bdd/images_news/…` et `…/bdd/gpx/…`, continuent de
fonctionner sans règle de compatibilité dédiée.

Seuls les **chemins filesystem** changent, dans les producteurs et les lecteurs
serveur.

## 3. Inventaire

### 3.1 À déplacer vers `~/public` (données)

Chemin cible = chemin actuel, préfixé par `public/`.

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
| dépôts manuels sous `images/` | à établir | dépôt FTP / File Manager | pages du site |

Total ≈ 470 Mo, copie locale sur le serveur (pas de transfert réseau).

### 3.2 Qui restent dans le dépôt, dans `public_html`

- `images/` : `icons/`, `map/`, `mw/`, `captures/`, `pages/`, `articles/`, `news/`,
  `grave2026/`, logos — les 146 fichiers suivis sont des assets du site, pas des
  données.
- `bdd/styles/*.json`, `bdd/trains/gares.json`, `bdd/cartotrain/tableau.xlsx`,
  `bdd/datatourisme/{extract-campings.js,package.json,README.md}`,
  `bdd/biodiv/README.md`, les `.htaccess`.
- `open-data/download.php`.

Trois dossiers deviennent donc mixtes — `bdd/trains/`, `bdd/datatourisme/`, `images/`
— avec la même partie versionnée dans `public_html` et la partie données dans
`~/public`. C'est la règle de repli qui recolle les deux, fichier par fichier.

**Règle à respecter** : jamais le même chemin relatif dans les deux arborescences.
En cas de collision, c'est le fichier déployé qui gagne (il est trouvé en premier), et
la donnée devient invisible sans erreur — c'est le seul piège de ce montage.

> **À confirmer** : `bdd/cartotrain/tableau.xlsx` est versionné et lu par le cron
> `ingest_cartotrain.php`. S'il t'arrive de le remplacer directement sur le serveur,
> il doit passer dans `~/public/bdd/cartotrain/` comme les autres données — et être
> retiré du dépôt, pour ne pas tomber dans la collision ci-dessus.

## 4. Phases

### Phase 0 — Vérification préalable (bloquante)

Rien ne bouge avant d'avoir prouvé les hypothèses. En SSH :

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

1. **`public_html/lib/paths.php`** — source unique de vérité. Les chemins passés sont
   ceux de l'espace d'URL, ce qui rend la conversion triviale :

   ```php
   const VG_DATA_MOUNT = '/public';

   // 'bdd/gpx/12_x.gpx' -> DOCUMENT_ROOT . '/public/bdd/gpx/12_x.gpx'
   function vg_data_path(string $rel = ''): string;

   // 'bdd/gpx/12_x.gpx' -> '/bdd/gpx/12_x.gpx'   (URL publique inchangée)
   function vg_data_url(string $rel): string;

   // null si le chemin résolu sort du point de montage
   function vg_data_realpath(string $rel): ?string;
   ```

   Base filesystem = `$_SERVER['DOCUMENT_ROOT'] . '/public'`, donc identique en dev et
   en prod et traversant le lien symbolique.

   > **Piège à éviter** : ne jamais faire `str_replace(DOCUMENT_ROOT, '', realpath($p))`
   > sur un chemin de données. À travers le lien, `realpath()` renvoie
   > `/home/<user>/public/…`, qui n'est **pas** sous `DOCUMENT_ROOT`. Les contrôles
   > d'évasion de dossier doivent comparer à `realpath(vg_data_path())`, ce que fait
   > `vg_data_realpath()`. `api/add_falaise.php` fait aujourd'hui un `realpath()` sur
   > `'../bdd/images_falaises/'`, et `lib/admin_image_upload.php` dérive son préfixe
   > d'URL par `str_replace(DOCUMENT_ROOT, …)` : ce sont les deux points à reprendre.

2. **`public_html/.htaccess`** — à insérer juste après le bloc de redirection
   canonique :

   ```apache
   # --- Contenus téléversés / générés (cf. D008) --------------------------------
   # /public est un lien symbolique versionné vers ~/public, dont l'arborescence
   # reflète l'espace d'URL (public/bdd/…, public/images/…). La cible est hors du
   # dossier déployé : aucun déploiement ne peut l'effacer.

   # Aucun exécutable servi sous /public. Règle placée ici et pas seulement dans
   # ~/public/.htaccess : derrière un lien symbolique hors DocumentRoot, un
   # .htaccess peut être ignoré selon la configuration d'AllowOverride.
   RewriteRule ^public/.*\.(php|phar|phtml|php[0-9]|phps|pht|inc|shtml|cgi|pl|py|rb|sh|lua)$ - [F,L,NC]

   # Repli sur le point de montage : un fichier absent du dossier déployé est
   # cherché dans les données. Conserve l'espace d'URL historique (/bdd/…,
   # /images/…) quel que soit l'emplacement physique du fichier, donc aucune URL
   # publique à réécrire — ni dans le code, ni en base, ni dans les mails déjà
   # envoyés. Un nouveau dossier de données fonctionne sans toucher à cette règle.
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^(bdd|images)/(.+)$ /public/$1/$2 [L]
   ```

   Ordre et bouclage : la règle `[F]` est placée **avant** le repli, et une
   réécriture interne relance le jeu de règles — une URL `/bdd/…/x.php` est donc
   bloquée elle aussi. Le repli ne boucle pas : sur `/public/bdd/gpx/x.gpx` le motif
   `^(bdd|images)/` ne matche plus.

   Les `<FilesMatch>` existants (`Content-Disposition` sur `.gpx`, `ForceType` sur
   `.geojson`, cache long sur les images) s'appliquent aux fichiers servis via le
   point de montage puisqu'ils sont déclarés dans le `.htaccess` racine :
   comportement inchangé.

   *Option* : chaque fichier étant joignable par deux URLs (`/bdd/gpx/x.gpx` et
   `/public/bdd/gpx/x.gpx`), on peut marquer la seconde `noindex` —
   `RewriteRule ^public/ - [E=NOINDEX:1]` + `Header set X-Robots-Tag "noindex" env=NOINDEX`.
   Sans enjeu réel pour des images et des traces GPX.

3. **`deploy/public-htaccess`** (versionné, installé une fois à la main dans
   `~/public/.htaccess`) : reprise du durcissement de `bdd/.htaccess` — `FilesMatch`
   + `Require all denied`, `php_flag engine off` sous `<IfModule>`, `Options -Indexes`.
   Défense en profondeur ; la barrière garantie reste la règle `[F]` ci-dessus.

4. **`deploy/bootstrap-public.sh`** : script idempotent de création de `~/public`,
   de son arborescence (`bdd/*`, `images/`, `open-data/`) et de son `.htaccess`.
   Documente le setup serveur, à rejouer en cas de changement d'hébergement.

5. **`.gitignore` racine** : ajouter `/public/` (dossier de dev local).

6. **Dev local** : le lien `public_html/public -> ../public` pointe hors du volume
   monté. Monter le dossier de données à côté, exactement comme `config.php` :

   ```bash
   -v $PWD/public:/opt/lampp/public
   ```

   (`/opt/lampp/htdocs/public` → `../public` → `/opt/lampp/public`). À reporter dans
   `CLAUDE.md` et le `README.md` — la commande docker documentée y est de toute façon
   à rafraîchir depuis le passage en v2.

### Phase 2 — Bascule des chemins filesystem

Passage à `vg_data_path()`, sans rien déplacer encore (les deux arborescences
coexistent le temps de la phase 3, le repli sert de filet). **Aucune URL émise ne
change** : le tableau ci-dessous est exhaustif.

| Fichier | Lignes | Nature |
| --- | --- | --- |
| `api/add_falaise.php` | 362 | écriture images falaises (+ reprise du `realpath`) |
| `api/add_velo.php` | 136 | écriture GPX |
| `api/private/falaise_details.php` | 261, 320 | écriture barres + historique |
| `lib/admin_image_upload.php` | 74, 93 | base dir + préfixe d'URL explicite au lieu du `str_replace(DOCUMENT_ROOT…)` dérivé |
| `api/private/newsletter/upload-image.php` | 4 | base dir → `vg_data_path('bdd/images_news')` |
| `api/private/pages/upload-image.php` | 4 | base dir → `vg_data_path('bdd/images_pages')` |
| `api/geocode.php` | 19-20 | lecture zones |
| `api/private/batch-geocode.php` | 39-40 | lecture zones |
| `api/private/crons/export_open_data.php` | 244, 400 | lectures gpx / barres |
| `api/private/crons/export_open_data.php` | 499-541 | écritures des 5 exports |
| `open-data/download.php` | 29 | lecture des exports |
| `falaise.php` | 241 | `file_exists()` de la photo (l'URL ligne 240 est inchangée) |

`export_open_data.php:259,402` (`gpx_url`, `details_url` publiés dans les exports)
restent tels quels : ce sont des URLs, pas des chemins.

Compléter les `.http` de non-régression (`tests/add_falaise.http`,
`tests/add_velo.http` couvrent déjà les cas de sécurité) : nouveaux chemins d'écriture,
et conserver les assertions « `.php` déguisé non exécutable » et « images et GPX
toujours servis », qui valident du même coup la règle de repli.

### Phase 3 — Déplacement des données sur le serveur

La branche déployée fait office de référence : **tout fichier de `bdd/`, `images/` ou
`open-data/` qui n'y est pas suivi est une donnée**. Copie d'abord, suppression
seulement après validation ; le site continue de fonctionner sur les fichiers en
place pendant toute l'opération.

```bash
cd ~
bash deploy/bootstrap-public.sh
git clone --depth 1 -b deploy https://github.com/velogrimpe/velogrimpe.fr.git /tmp/deployed

cd ~/public_html
# Liste exacte des données : présentes sur le serveur, absentes du déploiement
comm -23 <(find bdd images open-data -type f | sed 's|^\./||' | sort) \
         <(git -C /tmp/deployed ls-files bdd images open-data | sort) > /tmp/data-files.txt
wc -l /tmp/data-files.txt
grep -c '^images/' /tmp/data-files.txt      # les dépôts manuels qui disparaissaient

# Copie en conservant les chemins relatifs
rsync -a --files-from=/tmp/data-files.txt . ~/public/

# Contrôle
diff <(sed 's|^|/|' /tmp/data-files.txt | sort) \
     <(cd ~/public && find bdd images open-data -type f | sed 's|^|/|' | sort)
du -sh ~/public
```

Passer en revue `/tmp/data-files.txt` avant la copie : un fichier sous `images/` peut
être un **asset du site** qui aurait dû être committé (affiche, logo, visuel
d'article) plutôt qu'une donnée. Dans ce cas, le committer dans le dépôt et le retirer
de la liste — c'est le seul arbitrage manuel de la migration.

Puis : déployer la phase 2, vérifier le site (fiche falaise avec photos, carte Leaflet
et MapLibre, tuiles pmtiles, téléchargement open data, ajout de falaise et
d'itinéraire de bout en bout), **et seulement ensuite** supprimer les sources
(`xargs rm` sur la même liste, puis nettoyage des dossiers vides). Rollback = revert
du déploiement ; les données sont intactes aux deux endroits.

Ne pas oublier ce qui reste dans `public_html/bdd/` : `styles/`, `trains/gares.json`,
`cartotrain/tableau.xlsx`, les scripts `datatourisme/`, les `README.md`, le
`.htaccess` — la commande ci-dessus les épargne puisqu'ils sont suivis.

### Phase 4 — Garde-fous

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
   commentées `# images/*`, qui laissent croire à une protection inexistante.

3. **Sauvegardes** : `~/public` devient le seul exemplaire des 470 Mo de données, et
   il n'est dans aucun dépôt. Ce n'est pas une régression (c'est déjà le cas
   aujourd'hui pour `bdd/`), mais il faut le dire : vérifier que les sauvegardes
   Hostinger couvrent bien le répertoire personnel et pas seulement `public_html`,
   sinon ajouter un `tar` planifié.

4. **`docs/plans/DECISIONS.md`** : ajouter `D008 — Les contenus téléversés vivent hors
   du dossier déployé, à un chemin qui reflète leur URL`, dans la continuité de D003
   et D004.

5. **`CHANGELOG.md`**, `README.md`, `CLAUDE.md` : nouvelle arborescence, commande
   docker de dev, et mention du `deploy/bootstrap-public.sh` pour un nouvel
   hébergement.

## 5. Risques et parades

| Risque | Probabilité | Parade |
| --- | --- | --- |
| Lien symbolique non suivi par LiteSpeed | faible | Détecté en phase 0. `Options +FollowSymLinks`, sinon repli sur dossier ignoré |
| `Options` interdit en `.htaccess` → 500 | faible | Tester sur une URL de spike avant de committer ; retirer la directive si 500 |
| `.htaccess` de `~/public` ignoré | moyenne | La barrière effective est la règle `[F]` du `.htaccess` racine, pas celui de la cible |
| Même chemin relatif dans les deux arborescences | moyenne | Le fichier déployé gagne, la donnée devient invisible sans erreur. Contrôle possible en CI : intersection des deux listes |
| Un futur `--copy-links` dans le workflow | faible | Test `test -L` en phase 4 |
| Nouveau dossier d'upload créé sous `public_html` par oubli | moyenne | `vg_data_path()` comme seule API d'écriture + contrôle CI |
| Coût du `RewriteCond !-f` | négligeable | Un `stat` par requête sur `/bdd/*` et `/images/*` |
| Cache LiteSpeed de 404 pendant la bascule | moyenne | Copier avant de basculer le code ; purger le cache après déploiement |

## 6. Séquencement et charge

| Phase | Charge | Déployable seule ? |
| --- | --- | --- |
| 0 — vérification | 1 h | oui (lien + fichier de test uniquement) |
| 1 — socle | 2 h | oui, sans effet visible |
| 2 — chemins filesystem | 2 h | oui, grâce au repli qui sert de filet |
| 3 — déplacement | 1 h + copie | avec la phase 2 |
| 4 — garde-fous et doc | 1 h | oui |

Le miroir d'arborescence supprime la phase de réécriture des liens (code et base) et
fusionne le déplacement des données avec la reprise des dépôts manuels : la migration
passe de six phases à cinq, et la seule fenêtre sensible est la 2+3.
