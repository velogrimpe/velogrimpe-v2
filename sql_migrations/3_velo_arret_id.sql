-- Migration 3 — velo.gare_id devient velo.arret_id, clé vers `arrets` (Lot 5 du plan).
--
-- Un itinéraire vélo part désormais d'un arrêt quelconque (gare, mais aussi
-- car qui prend les vélos). Aucune donnée à remapper : les ids de gares n'ont
-- pas été décalés au Lot 1, donc pour les itinéraires existants
-- `arrets.id == ancien gare_id`. Vérification préalable (doit renvoyer 0) :
--   SELECT COUNT(*) FROM velo v LEFT JOIN arrets a ON a.id = v.gare_id WHERE a.id IS NULL;
--
-- Colonne élargie en int(11) pour correspondre à arrets.id (prérequis de la FK).
-- Pas de ON DELETE CASCADE : supprimer un arrêt ne doit pas effacer d'itinéraires.
--
-- Migration ponctuelle, non rejouable telle quelle (le CHANGE COLUMN échouerait).
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/3_velo_arret_id.sql

ALTER TABLE `velo`
  CHANGE COLUMN `gare_id` `arret_id` int(11) NOT NULL,
  MODIFY COLUMN `velo_depart` text NOT NULL COMMENT 'Arrêt de départ, nom formaté',
  ADD KEY `arret_id` (`arret_id`),
  ADD CONSTRAINT `velo_ibfk_arret` FOREIGN KEY (`arret_id`) REFERENCES `arrets` (`id`);
