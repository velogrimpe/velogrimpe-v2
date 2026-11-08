<?php
/**
 * Lier / délier un arrêt existant à une falaise (table acces_falaise, type = 'pied').
 *
 * Utilisé depuis l'éditeur de détails falaise : « Cet arrêt est pertinent pour
 * cette falaise ».
 *
 * POST /api/link_arret_falaise.php
 * { "arret_id": 1, "falaise_id": 39, "action": "link"|"unlink",
 *   "nom_prenom": "...", "email": "...",
 *   "description": "...", "km": 1.5, "dplus": 120, "dmoins": 20 }   (description/km/dplus/dmoins facultatifs)
 *
 * Même chose en multipart/form-data, avec en plus un fichier facultatif `gpx_file`
 * (trace GPX de l'accès à pied). Si l'accès existe déjà, seuls les champs encore vides
 * sont renseignés (jamais d'écrasement) : « Lier » sert aussi à compléter.
 * Réponse : { success, linked, acces_id? }.
 */
header('Content-Type: application/json');
$config = require $_SERVER['DOCUMENT_ROOT'] . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  die(json_encode(["error" => "Method not allowed"]));
}

$estMultipart = stripos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') === 0;
$input = $estMultipart ? $_POST : json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
  http_response_code(400);
  die(json_encode(["error" => "Corps de requête JSON invalide"]));
}

$arret_id = isset($input['arret_id']) && $input['arret_id'] !== '' ? (int) $input['arret_id'] : null;
$falaise_id = isset($input['falaise_id']) && $input['falaise_id'] !== '' ? (int) $input['falaise_id'] : null;
$action = trim($input['action'] ?? 'link');
$nom_prenom = trim($input['nom_prenom'] ?? '');
$email = trim($input['email'] ?? '');

if (!$arret_id || !$falaise_id) {
  http_response_code(400);
  die(json_encode(["error" => "arret_id et falaise_id sont requis"]));
}
if (!in_array($action, ['link', 'unlink'], true)) {
  http_response_code(400);
  die(json_encode(["error" => "action invalide (link|unlink attendu)"]));
}
if (empty($nom_prenom) || empty($email)) {
  http_response_code(400);
  die(json_encode(["error" => "Nom et email du contributeur obligatoires"]));
}

require_once $_SERVER['DOCUMENT_ROOT'] . '/database/velogrimpe.php';

// Lookups pour log / mail lisibles
function linkLookupName($mysqli, string $table, string $idCol, string $nameCol, int $id): string
{
  $stmt = $mysqli->prepare("SELECT $nameCol AS n FROM $table WHERE $idCol = ?");
  $stmt->bind_param("i", $id);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  return $row ? (string) $row['n'] : "#$id";
}

$arret_nom = linkLookupName($mysqli, 'arrets', 'id', 'nom', $arret_id);
$falaise_nom = linkLookupName($mysqli, 'falaises', 'falaise_id', 'falaise_nom', $falaise_id);

require_once $_SERVER['DOCUMENT_ROOT'] . '/lib/velo_lib.php';
$acces_id = null;
$resAcces = null;
if ($action === 'link') {
  $arret = velo_trouver_arret($mysqli, $arret_id);
  $falaise = velo_trouver_falaise($mysqli, $falaise_id);
  if ($arret === null || $falaise === null) {
    http_response_code(404);
    die(json_encode(["error" => "Arrêt ou falaise introuvable"]));
  }
  $details = acces_lire_details($input);
  $dom = $estMultipart ? velo_charger_gpx_upload('gpx_file') : null;
  if ($dom !== null) {
    try {
      vg_data_prepare(VELO_GPX_DIR);
    } catch (VgDataException $e) {
      error_log('[link_arret_falaise] ' . $e->getMessage());
      http_response_code(500);
      die(json_encode(["error" => "Dossier des traces GPX indisponible"]));
    }
  }
  $resAcces = acces_pied_enregistrer($mysqli, $arret, $falaise, $details, $dom, $nom_prenom, $email);
  $acces_id = $resAcces['acces_id'];
  $linked = true;
} else {
  acces_pied_delier($mysqli, $arret_id, $falaise_id);
  $linked = false;
}

// --- Log ---
require_once $_SERVER['DOCUMENT_ROOT'] . '/lib/edit_logs.php';
logChanges(
  $nom_prenom,
  $email,
  $action === 'link' ? 'insert' : 'delete',
  'acces_falaise',
  $arret_id,
  $falaise_id,
  ['Arrêt' => $arret_nom, 'Falaise' => $falaise_nom, 'Lien' => $linked ? 'lié' : 'délié']
    + ($resAcces && $resAcces['remplis'] ? ['Champs renseignés' => implode(', ', $resAcces['remplis'])] : [])
);

// --- Réponse (avant l'email) ---
echo json_encode(["success" => true, "linked" => $linked] + ($acces_id ? ["acces_id" => $acces_id] : []));

// --- Email de notification (léger) ---
require_once $_SERVER['DOCUMENT_ROOT'] . '/lib/sendmail.php';
$verbe = $linked ? "lié à" : "délié de";
$subject = "🚌 Arrêt « $arret_nom » $verbe la falaise « $falaise_nom » par $nom_prenom";
$html = "<html><body>";
$html .= "<p>L'arrêt de bus <b>" . htmlspecialchars($arret_nom) . "</b> a été <b>" . ($linked ? "lié" : "délié") . "</b> "
  . ($linked ? "à" : "de") . " la falaise <b>" . htmlspecialchars($falaise_nom) . "</b> par "
  . htmlspecialchars($nom_prenom) . " (" . htmlspecialchars($email) . ").</p>";
$html .= "<p><a href='https://velogrimpe.fr/falaise.php?falaise_id=$falaise_id'>Voir la falaise</a></p>";
$html .= "</body></html>";

try {
  sendMail([
    'to' => $config["contact_mail"],
    'subject' => $subject,
    'html' => $html,
    'h:Reply-To' => $email,
  ]);
} catch (\Throwable $e) {
  error_log('[link_bus_falaise] sendMail failed: ' . $e->getMessage());
}
