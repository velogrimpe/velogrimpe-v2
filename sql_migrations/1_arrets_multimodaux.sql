-- Migration 1 — Unification des arrêts multimodaux (docs/conception-bus.md, Étape 1)
--
-- Additive uniquement : crée les nouvelles tables et y copie les données de
-- gares / bus_arrets / bus_arrets_falaise. Ne modifie ni ne supprime aucune
-- table existante (gares, bus_arrets, bus_arrets_falaise, bus_lignes,
-- bus_liaisons restent en place et pleinement fonctionnelles) : le code
-- applicatif continue de lire/écrire les anciennes tables jusqu'à la bascule
-- des endpoints (Lot 2 du plan), qui pourra alors basculer sans période de
-- double-écriture. Une migration de nettoyage (rename/drop des anciennes
-- tables) suivra une fois le Lot 2 en production.
--
-- Pré-requis : appeler `api/private/backfill_gares_geocode.php?admin=...`
-- (géocodage inverse par lot des gares) AVANT de rejouer cette migration,
-- pour que gares.gare_com_insee/nom/cp soient déjà renseignées quand 1.a les
-- copie dans `arrets`. Rejouable après coup : relancer le backfill puis
-- ré-appliquer une migration de correction ciblée sur `arrets` si besoin.
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/1_arrets_multimodaux.sql

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

-- 1.b Backfill commune/code_insee/cp des gares : NE PAS lancer ce script
-- avant d'avoir appelé `api/private/backfill_gares_geocode.php` (géocodage
-- inverse par lot via l'API data.gouv.fr, cf. son en-tête) au moins une fois.
-- Ce backfill vit dans un endpoint applicatif plutôt que dans cette migration
-- : il doit fonctionner identiquement en dev et en prod, or `LOAD DATA INFILE`
-- avec un chemin de fichier local ne fonctionne qu'en dev (chemin propre au
-- montage du conteneur Docker). Une fois `gares.gare_com_insee/nom/cp`
-- renseignées par cet endpoint, la copie ci-dessus (1.a) les reporte déjà
-- dans `arrets` — aucune étape supplémentaire n'est nécessaire ici.

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
-- 2. Références externes (sncf/osm/motis...)
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
-- 3. Accès piétons arrêt -> falaise (copie de bus_arrets_falaise, ids remappés)
-- =====================================================================
-- Copie plutôt que RENAME : bus_arrets_falaise reste en place et pleinement
-- fonctionnelle pour le code actuel jusqu'à la bascule des endpoints (Lot 2).

CREATE TABLE `acces_pieton_falaise` (
  `arret_id` int(11) NOT NULL,
  `falaise_id` smallint(6) NOT NULL,
  `description` text DEFAULT NULL,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `contrib` text NOT NULL COMMENT 'Contributeur',
  `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
  PRIMARY KEY (`arret_id`, `falaise_id`),
  KEY `falaise_id` (`falaise_id`),
  CONSTRAINT `acces_pieton_falaise_ibfk_1` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `acces_pieton_falaise_ibfk_2` FOREIGN KEY (`falaise_id`) REFERENCES `falaises` (`falaise_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `acces_pieton_falaise` (`arret_id`, `falaise_id`, `contrib`, `contrib_mail`, `date_creation`)
SELECT m.`new_id`, baf.`falaise_id`, baf.`contrib`, baf.`contrib_mail`, baf.`date_creation`
FROM `bus_arrets_falaise` baf
JOIN `_bus_arrets_id_map` m ON m.`old_id` = baf.`arret_id`;

DROP TEMPORARY TABLE `_bus_arrets_id_map`;

-- =====================================================================
-- 4. Lignes de transport (Étape 6 de la doc) + liaison arrêts <-> lignes
-- =====================================================================
-- Tables vides à ce stade : pas de migration de données depuis bus_lignes /
-- bus_liaisons (cf. doc Étape 8 : ces tables deviennent obsolètes une fois
-- lignes_transport en production, mais ne sont jamais supprimées).

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
