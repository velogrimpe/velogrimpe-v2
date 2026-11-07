<?php
/**
 * Données embarquées par les cartes globales (carte.php, carte_leaflet.php).
 */
require_once __DIR__ . '/arrets_lib.php';

/**
 * Arrêts (toutes modalités) avec leurs temps de train depuis chaque ville.
 * Clés renvoyées : arret_id, arret_nom, arret_latlng, types, villes (brut).
 *
 * @param bool $garesHorsTopo false : omet les gares (ter/tgv) sans itinéraire ni
 *   accès piéton publiés — MapLibre les rend depuis un PMTiles.
 */
function carte_charger_arrets(mysqli $mysqli, bool $garesHorsTopo = true): array
{
  $filtre = $garesHorsTopo ? '' : "AND (
      (a.ter = 0 AND a.tgv = 0)
      OR a.id IN (SELECT arret_id FROM velo WHERE velo_public >= 1)
      OR a.id IN (SELECT arret_id FROM acces_pieton_falaise)
    )";
  $rows = $mysqli->query("SELECT
    a.id AS arret_id, a.nom AS arret_nom,
    CONCAT(ST_Y(a.loc), ',', ST_X(a.loc)) AS arret_latlng,
    a.ter, a.tgv, a.bus, a.tram, a.teleph,
    GROUP_CONCAT(CONCAT(t.ville_id, '|', t.train_depart, '|', t.train_temps, '|', t.train_correspmin, '|', COALESCE(t.train_tgv, 0)) SEPARATOR '=|=') AS villes
    FROM arrets a
    LEFT JOIN train t ON t.arret_id = a.id
    WHERE a.deleted = 0 $filtre
    GROUP BY a.id")->fetch_all(MYSQLI_ASSOC);
  return array_map(function ($r) {
    $r['arret_id'] = (int) $r['arret_id'];
    $r['types'] = arret_types($r);
    unset($r['ter'], $r['tgv'], $r['bus'], $r['tram'], $r['teleph']);
    return $r;
  }, $rows);
}

/** Itinéraires vélo publiés, depuis n'importe quel arrêt. */
function carte_charger_itineraires(mysqli $mysqli): array
{
  // Envoyé tel quel au JS : liste explicite de colonnes, jamais de SELECT *
  // (velo_contrib porte un email). Les accès « à pied uniquement » sont dans
  // acces_pieton_falaise (Lot 8), pas dans velo.
  $rows = $mysqli->query("SELECT
    v.falaise_id, v.arret_id, v.velo_apiedpossible, v.velo_arrivee,
    v.velo_depart, v.velo_dplus, v.velo_id, v.velo_km, v.velo_varianteformate
    FROM velo v
    JOIN arrets a ON a.id = v.arret_id AND a.deleted = 0
    WHERE v.velo_public >= 1")->fetch_all(MYSQLI_ASSOC);
  return array_map(function ($r) {
    $r['arret_id'] = (int) $r['arret_id'];
    return $r;
  }, $rows);
}

/** Accès piéton arrêt → falaise (falaises publiées, arrêts non supprimés). */
function carte_charger_acces_pieton(mysqli $mysqli): array
{
  $rows = $mysqli->query("SELECT p.arret_id, p.falaise_id
    FROM acces_pieton_falaise p
    JOIN arrets a ON a.id = p.arret_id AND a.deleted = 0
    JOIN falaises f ON f.falaise_id = p.falaise_id AND f.falaise_public >= 1")->fetch_all(MYSQLI_ASSOC);
  return array_map(fn($r) => ['arret_id' => (int) $r['arret_id'], 'falaise_id' => $r['falaise_id']], $rows);
}
