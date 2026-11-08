<?php
header('Content-Type: application/json');
require_once $_SERVER['DOCUMENT_ROOT'] . '/database/velogrimpe.php';

// `gare_id` reste accepté (anciens appelants).
$arret_id = $_GET['arret_id'] ?? $_GET['gare_id'] ?? null;
if (!isset($_GET['falaise_id']) || $arret_id === null) {
  echo json_encode(["error" => "ID manquant"]);
  exit;
}

$stmt = $mysqli->prepare("SELECT acces_id FROM acces_falaise WHERE type = 'velo' AND falaise_id = ? AND arret_id = ?");
$stmt->execute([$_GET['falaise_id'], $arret_id]);
$velo = $stmt->fetch();

if ($velo) {
  echo json_encode(true);
} else {
  echo json_encode(false);
}
?>