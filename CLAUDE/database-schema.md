# Database Schema

## Main tables

```sql
CREATE TABLE falaises (
  falaise_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  falaise_nom text NOT NULL,
  falaise_nomformate text NOT NULL,           -- URL-safe name
  falaise_latlng text NOT NULL,               -- "lat,lng" format
  falaise_zone smallint(6) DEFAULT -1,        -- Geographic zone ID
  falaise_cotmin text,                        -- Min grade (6a, 6b+, etc.)
  falaise_cotmax text,                        -- Max grade
  falaise_exposhort1 text,                    -- Primary exposure (S, SE, etc.)
  falaise_exposhort2 text,                    -- Secondary exposure
  falaise_nbvoies smallint(6),                -- Number of routes
  falaise_maa int(11),                        -- Approach time (minutes)
  falaise_mar int(11),                        -- Return time (minutes)
  falaise_bloc smallint(6),                   -- 0=no, 1=bouldering, 2=psicobloc
  falaise_fermee text DEFAULT '',             -- Closed reason (if any)
  falaise_public int(11),                     -- 1=validated, 2=pending, 3=unofficial
  falaise_contrib varchar(256),               -- Contributor name/email
  falaise_zonename varchar(255),
  falaise_deptcode varchar(10),               -- Department code
  falaise_deptname varchar(255),              -- Department name
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp
);

CREATE TABLE gares (
  gare_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  gare_nom text NOT NULL,
  gare_nomformate text NOT NULL,              -- URL-safe name
  gare_latlng text NOT NULL,                  -- "lat,lng" format
  gare_departement text,
  gare_commune text,
  gare_codeuic varchar(64) UNIQUE,            -- SNCF unique code
  gare_codeosm varchar(64) UNIQUE,            -- OSM ID (fallback)
  gare_tgv tinyint(4) NOT NULL,               -- 1 if TGV station
  deleted tinyint(4) DEFAULT 0
);

CREATE TABLE villes (
  ville_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  ville_nom text NOT NULL UNIQUE,
  ville_tableau int(11) DEFAULT 0             -- 1 if shown in main table
);

CREATE TABLE train (
  train_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  ville_id smallint(6) NOT NULL,              -- FK to villes
  gare_id smallint(6) NOT NULL,               -- FK to gares
  train_depart text NOT NULL,                 -- Departure station name
  train_arrivee text NOT NULL,                -- Arrival station name
  train_temps int(255),                       -- Min travel time (minutes)
  train_tempsmax smallint(6),                 -- Max travel time
  train_correspmin smallint(6),               -- Min transfers
  train_correspmax smallint(6),               -- Max transfers
  train_nbparjour smallint(6),                -- Trains per day
  train_descr text NOT NULL,                  -- Description
  train_tgv tinyint(1) DEFAULT 0,             -- 1 if TGV route
  train_public int(11) NOT NULL,              -- Validation status
  train_contrib varchar(256),
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp
);

CREATE TABLE velo (
  velo_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  gare_id smallint(6) NOT NULL,               -- FK to gares
  falaise_id smallint(6) NOT NULL,            -- FK to falaises
  velo_depart text NOT NULL,                  -- Station name
  velo_arrivee text NOT NULL,                 -- Crag name
  velo_km float,                              -- Distance (km)
  velo_dplus int(11),                         -- Elevation gain (m)
  velo_dmoins int(11),                        -- Elevation loss (m)
  velo_descr text NOT NULL,                   -- Route description
  velo_openrunner text,                       -- OpenRunner URL
  velo_variante text NOT NULL,                -- Variant name
  velo_apieduniquement smallint(6) DEFAULT 0, -- 1 if walking only
  velo_apiedpossible int(11),                 -- 1 if walking possible
  velo_public int(11) NOT NULL,               -- Validation status
  velo_contrib varchar(256),
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp
);
```

### commentaires_falaises (Crag Comments)

User feedback and trip reports.

```sql
CREATE TABLE commentaires_falaises (
  id int(11) PRIMARY KEY AUTO_INCREMENT,
  falaise_id smallint(6) NOT NULL,            -- FK to falaises
  velo_id smallint(6),                        -- Optional FK to velo
  ville_nom text,
  gare_depart text,
  gare_arrivee text,
  nom text,                                   -- Author name
  email text,
  commentaire text,
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp,
  FOREIGN KEY (falaise_id) REFERENCES falaises(falaise_id)
);
```

### Exclusion Tables

Used to hide certain combinations from search results.

```sql
-- Hide crags from specific cities (and do not require train itinerary to the crag linked gares)
CREATE TABLE exclusions_villes_falaises (
  id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  ville_id smallint(6) NOT NULL,
  falaise_id smallint(6) NOT NULL
);

-- Hide stations from specific cities (and do not require train itinerary to the gare)
CREATE TABLE exclusions_villes_gares (
  id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  ville_id smallint(6) NOT NULL,
  gare_id smallint(6) NOT NULL
);

-- Hide specific station-crag combos from cities (and do not require train itinerary to this gare for this crag)
CREATE TABLE exclusions_villes_gares_falaises (
  id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  ville_id smallint(6) NOT NULL,
  gare_id smallint(6) NOT NULL,
  falaise_id smallint(6) NOT NULL
);

-- Geographic zones
CREATE TABLE zones (
  zone_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  zone_nom text NOT NULL
);

-- External links for crags (Oblyk, etc.)
CREATE TABLE falaises_liens (
  id bigint(20) PRIMARY KEY AUTO_INCREMENT,
  falaise_id int(11) NOT NULL,
  site text NOT NULL,                         -- Partner site name
  site_id text NOT NULL,                      -- ID on partner site
  site_url text NOT NULL,                     -- Direct URL
  site_name text                              -- Display name
);

-- Train line geometries for map display
CREATE TABLE trainline (
  id bigint(20) PRIMARY KEY AUTO_INCREMENT,
  nom text NOT NULL,
  linestring LINESTRING NOT NULL              -- Geometry
);

-- Edit history
CREATE TABLE edit_logs (
  id int(11) PRIMARY KEY AUTO_INCREMENT,
  date timestamp DEFAULT CURRENT_TIMESTAMP,
  type varchar(24) NOT NULL,                  -- create/update/delete
  collection varchar(64) NOT NULL,            -- Table name
  record_id int(11) NOT NULL,
  author text NOT NULL,
  author_email text NOT NULL,
  changes text DEFAULT '{}',                  -- JSON diff
  falaise_id int(11)
);

-- Newsletter subscribers
CREATE TABLE mailing_list (
  id bigint(20) PRIMARY KEY AUTO_INCREMENT,
  nom text,
  mail text NOT NULL,
  confirme tinyint(1) DEFAULT 0,
  desinscrit tinyint(1) DEFAULT 0,
  token text NOT NULL,
  date_inscription timestamp DEFAULT CURRENT_TIMESTAMP,
  date_desinscription timestamp
);
```
