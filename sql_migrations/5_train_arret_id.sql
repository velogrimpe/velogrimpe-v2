-- Migration 5 — train.gare_id devient train.arret_id, clé vers `arrets` (Lot 8bis du plan).
--
-- Une ville peut être reliée à un arrêt quelconque (gare, mais aussi car,
-- tram…), plus seulement à une gare. Aucune donnée à remapper : les ids de
-- gares n'ont pas été décalés au Lot 1, donc `arrets.id == ancien gare_id`.
-- Vérification préalable (doit renvoyer 0) :
--   SELECT COUNT(*) FROM train t LEFT JOIN arrets a ON a.id = t.gare_id WHERE a.id IS NULL;
--
-- Colonne élargie en int(11) pour correspondre à arrets.id (prérequis de la FK).
-- Pas de ON DELETE CASCADE : supprimer un arrêt ne doit pas effacer d'itinéraires.
-- Les tables `exclusions_villes_gares*` gardent leur colonne `gare_id` (admin).
--
-- Migration ponctuelle, non rejouable telle quelle (le CHANGE COLUMN échouerait).
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/5_train_arret_id.sql

ALTER TABLE `train`
  CHANGE COLUMN `gare_id` `arret_id` int(11) NOT NULL,
  ADD KEY `arret_id` (`arret_id`),
  ADD CONSTRAINT `train_ibfk_arret` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`);
