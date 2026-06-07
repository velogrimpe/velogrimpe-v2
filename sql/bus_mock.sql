-- Données de mock pour les tables bus (falaise_id = 39)
-- Région d'exemple : Pays d'Apt / Buoux (Vaucluse)
-- Géométries en SRID 4326, ordre POINT(longitude latitude)

-- ---------------------------------------------------------------------------
-- bus_arrets
-- ---------------------------------------------------------------------------
INSERT INTO `bus_arrets` (`id`, `loc`, `nom`, `description`, `osm_data`, `osm_id`, `contrib`, `contrib_mail`) VALUES
  (1, ST_GeomFromText('POINT(5.3960 43.8761)', 4326), 'Apt - Gare routière', 'Pôle d''échange principal, correspondance TER par car', NULL, 'node/1234567890', 'yoann', 'yoann@couble.eu'),
  (2, ST_GeomFromText('POINT(5.3830 43.8270)', 4326), 'Buoux - Mairie', 'Arrêt au centre du village, ~30 min à pied de la falaise', NULL, 'node/2345678901', 'yoann', 'yoann@couble.eu'),
  (3, ST_GeomFromText('POINT(5.4000 43.8100)', 4326), 'Sivergues', NULL, NULL, 'node/3456789012', 'marie', 'marie@example.org'),
  (4, ST_GeomFromText('POINT(5.3050 43.8236)', 4326), 'Bonnieux - Village', 'Arrêt scolaire, peu de passages le week-end', NULL, NULL, 'marie', 'marie@example.org');

-- ---------------------------------------------------------------------------
-- bus_lignes
-- ---------------------------------------------------------------------------
INSERT INTO `bus_lignes` (`id`, `nom`, `description`, `lien`, `shape`, `contrib`, `contrib_mail`) VALUES
  (1, 'Zou! L12', 'Apt - Buoux - Sivergues', 'https://zou.maregionsud.fr/se-deplacer/lignes-regionales/ligne-12', ST_GeomFromText('MULTILINESTRING((5.3960 43.8761, 5.3830 43.8270, 5.4000 43.8100))', 4326), 'yoann', 'yoann@couble.eu'),
  (2, 'Zou! L9', 'Apt - Bonnieux', 'https://zou.maregionsud.fr/se-deplacer/lignes-regionales/ligne-9', ST_GeomFromText('MULTILINESTRING((5.3960 43.8761, 5.3050 43.8236))', 4326), 'marie', 'marie@example.org');

-- ---------------------------------------------------------------------------
-- bus_arrets_falaise (falaise_id = 39)
-- ---------------------------------------------------------------------------
INSERT INTO `bus_arrets_falaise` (`arret_id`, `falaise_id`, `contrib`, `contrib_mail`) VALUES
  (2, 39, 'yoann', 'yoann@couble.eu'),
  (3, 39, 'marie', 'marie@example.org');

-- ---------------------------------------------------------------------------
-- bus_liaisons (tronçons entre arrêts, arret_min/arret_max calculés auto)
-- ---------------------------------------------------------------------------
INSERT INTO `bus_liaisons` (`id`, `arret_1_id`, `arret_2_id`, `ligne_id`, `shape`, `description`, `contrib`, `contrib_mail`) VALUES
  (1, 1, 2, 1, ST_GeomFromText('LINESTRING(5.3960 43.8761, 5.3830 43.8270)', 4326), 'Apt → Buoux', 'yoann', 'yoann@couble.eu'),
  (2, 2, 3, 1, ST_GeomFromText('LINESTRING(5.3830 43.8270, 5.4000 43.8100)', 4326), 'Buoux → Sivergues', 'yoann', 'yoann@couble.eu'),
  (3, 1, 4, 2, ST_GeomFromText('LINESTRING(5.3960 43.8761, 5.3050 43.8236)', 4326), 'Apt → Bonnieux', 'marie', 'marie@example.org');
