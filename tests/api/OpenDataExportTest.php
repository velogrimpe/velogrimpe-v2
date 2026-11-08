<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8quater : l'export open data (cron export_open_data.php) lit `acces_falaise`.
 * Les clés `velo_id` du GeoJSON publié sont renommées `acces_id` (décision Yoann,
 * changement visible pour les consommateurs externes). Les accès de type `pied`
 * ne sont pas des tracés : ils n'apparaissent pas dans itineraires-velo.geojson.
 */
final class OpenDataExportTest extends ApiTestCase
{
  private function lancerExport(): array
  {
    $config = require dirname(__DIR__, 2) . '/config.php';
    $ch = curl_init(VG_TEST_BASE_URL . '/api/private/crons/export_open_data.php');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $config['vg_token']]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 240);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $this->assertSame(200, $status, (string) $raw);
    return json_decode($raw, true);
  }

  public function testLesClesVeloIdSontRenommeesEnAccesId(): void
  {
    $bilan = $this->lancerExport();
    $this->assertSame('success', $bilan['status']);

    foreach ($bilan['itineraires_velo_sans_gpx_details'] as $d) {
      $this->assertArrayHasKey('acces_id', $d);
      $this->assertArrayNotHasKey('velo_id', $d);
    }

    $fichier = dirname(__DIR__, 2) . '/public/open-data/itineraires-velo.geojson';
    $this->assertFileExists($fichier);
    $geo = json_decode(file_get_contents($fichier), true);
    $this->assertNotEmpty($geo['features'], 'au moins un tracé exporté (BDD de dev avec GPX)');
    foreach ($geo['features'] as $f) {
      $this->assertArrayHasKey('acces_id', $f['properties']);
      $this->assertArrayNotHasKey('velo_id', $f['properties']);
      $this->assertArrayHasKey('a_pied_possible', $f['properties']);
    }
  }

  public function testLesAccesAPiedNeSontPasDesItinerairesVelo(): void
  {
    $bilan = $this->lancerExport();
    $velos = self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE type = 'velo' AND public >= 0");
    $this->assertSame((int) $velos['n'], $bilan['itineraires_velo'] + $bilan['itineraires_velo_sans_gpx'], 'seuls les accès vélo sont exportés comme itinéraires');
  }
}
