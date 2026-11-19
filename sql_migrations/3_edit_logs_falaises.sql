-- Migration 3 — Collection `falaise` (singulier) de `edit_logs` normalisée en `falaises`.
--
-- `accept_falaise.php` et `backfill_altitudes.php` journalisaient sous « falaise », alors que le reste de
-- l'application (add_falaise, batch-geocode, libellés de admin/edit_logs.php) utilise « falaises ».
-- Rejouable : sans effet une fois les lignes converties.
UPDATE edit_logs SET collection = 'falaises' WHERE collection = 'falaise';
