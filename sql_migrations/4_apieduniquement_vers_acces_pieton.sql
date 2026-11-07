-- Migration 4 — itinéraires « à pied uniquement » → acces_pieton_falaise (Lot 8 du plan).
--
-- Chaque ligne `velo` avec velo_apieduniquement = 1 est copiée dans
-- `acces_pieton_falaise` (description = velo_descr sans la phrase standard,
-- contributeur découpé depuis velo_contrib « 'Nom','mail' »), puis masquée dans
-- `velo` par velo_public = -1 (exclu par tous les lecteurs, `>= 0` comme
-- `>= 1`). Rien n'est supprimé : km, D+ et GPX restent en base.
--
-- Rejouable : INSERT IGNORE (clé primaire arret_id + falaise_id, un accès déjà
-- présent est conservé) et UPDATE limité aux lignes pas encore masquées.
--
-- Vérification avant/après (le nombre d'accès piéton augmente d'au plus N) :
--   SELECT COUNT(*) FROM velo WHERE velo_apieduniquement = 1 AND velo_public <> -1;  -- avant : N, après : 0
--   SELECT COUNT(*) FROM acces_pieton_falaise;
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/4_apieduniquement_vers_acces_pieton.sql

INSERT IGNORE INTO `acces_pieton_falaise` (`arret_id`, `falaise_id`, `description`, `contrib`, `contrib_mail`)
SELECT
  v.`arret_id`,
  v.`falaise_id`,
  NULLIF(TRIM(REPLACE(v.`velo_descr`, 'Attention : itinéraire impossible à vélo, à pied uniquement.', '')), ''),
  COALESCE(NULLIF(TRIM(BOTH '''' FROM TRIM(SUBSTRING_INDEX(v.`velo_contrib`, ',', 1))), ''), 'Contributeur inconnu'),
  IF(LOCATE(',', v.`velo_contrib`) > 0,
     TRIM(BOTH '''' FROM TRIM(SUBSTRING_INDEX(v.`velo_contrib`, ',', -1))),
     '')
FROM `velo` v
WHERE v.`velo_apieduniquement` = 1;

UPDATE `velo` SET `velo_public` = -1
WHERE `velo_apieduniquement` = 1 AND `velo_public` <> -1;
