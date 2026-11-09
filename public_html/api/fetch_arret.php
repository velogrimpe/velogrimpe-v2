<?php
header('Content-Type: application/json');
require_once $_SERVER['DOCUMENT_ROOT'] . '/database/velogrimpe.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/lib/arrets_lib.php';

$arret_id = $_GET['arret_id'] ?? '';
if (empty($arret_id)) {
  http_response_code(400);
  die(json_encode(["error" => "Un id d'arrêt est requis"]));
}
$arret_id = (int) $arret_id;

// --- Arrêt ---
$stmt = $mysqli->prepare(
  "SELECT id, nom, description, ter, tgv, bus, tram, teleph, commune, code_insee, cp, ST_Y(loc) AS lat, ST_X(loc) AS lng
   FROM arrets WHERE id = ?"
);
$stmt->bind_param("i", $arret_id);
$stmt->execute();
$arret_row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$arret_row) {
  http_response_code(404);
  die(json_encode(["error" => "Arrêt introuvable"]));
}

// --- Référence externe OSM (source = 'osm', une seule attendue en pratique) ---
$stmt = $mysqli->prepare("SELECT ref, data FROM references_externes WHERE arret_id = ? AND source = 'osm' LIMIT 1");
$stmt->bind_param("i", $arret_id);
$stmt->execute();
$osm_row = $stmt->get_result()->fetch_assoc();
$stmt->close();

$arret = [
  "id" => (int) $arret_row["id"],
  "nom" => $arret_row["nom"],
  "description" => $arret_row["description"],
  "types" => arret_types($arret_row),
  "type_dominant" => arret_type_dominant($arret_row),
  "commune" => $arret_row["commune"],
  "code_insee" => $arret_row["code_insee"],
  "cp" => $arret_row["cp"],
  "osm_id" => $osm_row["ref"] ?? null,
  // data est une colonne JSON : on renvoie l'objet décodé (null si absent)
  "osm_data" => isset($osm_row["data"]) && $osm_row["data"] !== null ? json_decode($osm_row["data"]) : null,
  "loc" => $arret_row["lat"] !== null ? ($arret_row["lat"] . "," . $arret_row["lng"]) : "",
];

// --- Falaises liées ---
$falaise_ids = [];
$stmt = $mysqli->prepare("SELECT falaise_id FROM acces_falaise WHERE type = 'pied' AND arret_id = ?");
$stmt->bind_param("i", $arret_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
  $falaise_ids[] = (int) $row["falaise_id"];
}
$stmt->close();

// --- Accès déjà décrits (vélo / sans vélo) de cet arrêt vers les falaises : le formulaire d'arrêt les indique ---
$acces = [];
$stmt = $mysqli->prepare(
  "SELECT falaise_id, acces_id, type, variante, km, dplus, dmoins, public
   FROM acces_falaise WHERE arret_id = ? AND public >= 0 ORDER BY falaise_id, type DESC, variante, acces_id"
);
$stmt->bind_param("i", $arret_id);
$stmt->execute();
foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $ac) {
  $acces[] = [
    "falaise_id" => (int) $ac["falaise_id"],
    "acces_id" => (int) $ac["acces_id"],
    "type" => $ac["type"],
    "variante" => $ac["variante"],
    "km" => $ac["km"] !== null ? (float) $ac["km"] : null,
    "dplus" => $ac["dplus"] !== null ? (int) $ac["dplus"] : null,
    "dmoins" => $ac["dmoins"] !== null ? (int) $ac["dmoins"] : null,
    "public" => (int) $ac["public"],
  ];
}
$stmt->close();

// --- Liaisons (non orientées : arret_1_id OU arret_2_id = arret courant) ---
$liaisons = [];
$ligne_ids = [];
$stmt = $mysqli->prepare(
  "SELECT l.id, l.arret_1_id, l.arret_2_id, l.ligne_id, l.description,
          li.nom AS ligne_nom,
          CASE WHEN l.arret_1_id = ? THEN l.arret_2_id ELSE l.arret_1_id END AS autre_id,
          a.nom AS autre_nom
   FROM bus_liaisons l
   JOIN bus_lignes li ON li.id = l.ligne_id
   JOIN arrets a ON a.id = CASE WHEN l.arret_1_id = ? THEN l.arret_2_id ELSE l.arret_1_id END
   WHERE l.arret_1_id = ? OR l.arret_2_id = ?"
);
$stmt->bind_param("iiii", $arret_id, $arret_id, $arret_id, $arret_id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
  $liaisons[] = [
    "id" => (int) $row["id"],
    "arret_2_id" => (int) $row["autre_id"],
    "arret_2_nom" => $row["autre_nom"],
    "ligne_id" => (int) $row["ligne_id"],
    "ligne_nom" => $row["ligne_nom"],
    "description" => $row["description"],
  ];
  $ligne_ids[(int) $row["ligne_id"]] = true;
}
$stmt->close();

// --- Lignes distinctes référencées par ces liaisons ---
$lignes = [];
if (!empty($ligne_ids)) {
  $ids = array_keys($ligne_ids);
  $placeholders = implode(",", array_fill(0, count($ids), "?"));
  $types = str_repeat("i", count($ids));
  $stmt = $mysqli->prepare("SELECT id, nom, description, lien FROM bus_lignes WHERE id IN ($placeholders)");
  $stmt->bind_param($types, ...$ids);
  $stmt->execute();
  $res = $stmt->get_result();
  while ($row = $res->fetch_assoc()) {
    $lignes[] = [
      "id" => (int) $row["id"],
      "nom" => $row["nom"],
      "description" => $row["description"],
      "lien" => $row["lien"],
    ];
  }
  $stmt->close();
}

echo json_encode([
  "arret" => $arret,
  "falaise_ids" => $falaise_ids,
  "acces" => $acces,
  "lignes" => $lignes,
  "liaisons" => $liaisons,
]);
