-- Migration 1 — Unification des arrêts et des accès (Lots 1 à 9 du plan docs/plan-implementation-arrets.md).
--
-- Migration UNIQUE qui fait passer la base du schéma de production (0_base_schema.sql : gares, bus_arrets,
-- bus_arrets_falaise, bus_lignes, bus_liaisons, velo, train) au schéma actuel. Elle remplace les huit étapes
-- successives du développement (Lot 11 « squash »), dont les tables intermédiaires (acces_pieton_falaise…)
-- n'existent donc jamais en production.
--
--   1. `arrets` (fusion gares + bus_arrets) ; ids des gares conservés, ids des arrêts de bus décalés ;
--      `references_externes` (codes SNCF / OSM) ; `lignes_transport` et `arrets_lignes_transport` (vides).
--   2. `train.gare_id` → `train.arret_id` (clé vers `arrets`).
--   3. `velo` → `acces_falaise` (types `velo` / `pied`, ids `velo_id` conservés = `acces_id`, préfixe des
--      GPX) : les itinéraires « à pied uniquement » deviennent des accès `pied`, les accès piétons de
--      `bus_arrets_falaise` y sont versés (couples déjà couverts par un « à pied uniquement » exclus).
--   4. Suppression de `bus_liaisons`, `bus_lignes`, `bus_arrets_falaise`, `bus_arrets` et `gares`.
--
-- IRRÉVERSIBLE (étape 4) : sauvegarde de la base (mysqldump) avant de la jouer en production. Les lignes et
-- liaisons de bus (bus_lignes / bus_liaisons) ne sont PAS reprises : les relever avant si besoin (cf.
-- docs/archive-bus-lignes-liaisons.md pour le jeu de dev). Se perdent aussi : gare_departement et les
-- colonnes gare_* de `gares`.
--
-- Après la migration : relancer `api/private/backfill_gares_geocode.php?admin=...` pour géocoder les arrêts
-- encore sans code INSEE.
--
-- Vérifications à faire AVANT (chacune doit renvoyer 0) :
--   SELECT COUNT(*) FROM velo v LEFT JOIN gares g ON g.gare_id = v.gare_id WHERE g.gare_id IS NULL;
--   SELECT COUNT(*) FROM train t LEFT JOIN gares g ON g.gare_id = t.gare_id WHERE g.gare_id IS NULL;
--   SELECT COUNT(*) FROM velo v LEFT JOIN falaises f ON f.falaise_id = v.falaise_id WHERE f.falaise_id IS NULL;
--
-- Doublons (arrêt, falaise, apieduniquement, variante) : le jeu de dev en contient un (arrêt 990 / falaise
-- 294, velo_id 253), corrigé en 3.a. Détection sur d'autres données :
--   SELECT gare_id, falaise_id, velo_apieduniquement, velo_variante, COUNT(*) n FROM velo GROUP BY 1,2,3,4 HAVING n > 1;
--
-- Non rejouable (les CHANGE COLUMN et RENAME échoueraient).
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/1_unification_arrets.sql

-- =====================================================================
-- 1. Table arrets (fusion gares + bus_arrets)
-- =====================================================================

CREATE TABLE `arrets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` text NOT NULL COMMENT 'Nom libre de l''arrêt',
  `loc` point NOT NULL,
  `slug` varchar(255) NOT NULL COMMENT 'Nom formaté (pas de caractères spéciaux, espaces...)',
  `commune` varchar(255) DEFAULT NULL,
  `code_insee` varchar(10) DEFAULT NULL,
  `cp` varchar(10) DEFAULT NULL,
  `ter` tinyint(1) NOT NULL DEFAULT 0,
  `tgv` tinyint(1) NOT NULL DEFAULT 0,
  `bus` tinyint(1) NOT NULL DEFAULT 0,
  `tram` tinyint(1) NOT NULL DEFAULT 0,
  `teleph` tinyint(1) NOT NULL DEFAULT 0,
  `deleted` tinyint(1) NOT NULL DEFAULT 0,
  `description` text DEFAULT NULL COMMENT 'Commentaire libre sur l''arrêt',
  `contrib` text NOT NULL COMMENT 'Contributeur',
  `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  SPATIAL KEY `loc` (`loc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.a Gares -> arrets, ids conservés (les gares sont plus centrales dans le
-- code actuel, cf. doc). gare_latlng est stocké "lat,lng" en texte libre.
--
-- Sémantique actuelle de gare_tgv (cf. doc, note "Gares TER/TGV") :
-- gare_tgv=1 signifie aujourd'hui "gare TGV qui n'est PAS desservie en TER"
-- (les gares TER+TGV ne sont pas distinguées) : on migre donc ter = NOT tgv.
-- Un passage manuel ultérieur sur les gares TER également desservies en TGV
-- reste nécessaire (cf. doc).
INSERT INTO `arrets` (
  `id`, `nom`, `loc`, `slug`, `commune`, `code_insee`, `cp`,
  `ter`, `tgv`, `bus`, `tram`, `teleph`, `deleted`,
  `contrib`, `contrib_mail`
)
SELECT
  `gare_id`,
  `gare_nom`,
  ST_GeomFromText(CONCAT('POINT(', SUBSTRING_INDEX(`gare_latlng`, ',', -1), ' ', SUBSTRING_INDEX(`gare_latlng`, ',', 1), ')'), 4326),
  `gare_nomformate`,
  `gare_com_nom`,
  `gare_com_insee`,
  `gare_com_cp`,
  IF(`gare_tgv` = 1, 0, 1),
  `gare_tgv`,
  0, 0, 0,
  `deleted`,
  'migration', 'migration@velogrimpe.fr'
FROM `gares`;

-- Aligne le compteur d'auto-increment pour que les prochains ids (bus_arrets,
-- puis les nouveaux arrêts) démarrent bien après le dernier id de gare.
SET @next_id = (SELECT MAX(`gare_id`) + 1 FROM `gares`);
SET @sql = CONCAT('ALTER TABLE arrets AUTO_INCREMENT = ', @next_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1.b Commune / code INSEE / code postal : repris tels quels de gares.gare_com_nom/insee/cp (NULL si jamais
-- géocodée). Les arrêts restés sans code INSEE se complètent APRÈS la migration par
-- `api/private/backfill_gares_geocode.php?admin=...` (géocodage inverse par lot, API data.gouv.fr).

-- 1.c bus_arrets -> arrets, nouveaux ids (table de correspondance nécessaire
-- pour les FK des tables dépendantes, ci-dessous). Pas de fichier de
-- géocodage connu pour les arrêts de bus : commune/code_insee/cp restent
-- NULL, à compléter manuellement via le formulaire (cf. doc).
CREATE TEMPORARY TABLE `_bus_arrets_id_map` (
  `old_id` int(11) NOT NULL,
  `new_id` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`new_id`)
) ENGINE=InnoDB;

SET @next_id = (SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'arrets');
SET @sql = CONCAT('ALTER TABLE _bus_arrets_id_map AUTO_INCREMENT = ', @next_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `_bus_arrets_id_map` (`old_id`)
SELECT `id` FROM `bus_arrets` ORDER BY `id`;

-- Slug généré à la volée (bus_arrets n'a pas d'équivalent de gare_nomformate) :
-- translittération best-effort (minuscules, espaces/ponctuation -> tirets),
-- les accents ne sont pas retirés en SQL pur — à corriger au cas par cas via
-- l'édition, ces arrêts deviennent modifiables (cf. doc Étape 2).
INSERT INTO `arrets` (
  `id`, `nom`, `loc`, `slug`, `ter`, `tgv`, `bus`, `tram`, `teleph`, `deleted`,
  `description`, `contrib`, `contrib_mail`, `date_creation`, `date_modification`
)
SELECT
  m.`new_id`,
  b.`nom`,
  b.`loc`,
  LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(TRIM(b.`nom`), '[^a-zA-Z0-9]+', '-'))),
  0, 0, 1, 0, 0, 0,
  b.`description`,
  b.`contrib`,
  b.`contrib_mail`,
  b.`date_creation`,
  b.`date_modification`
FROM `bus_arrets` b
JOIN `_bus_arrets_id_map` m ON m.`old_id` = b.`id`
ORDER BY b.`id`;

-- =====================================================================
-- 1.e Références externes (sncf/osm/motis...)
-- =====================================================================

CREATE TABLE `references_externes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `arret_id` int(11) NOT NULL,
  `libelle` text DEFAULT NULL COMMENT 'Libellé externe, optionnel',
  `source` varchar(64) NOT NULL COMMENT 'sncf, osm, motis, autre',
  `ref` varchar(128) NOT NULL COMMENT 'Code / id dans la référence',
  `data` json DEFAULT NULL COMMENT 'Données brutes de la source (ex. réponse Overpass complète)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `references_externes_uniq` (`arret_id`, `source`, `ref`),
  KEY `arret_id` (`arret_id`),
  CONSTRAINT `references_externes_ibfk_1` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- gares.gare_codeuic / gare_codeosm (ids conservés, pas de remap nécessaire)
INSERT INTO `references_externes` (`arret_id`, `source`, `ref`)
SELECT `gare_id`, 'sncf', `gare_codeuic` FROM `gares` WHERE `gare_codeuic` IS NOT NULL;

INSERT INTO `references_externes` (`arret_id`, `source`, `ref`)
SELECT `gare_id`, 'osm', `gare_codeosm` FROM `gares` WHERE `gare_codeosm` IS NOT NULL;

-- bus_arrets.osm_id / osm_data -> ref / data (remap via _bus_arrets_id_map)
INSERT INTO `references_externes` (`arret_id`, `source`, `ref`, `data`)
SELECT m.`new_id`, 'osm', b.`osm_id`, b.`osm_data`
FROM `bus_arrets` b
JOIN `_bus_arrets_id_map` m ON m.`old_id` = b.`id`
WHERE b.`osm_id` IS NOT NULL;

-- =====================================================================
-- 1.d Lignes de transport + liaison arrêts <-> lignes
-- =====================================================================
-- Tables vides à ce stade : pas de reprise de bus_lignes / bus_liaisons (supprimées en fin de migration ;
-- lignes et liaisons à sauvegarder avant, cf. l'en-tête).

CREATE TABLE `lignes_transport` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` text NOT NULL COMMENT 'Nom officiel',
  `numero` varchar(64) DEFAULT NULL COMMENT 'Identifiant de ligne : L21, C14, Zou 915...',
  `operateur` varchar(64) DEFAULT NULL,
  `operateur_url` text DEFAULT NULL,
  `horaire_url` text DEFAULT NULL,
  `ref` text DEFAULT NULL COMMENT 'Référence/identifiant officiel chez l''opérateur',
  `couleur` varchar(64) DEFAULT NULL COMMENT 'Code couleur CSS : #123456, gold, hsl(...)',
  `geometry` multilinestring DEFAULT NULL,
  `contrib` text DEFAULT NULL COMMENT 'Contributeur',
  `contrib_mail` text DEFAULT NULL COMMENT 'Mail du contributeur',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `arrets_lignes_transport` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ligne_id` int(11) NOT NULL,
  `arret_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `arrets_lignes_transport_uniq` (`ligne_id`, `arret_id`),
  KEY `arret_id` (`arret_id`),
  CONSTRAINT `arrets_lignes_transport_ibfk_1` FOREIGN KEY (`ligne_id`) REFERENCES `lignes_transport` (`id`) ON DELETE CASCADE,
  CONSTRAINT `arrets_lignes_transport_ibfk_2` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. train : gare_id -> arret_id
-- =====================================================================
-- Les ids de gares étant conservés dans `arrets`, aucune donnée à remapper. Colonne élargie en int(11)
-- (prérequis de la FK). Pas de ON DELETE CASCADE : supprimer un arrêt n'efface pas d'itinéraires.
-- Les tables `exclusions_villes_gares*` gardent leur colonne `gare_id` (admin).

ALTER TABLE `train`
  CHANGE COLUMN `gare_id` `arret_id` int(11) NOT NULL,
  ADD KEY `arret_id` (`arret_id`),
  ADD CONSTRAINT `train_ibfk_arret` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`);

-- =====================================================================
-- 3. velo (+ accès piétons de bus_arrets_falaise) -> acces_falaise
-- =====================================================================
-- `velo` est renommée puis modifiée : les velo_id sont conservés (nom des fichiers GPX
-- `{id}_{depart}_{arrivee}_{variante}.gpx`). « À pied possible » n'est plus stocké :
-- type = 'pied' OR km <= 5, calculé à la lecture. UNIQUE (arret_id, falaise_id, type, variante),
-- FK vers arrets et falaises, sans ON DELETE CASCADE.

-- 3.a Coquille du jeu de données : la 2e ligne porte le slug « acces-par-le-nord » mais le libellé
-- « Accès par le Sud » (unicité par variante impossible sinon). Sans effet ailleurs.
UPDATE `velo` SET `velo_variante` = 'Accès par le Nord'
WHERE `velo_id` = 253 AND `gare_id` = 990 AND `falaise_id` = 294
  AND `velo_varianteformate` = 'acces-par-le-nord' AND `velo_variante` = 'Accès par le Sud';

RENAME TABLE `velo` TO `acces_falaise`;

ALTER TABLE `acces_falaise`
  CHANGE COLUMN `gare_id` `arret_id` int(11) NOT NULL,
  CHANGE COLUMN `velo_id` `acces_id` int(11) NOT NULL AUTO_INCREMENT,
  ADD COLUMN `type` enum('velo','pied') NOT NULL DEFAULT 'velo' AFTER `acces_id`,
  CHANGE COLUMN `velo_depart` `depart_slug` text NOT NULL COMMENT 'Slug de l''arrêt de départ (clé du fichier GPX)',
  CHANGE COLUMN `velo_arrivee` `arrivee_slug` text NOT NULL COMMENT 'Nom formaté de la falaise d''arrivée (clé du fichier GPX)',
  CHANGE COLUMN `velo_descr` `description` text NOT NULL,
  CHANGE COLUMN `velo_km` `km` float DEFAULT NULL COMMENT 'Nb km, juste le nb',
  CHANGE COLUMN `velo_dplus` `dplus` int(11) DEFAULT NULL COMMENT 'D+, juste le nb',
  CHANGE COLUMN `velo_dmoins` `dmoins` int(11) DEFAULT NULL COMMENT 'D-, juste le nb',
  CHANGE COLUMN `velo_openrunner` `lien_openrunner` text DEFAULT NULL,
  CHANGE COLUMN `velo_variante` `variante` varchar(100) NOT NULL DEFAULT '' COMMENT 'Nom de la variante',
  CHANGE COLUMN `velo_varianteformate` `variante_formate` varchar(100) NOT NULL DEFAULT '' COMMENT 'Slug de la variante (clé du fichier GPX)',
  CHANGE COLUMN `velo_public` `public` int(11) NOT NULL,
  CHANGE COLUMN `velo_contrib` `contrib` text NOT NULL COMMENT 'Contributeur',
  ADD COLUMN `contrib_mail` text NOT NULL DEFAULT '' COMMENT 'Mail du contributeur' AFTER `contrib`;

-- Ordre des affectations : contrib_mail (lu depuis l'ancien contrib) avant contrib.
UPDATE `acces_falaise` SET
  `contrib_mail` = IF(LOCATE(',', `contrib`) > 0, TRIM(BOTH '''' FROM TRIM(SUBSTRING_INDEX(`contrib`, ',', -1))), ''),
  `contrib` = COALESCE(NULLIF(TRIM(BOTH '''' FROM TRIM(SUBSTRING_INDEX(`contrib`, ',', 1))), ''), 'Contributeur inconnu');

-- Les itinéraires « à pied uniquement » deviennent des accès `pied`, publics.
UPDATE `acces_falaise` SET
  `type` = 'pied',
  `public` = 1,
  `description` = TRIM(REPLACE(`description`, 'Attention : itinéraire impossible à vélo, à pied uniquement.', ''))
WHERE `velo_apieduniquement` = 1;

-- 3.b Accès piétons d'origine (bus_arrets_falaise, ids d'arrêts remappés par _bus_arrets_id_map), sauf les
-- couples déjà couverts par un « à pied uniquement » de velo. Ordre stable (arrêt, falaise).
INSERT INTO `acces_falaise`
  (`type`, `arret_id`, `falaise_id`, `depart_slug`, `arrivee_slug`, `description`, `date_creation`, `contrib`, `contrib_mail`, `public`, `variante`, `variante_formate`)
SELECT 'pied', m.`new_id`, baf.`falaise_id`, a.`slug`, f.`falaise_nomformate`,
       '', baf.`date_creation`, baf.`contrib`, baf.`contrib_mail`, 1, '', ''
FROM `bus_arrets_falaise` baf
JOIN `_bus_arrets_id_map` m ON m.`old_id` = baf.`arret_id`
JOIN `arrets` a ON a.`id` = m.`new_id`
JOIN `falaises` f ON f.`falaise_id` = baf.`falaise_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `acces_falaise` x
  WHERE x.`arret_id` = m.`new_id` AND x.`falaise_id` = baf.`falaise_id` AND x.`velo_apieduniquement` = 1
)
ORDER BY m.`new_id`, baf.`falaise_id`;

ALTER TABLE `acces_falaise`
  DROP COLUMN `velo_apiedpossible`,
  DROP COLUMN `velo_apieduniquement`,
  ADD KEY `arret_id` (`arret_id`),
  ADD UNIQUE KEY `uniq_acces` (`arret_id`, `falaise_id`, `type`, `variante`),
  ADD KEY `falaise_id` (`falaise_id`),
  ADD CONSTRAINT `acces_falaise_arret_fk` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`),
  ADD CONSTRAINT `acces_falaise_falaise_fk` FOREIGN KEY (`falaise_id`) REFERENCES `falaises` (`falaise_id`);

DROP TEMPORARY TABLE `_bus_arrets_id_map`;

-- =====================================================================
-- 4. Suppression des anciennes tables
-- =====================================================================
-- Ordre : d'abord celles qui portent des clés étrangères (bus_liaisons -> bus_lignes / bus_arrets,
-- bus_arrets_falaise -> bus_arrets).

DROP TABLE `bus_liaisons`;
DROP TABLE `bus_arrets_falaise`;
DROP TABLE `bus_lignes`;
DROP TABLE `bus_arrets`;
DROP TABLE `gares`;
