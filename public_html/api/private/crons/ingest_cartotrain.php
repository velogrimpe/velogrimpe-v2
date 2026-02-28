<?php

/**
 * Cron: Ingestion du fichier cartotrain/tableau.xlsx -> table cartotrain_emport
 * Lit le fichier XLSX, parse les données et les stocke en BDD.
 *
 * Table créée automatiquement si inexistante :
 *   CREATE TABLE cartotrain_emport (
 *     emport_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
 *     type_train varchar(255) NOT NULL,
 *     compagnie_region varchar(255) NOT NULL,
 *     regle_demonte text,
 *     regle_nondemonte text,
 *     source1 text,
 *     source2 text
 *   );
 */

$config = require $_SERVER['DOCUMENT_ROOT'] . '/../config.php';

// Auth
$headers = getallheaders();
$authHeader = $headers['authorization'] ?? $headers['Authorization'] ?? null;
if (!$authHeader || $authHeader !== 'Bearer ' . $config['vg_token']) {
  http_response_code(401);
  echo json_encode(['success' => false, 'error' => 'Unauthorized']);
  exit;
}

// GET only
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['error' => 'Method Not Allowed']);
  exit;
}

header('Content-Type: application/json');

require_once $_SERVER['DOCUMENT_ROOT'] . '/database/velogrimpe.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/lib/SimpleXLSX.php';

use Shuchkin\SimpleXLSX;

// Créer la table si elle n'existe pas
$mysqli->query("CREATE TABLE IF NOT EXISTS cartotrain_emport (
  emport_id smallint(6) PRIMARY KEY AUTO_INCREMENT,
  type_train varchar(255) NOT NULL,
  compagnie_region varchar(255) NOT NULL,
  regle_demonte text,
  regle_nondemonte text,
  source1 text,
  source2 text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Parser le fichier XLSX
$xlsxPath = $_SERVER['DOCUMENT_ROOT'] . '/bdd/cartotrain/tableau.xlsx';
if (!file_exists($xlsxPath)) {
  http_response_code(404);
  echo json_encode(['success' => false, 'error' => 'Fichier tableau.xlsx introuvable']);
  exit;
}

$xlsx = SimpleXLSX::parse($xlsxPath);
if (!$xlsx) {
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Erreur parsing XLSX: ' . SimpleXLSX::parseError()]);
  exit;
}

// Refresh complet : vider puis réinsérer
$mysqli->query("TRUNCATE TABLE cartotrain_emport");

$rows = $xlsx->rows();
$lastTypeTrain = '';
$inserted = 0;
$skipped = 0;

// Colonnes (0-indexées) :
// 0: type_train (cellules fusionnées → reporter la dernière valeur non vide)
// 1: compagnie_region
// 2: regle_demonte (opt)
// 3: regle_nondemonte (opt)
// 4: lien Source (ignoré)
// 5: vide (ignoré)
// 6: url source 1 (opt)
// 7: url source 2 (opt)

$stmt = $mysqli->prepare("INSERT INTO cartotrain_emport
  (type_train, compagnie_region, regle_demonte, regle_nondemonte, source1, source2)
  VALUES (?, ?, ?, ?, ?, ?)");

// Sauter la ligne d'en-tête (row 0)
for ($i = 1; $i < count($rows); $i++) {
  $row = $rows[$i];

  $typeTrain = trim($row[0] ?? '');
  $compagnieRegion = trim($row[1] ?? '');

  // Cellules fusionnées : reporter le dernier type_train non vide
  if ($typeTrain !== '') {
    $lastTypeTrain = $typeTrain;
  } else {
    $typeTrain = $lastTypeTrain;
  }

  // Ignorer les lignes sans compagnie
  if ($compagnieRegion === '') {
    $skipped++;
    continue;
  }

  $regleDemonte = trim($row[2] ?? '') ?: null;
  $regleNondemonte = trim($row[3] ?? '') ?: null;
  $source1 = trim($row[6] ?? '') ?: null;
  $source2 = trim($row[7] ?? '') ?: null;

  $stmt->bind_param('ssssss', $typeTrain, $compagnieRegion, $regleDemonte, $regleNondemonte, $source1, $source2);
  $stmt->execute();
  $inserted++;
}

$stmt->close();

echo json_encode([
  'success' => true,
  'message' => 'Ingestion cartotrain terminée',
  'inserted' => $inserted,
  'skipped' => $skipped,
]);
