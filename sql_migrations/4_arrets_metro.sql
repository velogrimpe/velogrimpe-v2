-- Migration 4 — Modalité « métro » sur les arrêts (colonne `arrets.metro`, à côté de ter/tgv/bus/tram/teleph).
--
-- Aucune donnée à migrer : les arrêts existants restent à 0. À jouer après 2_arrets_parents.sql.
-- Non rejouable (ADD COLUMN échouerait) :
--   docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/4_arrets_metro.sql

ALTER TABLE `arrets`
  ADD COLUMN `metro` tinyint(1) NOT NULL DEFAULT 0 AFTER `tram`;
