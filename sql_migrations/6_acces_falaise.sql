-- Migration 6 — `velo` + `acces_pieton_falaise` → `acces_falaise` (Lot 8quater du plan).
--
-- `velo` est renommée puis modifiée (les velo_id sont conservés : ils entrent
-- dans le nom des fichiers GPX `{id}_{depart}_{arrivee}_{variante}.gpx`), les
-- accès piétons y sont versés avec type = 'pied'. `acces_pieton_falaise` n'est
-- plus lue ni écrite mais n'est pas supprimée (décision en Lot 9).
--
-- - Les lignes velo_apieduniquement = 1 deviennent type = 'pied', public = 1
--   (la migration 4 les avait masquées par -1 ; toutes valaient 1 avant).
--   La phrase standard « Attention : itinéraire impossible à vélo… » est retirée.
-- - Pour un couple (arrêt, falaise) présent à la fois dans velo (à pied
--   uniquement) et dans acces_pieton_falaise, la version venue de velo prime.
-- - velo_contrib « 'Nom','mail' » est découpé en contrib / contrib_mail.
-- - velo_apiedpossible et velo_apieduniquement disparaissent : « à pied
--   possible » = type = 'pied' OR km <= 5 (calculé à la lecture).
-- - UNIQUE (arret_id, falaise_id, type, variante), FK vers arrets et falaises,
--   sans ON DELETE CASCADE.
--
-- Avant de lancer (doit renvoyer 0 ligne) — doublons qui feraient échouer
-- l'unicité :
--   SELECT arret_id, falaise_id, velo_apieduniquement, velo_variante, COUNT(*) n
--   FROM velo GROUP BY 1,2,3,4 HAVING n > 1;
-- (le jeu de dev en contient un, arrêt 990 / falaise 294, corrigé ci-dessous.)
-- Et : SELECT COUNT(*) FROM velo v LEFT JOIN falaises f ON f.falaise_id = v.falaise_id WHERE f.falaise_id IS NULL;
--
-- Migration ponctuelle, non rejouable telle quelle (le RENAME échouerait).
-- Écart (informatif) entre l'ancienne colonne et la règle calculée, à lancer
-- AVANT la migration :
--   SELECT COUNT(*) FROM velo WHERE (velo_apiedpossible = 1) <> (velo_apieduniquement = 1 OR velo_km <= 5);
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/6_acces_falaise.sql

-- Coquille du jeu de données : la 2e ligne porte le slug « acces-par-le-nord »
-- mais le libellé « Accès par le Sud » (unicité par variante impossible sinon).
UPDATE `velo` SET `velo_variante` = 'Accès par le Nord'
WHERE `velo_id` = 253 AND `arret_id` = 990 AND `falaise_id` = 294
  AND `velo_varianteformate` = 'acces-par-le-nord' AND `velo_variante` = 'Accès par le Sud';

-- La FK est retirée AVANT le renommage : MariaDB renomme les FK nommées `velo_ibfk_*` en
-- `acces_falaise_ibfk_*` avec la table, et la supprimer dans le même ALTER que
-- les colonnes échoue (errno 152).
ALTER TABLE `velo` DROP FOREIGN KEY `velo_ibfk_arret`;

RENAME TABLE `velo` TO `acces_falaise`;

ALTER TABLE `acces_falaise`
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

-- Accès piétons d'origine, sauf les couples déjà couverts par un « à pied uniquement » de velo.
INSERT INTO `acces_falaise`
  (`type`, `arret_id`, `falaise_id`, `depart_slug`, `arrivee_slug`, `description`, `date_creation`, `contrib`, `contrib_mail`, `public`, `variante`, `variante_formate`)
SELECT 'pied', ap.`arret_id`, ap.`falaise_id`, a.`slug`, f.`falaise_nomformate`,
       COALESCE(ap.`description`, ''), ap.`date_creation`, ap.`contrib`, ap.`contrib_mail`, 1, '', ''
FROM `acces_pieton_falaise` ap
JOIN `arrets` a ON a.`id` = ap.`arret_id`
JOIN `falaises` f ON f.`falaise_id` = ap.`falaise_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `acces_falaise` x
  WHERE x.`arret_id` = ap.`arret_id` AND x.`falaise_id` = ap.`falaise_id` AND x.`velo_apieduniquement` = 1
);

ALTER TABLE `acces_falaise`
  DROP COLUMN `velo_apiedpossible`,
  DROP COLUMN `velo_apieduniquement`,
  ADD UNIQUE KEY `uniq_acces` (`arret_id`, `falaise_id`, `type`, `variante`),
  ADD KEY `falaise_id` (`falaise_id`),
  ADD CONSTRAINT `acces_falaise_arret_fk` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`),
  ADD CONSTRAINT `acces_falaise_falaise_fk` FOREIGN KEY (`falaise_id`) REFERENCES `falaises` (`falaise_id`);
