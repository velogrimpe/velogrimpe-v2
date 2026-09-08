-- Database initialization script for velogrimpe-v2
-- Idempotent : à rejouer sans risque sur un conteneur neuf ou existant.
-- Ne crée que la structure d'accès (base + utilisateur) ; les données viennent
-- ensuite de l'export de prod (cf. « Re-seed depuis la prod » dans CLAUDE.md).
--
-- Le mot de passe doit rester identique à `db_pass` dans config.php.

CREATE DATABASE IF NOT EXISTS u829510062_bdd
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'u829510062_velogrimpe'@'localhost' IDENTIFIED BY '!NJRXQ]+nV9';

GRANT ALL PRIVILEGES ON u829510062_bdd.* TO 'u829510062_velogrimpe'@'localhost';

FLUSH PRIVILEGES;
