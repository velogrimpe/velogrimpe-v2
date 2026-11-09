-- Migration 7 — suppression des anciennes tables bus / accès piéton / gares (Lot 9 du plan).
--
-- Plus aucune lecture ni écriture par le code (Lots 7, 8, 8quater, 9) :
--   * bus_liaisons, bus_lignes     → remplacées par lignes_transport / arrets_lignes_transport (Lot 7)
--   * bus_arrets_falaise, bus_arrets → remplacées par arrets + acces_falaise (Lots 1 et 8)
--   * acces_pieton_falaise         → fusionnée dans acces_falaise, type 'pied' (Lot 8quater)
--   * gares                       → remplacée par arrets (Lots 1 et 8bis) ; ses ex-lecteurs lisent `arrets`
--     (gare_id == arrets.id). Perdu à la suppression : le nom du département (gare_departement).
--
-- IRRÉVERSIBLE. Avant de la jouer en production :
--   1. faire une sauvegarde de la base (mysqldump) ;
--   2. relire docs/archive-bus-lignes-liaisons.md (lignes et liaisons de bus de la base de dev, en clair).
--
-- Ordre : d'abord les tables qui portent des clés étrangères (bus_liaisons → bus_lignes,
-- bus_arrets_falaise → bus_arrets). Rejouable (IF EXISTS).
--
-- Rejeu : docker exec -i velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd < sql_migrations/7_drop_anciennes_tables_bus.sql

DROP TABLE IF EXISTS `bus_liaisons`;
DROP TABLE IF EXISTS `bus_arrets_falaise`;
DROP TABLE IF EXISTS `bus_lignes`;
DROP TABLE IF EXISTS `bus_arrets`;
DROP TABLE IF EXISTS `acces_pieton_falaise`;
DROP TABLE IF EXISTS `gares`;
