-- Migration 2 — Arrêts parents / enfants (docs/plan-arrets-parents.md, lot P1).
--
-- `arrets.parent_id` : un arrêt peut être regroupé sous un arrêt « parent » (deux niveaux au plus ; invariant
-- tenu par l'application, MySQL ne sait pas le vérifier). Un arrêt est un parent s'il a des enfants, un enfant
-- s'il a un `parent_id`, un orphelin sinon. Le parent porte `acces_falaise` et `train`, ses enfants gardent
-- `arrets_lignes_transport` et `references_externes`.
-- `arrets.position_manuelle` : position fixée à la main (jamais déplacée par un recalcul de barycentre ni par
-- une mise à jour GTFS).
--
-- Pas de migration de données : les arrêts déjà fusionnés restent des orphelins à plusieurs références.
-- À jouer après 1_unification_arrets.sql. Non rejouable (ADD COLUMN échouerait) :
--   docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/2_arrets_parents.sql

ALTER TABLE `arrets`
  ADD COLUMN `parent_id` int(11) DEFAULT NULL COMMENT 'Arrêt parent (regroupement) ; NULL = parent ou orphelin' AFTER `id`,
  ADD COLUMN `position_manuelle` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = position fixée à la main (jamais recalculée)' AFTER `loc`,
  ADD KEY `parent_id` (`parent_id`),
  ADD CONSTRAINT `arrets_parent_fk` FOREIGN KEY (`parent_id`) REFERENCES `arrets` (`id`);
