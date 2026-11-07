-- Migration 2 — Remap des ids de bus_liaisons vers l'espace `arrets` (Lot 2 du plan).
--
-- `bus_liaisons.arret_1_id`/`arret_2_id` référencent aujourd'hui `bus_arrets.id`.
-- Le Lot 1 a copié `bus_arrets` dans `arrets` avec de nouveaux ids (décalés
-- après le dernier id de gare) : cf. `_bus_arrets_id_map` dans
-- `1_arrets_multimodaux.sql`, une table temporaire déjà supprimée. Cette
-- migration reconstruit le même mapping (`ROW_NUMBER() OVER (ORDER BY id)`
-- sur `bus_arrets`, insérés dans le même ordre au Lot 1) et met à jour
-- `bus_liaisons` en place, pour que `add_arret.php`/`fetch_arret.php`/
-- `fetch_arrets.php` (Lot 2) puissent basculer entièrement sur `arrets`
-- sans double-écriture sur `bus_arrets` (décision du 2026-09-26, cf.
-- `docs/plan-implementation-arrets.md`).
--
-- Les FK `bus_liaisons_ibfk_1`/`_2` (vers `bus_arrets.id`) sont remplacées par
-- des FK vers `arrets.id` (même sémantique : pas de `ON DELETE CASCADE`, cf.
-- note `ApiTestCase`) — une FK vers `bus_arrets` n'aurait plus de sens une
-- fois les ids remappés.
--
-- Migration ponctuelle, non rejouable telle quelle (comme la migration 1) :
-- un second passage échouerait sur le DROP FOREIGN KEY (déjà supprimée).
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/2_bus_liaisons_remap.sql

CREATE TEMPORARY TABLE `_bus_liaisons_remap` (
  `old_id` int(11) NOT NULL,
  `new_id` int(11) NOT NULL,
  PRIMARY KEY (`old_id`)
) ENGINE=InnoDB;

SET @offset = (SELECT MIN(id) FROM `arrets` WHERE `bus` = 1);

INSERT INTO `_bus_liaisons_remap` (`old_id`, `new_id`)
SELECT `id`, @offset - 1 + ROW_NUMBER() OVER (ORDER BY `id`)
FROM `bus_arrets`;

ALTER TABLE `bus_liaisons`
  DROP FOREIGN KEY `bus_liaisons_ibfk_1`,
  DROP FOREIGN KEY `bus_liaisons_ibfk_2`;

UPDATE `bus_liaisons` l
JOIN `_bus_liaisons_remap` m ON m.`old_id` = l.`arret_1_id`
SET l.`arret_1_id` = m.`new_id`;

UPDATE `bus_liaisons` l
JOIN `_bus_liaisons_remap` m ON m.`old_id` = l.`arret_2_id`
SET l.`arret_2_id` = m.`new_id`;

ALTER TABLE `bus_liaisons`
  ADD CONSTRAINT `bus_liaisons_ibfk_1` FOREIGN KEY (`arret_1_id`) REFERENCES `arrets` (`id`),
  ADD CONSTRAINT `bus_liaisons_ibfk_2` FOREIGN KEY (`arret_2_id`) REFERENCES `arrets` (`id`);

DROP TEMPORARY TABLE `_bus_liaisons_remap`;
