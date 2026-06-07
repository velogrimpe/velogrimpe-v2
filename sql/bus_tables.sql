-- Tables bus pour velogrimpe
-- Conventions: InnoDB / utf8mb4_unicode_ci, timestamps current_timestamp()
-- Géométries stockées en SRID 0 (renseigner via ST_GeomFromText(..., 4326) à l'insert)
-- Compatible MariaDB (XAMPP 8) et MySQL 8
-- ---------------------------------------------------------------------------
-- bus_arrets : arrêts de bus
-- ---------------------------------------------------------------------------
CREATE TABLE
  `bus_arrets` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `loc` point NOT NULL COMMENT 'Localisation de l''arrêt',
    `nom` text NOT NULL COMMENT 'Nom de l''arrêt',
    `description` text DEFAULT NULL COMMENT 'Commentaire sur l''arrêt lui-même',
    `osm_data` json DEFAULT NULL COMMENT 'Données issues d''Overpass',
    `osm_id` varchar(64) DEFAULT NULL COMMENT 'Id OSM quand issu d''Overpass (ex: way/12345)',
    `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
    `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `contrib` text NOT NULL COMMENT 'Contributeur',
    `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
    PRIMARY KEY (`id`),
    UNIQUE KEY `osm_id` (`osm_id`),
    SPATIAL KEY `loc` (`loc`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- bus_lignes : lignes de bus
-- ---------------------------------------------------------------------------
CREATE TABLE
  `bus_lignes` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `nom` text NOT NULL COMMENT 'Nom de la ligne avec transporteur (ex: Zou! L12)',
    `description` text DEFAULT NULL COMMENT 'Description de la ligne',
    `lien` text DEFAULT NULL COMMENT 'Lien vers les horaires',
    `shape` multilinestring NOT NULL COMMENT 'Tracé de la ligne',
    `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
    `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `contrib` text NOT NULL COMMENT 'Contributeur',
    `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
    PRIMARY KEY (`id`),
    SPATIAL KEY `shape` (`shape`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- bus_arrets_falaise : association arrêt <-> falaise (n-n)
-- ---------------------------------------------------------------------------
CREATE TABLE
  `bus_arrets_falaise` (
    `arret_id` int (11) NOT NULL,
    `falaise_id` smallint (6) NOT NULL,
    `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
    `contrib` text NOT NULL COMMENT 'Contributeur',
    `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
    PRIMARY KEY (`arret_id`, `falaise_id`),
    KEY `falaise_id` (`falaise_id`),
    CONSTRAINT `bus_arrets_falaise_ibfk_1` FOREIGN KEY (`arret_id`) REFERENCES `bus_arrets` (`id`) ON DELETE CASCADE,
    CONSTRAINT `bus_arrets_falaise_ibfk_2` FOREIGN KEY (`falaise_id`) REFERENCES `falaises` (`falaise_id`) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- bus_liaisons : tronçon reliant deux arrêts sur une ligne
-- ---------------------------------------------------------------------------
CREATE TABLE
  `bus_liaisons` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `arret_1_id` int (11) NOT NULL,
    `arret_2_id` int (11) NOT NULL,
    `ligne_id` int (11) NOT NULL,
    `arret_min` int (11) GENERATED ALWAYS AS (LEAST(`arret_1_id`, `arret_2_id`)) STORED COMMENT 'Normalisation pour unicité non-orientée',
    `arret_max` int (11) GENERATED ALWAYS AS (GREATEST(`arret_1_id`, `arret_2_id`)) STORED COMMENT 'Normalisation pour unicité non-orientée',
    `shape` linestring NOT NULL COMMENT 'Tracé de la liaison',
    `description` text DEFAULT NULL COMMENT 'Description de la liaison',
    `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
    `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `contrib` text NOT NULL COMMENT 'Contributeur',
    `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
    PRIMARY KEY (`id`),
    UNIQUE KEY `liaison_unique` (`arret_min`, `arret_max`, `ligne_id`),
    KEY `arret_1_id` (`arret_1_id`),
    KEY `arret_2_id` (`arret_2_id`),
    KEY `ligne_id` (`ligne_id`),
    SPATIAL KEY `shape` (`shape`),
    CONSTRAINT `bus_liaisons_ibfk_1` FOREIGN KEY (`arret_1_id`) REFERENCES `bus_arrets` (`id`),
    CONSTRAINT `bus_liaisons_ibfk_2` FOREIGN KEY (`arret_2_id`) REFERENCES `bus_arrets` (`id`),
    CONSTRAINT `bus_liaisons_ibfk_3` FOREIGN KEY (`ligne_id`) REFERENCES `bus_lignes` (`id`) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;