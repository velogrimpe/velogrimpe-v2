-- -------------------------------------------------------------
-- TablePlus 6.1.2(568)
--
-- https://tableplus.com/
--
-- Database: u829510062_bdd
-- Generation Time: 2026-09-24 15:40:40.6160
-- -------------------------------------------------------------


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


CREATE TABLE `bus_arrets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `loc` point NOT NULL COMMENT 'Localisation de l''arrêt',
  `nom` text NOT NULL COMMENT 'Nom de l''arrêt',
  `description` text DEFAULT NULL COMMENT 'Commentaire sur l''arrêt lui-même',
  `osm_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Données issues d''Overpass' CHECK (json_valid(`osm_data`)),
  `osm_id` varchar(64) DEFAULT NULL COMMENT 'Id OSM quand issu d''Overpass (ex: way/12345)',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `contrib` text NOT NULL COMMENT 'Contributeur',
  `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
  PRIMARY KEY (`id`),
  UNIQUE KEY `osm_id` (`osm_id`),
  SPATIAL KEY `loc` (`loc`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bus_arrets_falaise` (
  `arret_id` int(11) NOT NULL,
  `falaise_id` smallint(6) NOT NULL,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `contrib` text NOT NULL COMMENT 'Contributeur',
  `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
  PRIMARY KEY (`arret_id`,`falaise_id`),
  KEY `falaise_id` (`falaise_id`),
  CONSTRAINT `bus_arrets_falaise_ibfk_1` FOREIGN KEY (`arret_id`) REFERENCES `bus_arrets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bus_arrets_falaise_ibfk_2` FOREIGN KEY (`falaise_id`) REFERENCES `falaises` (`falaise_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bus_liaisons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `arret_1_id` int(11) NOT NULL,
  `arret_2_id` int(11) NOT NULL,
  `ligne_id` int(11) NOT NULL,
  `arret_min` int(11) GENERATED ALWAYS AS (least(`arret_1_id`,`arret_2_id`)) STORED COMMENT 'Normalisation pour unicité non-orientée',
  `arret_max` int(11) GENERATED ALWAYS AS (greatest(`arret_1_id`,`arret_2_id`)) STORED COMMENT 'Normalisation pour unicité non-orientée',
  `shape` linestring DEFAULT NULL COMMENT 'Tracé de la liaison (optionnel)',
  `description` text DEFAULT NULL COMMENT 'Description de la liaison',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `contrib` text NOT NULL COMMENT 'Contributeur',
  `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
  PRIMARY KEY (`id`),
  UNIQUE KEY `liaison_unique` (`arret_min`,`arret_max`,`ligne_id`),
  KEY `arret_1_id` (`arret_1_id`),
  KEY `arret_2_id` (`arret_2_id`),
  KEY `ligne_id` (`ligne_id`),
  CONSTRAINT `bus_liaisons_ibfk_1` FOREIGN KEY (`arret_1_id`) REFERENCES `bus_arrets` (`id`),
  CONSTRAINT `bus_liaisons_ibfk_2` FOREIGN KEY (`arret_2_id`) REFERENCES `bus_arrets` (`id`),
  CONSTRAINT `bus_liaisons_ibfk_3` FOREIGN KEY (`ligne_id`) REFERENCES `bus_lignes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bus_lignes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` text NOT NULL COMMENT 'Nom de la ligne avec transporteur (ex: Zou! L12)',
  `description` text DEFAULT NULL COMMENT 'Description de la ligne',
  `lien` text DEFAULT NULL COMMENT 'Lien vers les horaires',
  `shape` multilinestring DEFAULT NULL COMMENT 'Tracé de la ligne (optionnel)',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `contrib` text NOT NULL COMMENT 'Contributeur',
  `contrib_mail` text NOT NULL COMMENT 'Mail du contributeur',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cartotrain_emport` (
  `emport_id` smallint(6) NOT NULL AUTO_INCREMENT,
  `type_train` varchar(255) NOT NULL,
  `compagnie_region` varchar(255) NOT NULL,
  `regle_demonte` text DEFAULT NULL,
  `regle_nondemonte` text DEFAULT NULL,
  `source1` text DEFAULT NULL,
  `source2` text DEFAULT NULL,
  PRIMARY KEY (`emport_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `commentaires_falaises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `falaise_id` smallint(6) NOT NULL,
  `velo_id` smallint(6) DEFAULT NULL,
  `ville_nom` text DEFAULT NULL,
  `gare_depart` text DEFAULT NULL,
  `gare_arrivee` text DEFAULT NULL,
  `nom` text DEFAULT NULL,
  `email` text DEFAULT NULL,
  `commentaire` text DEFAULT NULL,
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `falaise_id` (`falaise_id`),
  KEY `velo_id` (`velo_id`),
  CONSTRAINT `commentaires_falaises_ibfk_1` FOREIGN KEY (`falaise_id`) REFERENCES `falaises` (`falaise_id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `edit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` timestamp NOT NULL DEFAULT current_timestamp(),
  `type` varchar(24) NOT NULL DEFAULT '',
  `collection` varchar(64) NOT NULL,
  `record_id` int(11) NOT NULL,
  `author` text NOT NULL,
  `author_email` text NOT NULL,
  `changes` text NOT NULL DEFAULT '{}',
  `falaise_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1990 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exclusions_villes_falaises` (
  `id` smallint(6) NOT NULL AUTO_INCREMENT,
  `ville_id` smallint(6) NOT NULL,
  `falaise_id` smallint(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=572 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exclusions_villes_gares` (
  `id` smallint(6) NOT NULL AUTO_INCREMENT,
  `ville_id` smallint(6) NOT NULL,
  `gare_id` smallint(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=385 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `exclusions_villes_gares_falaises` (
  `id` smallint(6) NOT NULL AUTO_INCREMENT,
  `ville_id` smallint(6) NOT NULL,
  `gare_id` smallint(6) NOT NULL,
  `falaise_id` smallint(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `falaises` (
  `falaise_id` smallint(6) NOT NULL AUTO_INCREMENT COMMENT 'Numéro d''identifiant de la falaise (auto)',
  `falaise_nom` text NOT NULL COMMENT 'Nom de la falaise',
  `falaise_nomformate` text NOT NULL COMMENT 'Nom formaté de la falaise (pas de caractères spéciaux, espaces etc)',
  `falaise_latlng` text NOT NULL COMMENT 'Localisation de la falaise en LatLng ex: 45.1234,6.2355',
  `falaise_altitude` smallint(6) DEFAULT NULL,
  `falaise_zone` smallint(6) NOT NULL DEFAULT -1 COMMENT 'Zone géographique',
  `falaise_cotmin` text DEFAULT NULL COMMENT 'Exemple : 6-,6+,7-,7+...',
  `falaise_cotmax` text DEFAULT NULL COMMENT 'Ex : 6-,6+,7-,7+...',
  `falaise_cottxt` text NOT NULL COMMENT 'Champ à bientôt supprimer.',
  `falaise_exposhort1` text NOT NULL COMMENT 'Ex : ''S'',''SE''',
  `falaise_exposhort2` text NOT NULL COMMENT 'Ex : ''S'',''SE''',
  `falaise_expotxt` text NOT NULL COMMENT 'Exposition',
  `falaise_nbvoies` smallint(6) DEFAULT NULL COMMENT 'Rentrer un nombre, exact ou approximatif.',
  `falaise_voies` text NOT NULL COMMENT 'Descriptif des voies : secteurs, hauteur max, cotations...',
  `falaise_topo` text NOT NULL COMMENT 'Nom du topo',
  `falaise_matxt` text NOT NULL COMMENT 'Descr marche approche',
  `falaise_maa` int(11) DEFAULT NULL COMMENT 'Tps de marche d''approche aller, en minutes',
  `falaise_mar` int(11) DEFAULT NULL COMMENT 'Tps de marche d''approche retour, en minutes',
  `falaise_gvtxt` text NOT NULL COMMENT 'Bref descriptif  des grandes voies.',
  `falaise_gvnb` text NOT NULL COMMENT 'Texte très court décrivant les GV, pour le tableau',
  `falaise_bloc` smallint(6) DEFAULT NULL COMMENT '0=pas de bloc, 1=bloc, 2=psicobloc',
  `falaise_rq` text NOT NULL COMMENT 'Remarques sur la falaise',
  `falaise_voletcarto` text NOT NULL COMMENT 'Bref text descriptif falaise (pour volet carto)',
  `falaise_txt1` text DEFAULT NULL COMMENT 'Opt : rq après les tableaux itinéraires',
  `falaise_txt2` text DEFAULT NULL COMMENT 'Opt : rq après le tableau falaise',
  `falaise_leg1` text NOT NULL COMMENT 'légende carte globale',
  `falaise_txt3` text NOT NULL COMMENT 'Opt : texte après carte globale',
  `falaise_leg2` text NOT NULL COMMENT 'Opt : légende après l''img1 opt',
  `falaise_txt4` text NOT NULL COMMENT 'Opt : texte supplémentaire',
  `falaise_leg3` text NOT NULL COMMENT 'Opt : légende après l''img2 opt',
  `falaise_fermee` text NOT NULL DEFAULT '' COMMENT 'Ecire explications pk falaise fermée',
  `falaise_public` int(11) NOT NULL COMMENT '1=validée,2=contrib non vérifiée,3=hors topo\r\n',
  `falaise_contrib` varchar(256) NOT NULL COMMENT 'Nom/mail du contributeur',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Date de création de la falaise',
  `date_modification` timestamp NULL DEFAULT NULL COMMENT 'Date de dernière modification de la falaise',
  `falaise_zonename` varchar(255) DEFAULT NULL,
  `falaise_deptcode` varchar(10) DEFAULT NULL,
  `falaise_deptname` varchar(255) DEFAULT NULL,
  `falaise_acces_bus` text DEFAULT NULL,
  `falaise_hebergement` text DEFAULT NULL,
  PRIMARY KEY (`falaise_id`)
) ENGINE=InnoDB AUTO_INCREMENT=487 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `falaises_liens` (
  `falaise_id` int(11) NOT NULL COMMENT 'falaise velogrimpe',
  `site` text NOT NULL DEFAULT '' COMMENT 'site partenaire',
  `site_id` text NOT NULL DEFAULT '' COMMENT 'identifiant de la falaise sur le site (utilisé pour la recherche de liens)',
  `site_url` text NOT NULL DEFAULT '' COMMENT 'url à utiliser pour rediriger vers la page falaise de ce site',
  `site_name` text DEFAULT NULL COMMENT 'Nom optionnel à utiliser pour l''affichage sur la page falaise quand il y a plusieurs liens pour une même falaise',
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=522 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `gares` (
  `gare_id` smallint(6) NOT NULL AUTO_INCREMENT,
  `gare_nom` text NOT NULL,
  `gare_nomformate` text NOT NULL COMMENT 'Nom formaté de la gare (pas de caractères spéciaux, espaces...)',
  `gare_latlng` text NOT NULL,
  `gare_departement` text DEFAULT NULL,
  `gare_commune` text DEFAULT NULL,
  `gare_codeuic` varchar(64) DEFAULT NULL COMMENT 'Code unique sncf',
  `gare_codeosm` varchar(64) DEFAULT NULL COMMENT 'osm ID pour certaines gares, quand code uic pas disponible',
  `deleted` tinyint(4) NOT NULL DEFAULT 0,
  `gare_tgv` tinyint(4) NOT NULL,
  `gare_com_insee` varchar(10) DEFAULT NULL,
  `gare_com_nom` text DEFAULT NULL,
  `gare_com_cp` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`gare_id`),
  UNIQUE KEY `gares_uic_uniq` (`gare_codeuic`) USING BTREE,
  UNIQUE KEY `gares_osm_uniq` (`gare_codeosm`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6213 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mailing_list` (
  `nom` text DEFAULT NULL,
  `mail` text NOT NULL,
  `confirme` tinyint(1) DEFAULT 0,
  `desinscrit` tinyint(1) DEFAULT 0,
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `date_inscription` timestamp NOT NULL DEFAULT current_timestamp(),
  `token` text NOT NULL DEFAULT left(uuid(),32),
  `date_desinscription` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `newsletter_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `newsletter_slug` text NOT NULL,
  `mail` text NOT NULL,
  `status` varchar(32) NOT NULL,
  `last_attempt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=226 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `newsletters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(255) NOT NULL,
  `title` varchar(512) NOT NULL,
  `description` text DEFAULT NULL,
  `date_label` varchar(128) DEFAULT NULL,
  `status` enum('draft','published','sent') NOT NULL DEFAULT 'draft',
  `sections` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`sections`)),
  `date_creation` timestamp NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `date_sent` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(120) NOT NULL,
  `title` varchar(255) NOT NULL,
  `short_title` varchar(60) DEFAULT NULL,
  `banner_img` varchar(255) DEFAULT NULL,
  `banner_title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` enum('draft','published') DEFAULT 'draft',
  `sections` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`sections`)),
  `date_creation` timestamp NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `participation_requests` (
  `request_id` int(11) NOT NULL AUTO_INCREMENT,
  `sortie_id` int(11) NOT NULL,
  `participant_nom` varchar(255) NOT NULL,
  `participant_email` varchar(255) NOT NULL,
  `participant_telephone` varchar(32) DEFAULT NULL,
  `preferences_contact` text NOT NULL,
  `message` text DEFAULT NULL,
  `request_status` tinyint(4) DEFAULT 2,
  `validation_token` varchar(64) NOT NULL,
  `date_creation` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`request_id`),
  KEY `sortie_id` (`sortie_id`),
  CONSTRAINT `participation_requests_ibfk_1` FOREIGN KEY (`sortie_id`) REFERENCES `sorties` (`sortie_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `rqvillefalaise` (
  `rqvillefalaise_id` smallint(6) NOT NULL AUTO_INCREMENT,
  `ville_id` smallint(6) NOT NULL,
  `falaise_id` smallint(6) NOT NULL,
  `rqvillefalaise_txt` text NOT NULL,
  PRIMARY KEY (`rqvillefalaise_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sorties` (
  `sortie_id` int(11) NOT NULL AUTO_INCREMENT,
  `organisateur_nom` varchar(255) NOT NULL,
  `organisateur_email` varchar(255) NOT NULL,
  `ville_depart` varchar(255) NOT NULL,
  `ville_id` smallint(6) DEFAULT NULL,
  `falaise_principale_nom` varchar(255) NOT NULL,
  `falaise_principale_id` smallint(6) DEFAULT NULL,
  `falaises_alternatives` text DEFAULT NULL,
  `velo_nom` varchar(255) DEFAULT NULL,
  `velo_id` smallint(6) DEFAULT NULL,
  `lien_groupe` text NOT NULL,
  `description` text NOT NULL,
  `date_debut` date NOT NULL,
  `date_fin` date DEFAULT NULL,
  `sortie_public` tinyint(4) DEFAULT 1,
  `nb_interesses` int(11) DEFAULT 0,
  `edit_token` varchar(64) NOT NULL,
  `delete_token` varchar(64) NOT NULL,
  `date_creation` timestamp NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`sortie_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `train` (
  `train_id` smallint(6) NOT NULL AUTO_INCREMENT,
  `ville_id` smallint(6) NOT NULL,
  `gare_id` smallint(6) NOT NULL,
  `train_depart` text NOT NULL COMMENT 'Pour avoir la gare de départ en toutes lettres',
  `train_arrivee` text NOT NULL COMMENT 'Pour avoir la gare de d''arrivée en toutes lettres',
  `train_temps` int(255) DEFAULT NULL COMMENT 'temps de trajet minimal en train',
  `train_correspmin` smallint(6) DEFAULT NULL COMMENT 'nb de corresp minimal',
  `train_correspmax` smallint(6) DEFAULT NULL COMMENT 'nb de corresp maximal',
  `train_descr` text NOT NULL COMMENT 'Descriptif itinéraire train',
  `train_public` int(11) NOT NULL,
  `train_contrib` varchar(256) NOT NULL COMMENT 'Nom/mail du contributeur',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NULL DEFAULT NULL,
  `train_tgv` tinyint(1) NOT NULL DEFAULT 0,
  `train_tempsmax` smallint(6) DEFAULT NULL,
  `train_nbparjour` smallint(6) DEFAULT NULL,
  PRIMARY KEY (`train_id`)
) ENGINE=InnoDB AUTO_INCREMENT=238 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `velo` (
  `velo_id` smallint(6) NOT NULL AUTO_INCREMENT,
  `gare_id` smallint(6) NOT NULL,
  `falaise_id` smallint(6) NOT NULL,
  `velo_depart` text NOT NULL COMMENT 'Gare de départ, nom formaté',
  `velo_arrivee` text NOT NULL COMMENT 'Falaise d''arrivée, nom formaté',
  `velo_km` float DEFAULT NULL COMMENT 'Nb km, juste le nb',
  `velo_dplus` int(11) DEFAULT NULL COMMENT 'D+, juste le nb',
  `velo_dmoins` int(11) DEFAULT NULL COMMENT 'D-, juste le nb',
  `velo_descr` text NOT NULL COMMENT 'Descriptif vélo',
  `velo_openrunner` text DEFAULT NULL,
  `velo_variante` text NOT NULL COMMENT 'Nom de la variante',
  `velo_varianteformate` text NOT NULL,
  `velo_apieduniquement` smallint(6) NOT NULL DEFAULT 0 COMMENT '1 si itinéraire à pied uniquement, 0 si faisable à vélo',
  `velo_apiedpossible` int(11) DEFAULT NULL COMMENT '0 par défaut, 1 si trajet possible à vélo ou à pied',
  `velo_public` int(11) NOT NULL,
  `velo_contrib` varchar(256) NOT NULL COMMENT 'Nom/mail du contributeur',
  `date_creation` timestamp NOT NULL DEFAULT current_timestamp(),
  `date_modification` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`velo_id`)
) ENGINE=InnoDB AUTO_INCREMENT=582 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `villes` (
  `ville_id` smallint(6) NOT NULL AUTO_INCREMENT,
  `ville_nom` text NOT NULL,
  `ville_tableau` int(11) NOT NULL DEFAULT 0 COMMENT '1 si la ville apparait dans le tableau, 0 sinon',
  PRIMARY KEY (`ville_id`),
  UNIQUE KEY `unique_nom` (`ville_nom`) USING HASH
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;