-- Migration 5 — Lien vers le fichier GTFS d'une ligne (colonne `lignes_transport.gtfs_url`).
--
-- Aucune donnée à migrer : les lignes existantes restent à NULL. À jouer après 4_arrets_metro.sql.
-- Non rejouable (ADD COLUMN échouerait) :
--   docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/5_lignes_gtfs_url.sql

ALTER TABLE `lignes_transport`
  ADD COLUMN `gtfs_url` text DEFAULT NULL COMMENT 'URL du fichier GTFS de la ligne' AFTER `horaire_url`;
