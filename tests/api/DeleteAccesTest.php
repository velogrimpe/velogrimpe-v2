<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/delete_acces.php : suppression définitive d'un accès falaise (admin) avec sa trace GPX.
 */
final class DeleteAccesTest extends ApiTestCase
{
  private function admin(): array
  {
    return ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']];
  }

  public function testSansTokenRefuse(): void
  {
    $res = $this->httpPostJson('/api/delete_acces.php', ['acces_id' => 1]);
    $this->assertSame(401, $res['status']);
  }

  public function testMauvaisTokenRefuse(): void
  {
    $mauvais = ['Authorization: Bearer mauvais-token'];
    $acces = $this->createFixtureAccesPied($this->createFixtureArret(), $this->createFixtureFalaise());
    $this->assertSame(401, $this->httpPostJson('/api/delete_acces.php', ['acces_id' => $acces], $mauvais)['status']);
    $this->assertSame(401, $this->httpPostMultipart('/api/replace_acces_gpx.php', ['acces_id' => (string) $acces], ['gpx_file' => __DIR__ . '/../fixtures/velo-with-wpt.gpx'], $mauvais)['status']);
    $this->assertSame(401, $this->httpPostJson('/api/delete_acces.php', ['acces_id' => $acces], ['Authorization: Bearer '])['status']);
    $this->assertNotNull(self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE acces_id = $acces"), 'rien ne doit être supprimé');
  }

  public function testMethodeGetRefusee(): void
  {
    $this->assertSame(405, $this->httpGet('/api/delete_acces.php')['status']);
    $this->assertSame(405, $this->httpGet('/api/replace_acces_gpx.php')['status']);
  }

  public function testIdManquantOuInconnu(): void
  {
    $this->assertSame(400, $this->httpPostJson('/api/delete_acces.php', [], $this->admin())['status']);
    $this->assertSame(404, $this->httpPostJson('/api/delete_acces.php', ['acces_id' => 999999999], $this->admin())['status']);
  }

  public function testSupprimeLAccesSonGpxEtJournalise(): void
  {
    $falaise = $this->createFixtureFalaise();
    $arret = $this->createFixtureArret();
    $acces = $this->createFixtureAcces($arret, $falaise, ['variante_formate' => 'phpunit-del']);
    $gpx = dirname(__DIR__, 2) . "/public/gpx/{$acces}_phpunit-depart_phpunit-arrivee_phpunit-del.gpx";
    @mkdir(dirname($gpx), 0755, true);
    file_put_contents($gpx, '<gpx/>');
    $this->cleanupCallbackOnTearDown(fn() => @unlink($gpx));
    $this->cleanupOnTearDown("DELETE FROM edit_logs WHERE collection = 'acces_falaise' AND record_id = $acces");

    $res = $this->httpPostJson('/api/delete_acces.php', ['acces_id' => $acces], $this->admin());

    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertTrue($res['body']['gpx_supprime']);
    $this->assertNull(self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE acces_id = $acces"));
    $this->assertFileDoesNotExist($gpx);
    $log = self::dbQueryOne("SELECT type, author, falaise_id FROM edit_logs WHERE collection = 'acces_falaise' AND record_id = $acces");
    $this->assertSame('delete', $log['type']);
    $this->assertSame('Admin', $log['author']);
    $this->assertSame((string) $falaise, $log['falaise_id']);
  }

  public function testAccesSansGpx(): void
  {
    $acces = $this->createFixtureAccesPied($this->createFixtureArret(), $this->createFixtureFalaise());
    $this->cleanupOnTearDown("DELETE FROM edit_logs WHERE collection = 'acces_falaise' AND record_id = $acces");

    $res = $this->httpPostJson('/api/delete_acces.php', ['acces_id' => $acces], $this->admin());

    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertFalse($res['body']['gpx_supprime']);
    $this->assertNull(self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE acces_id = $acces"));
  }

  // --- api/replace_acces_gpx.php ---------------------------------------------------------------

  private const GPX_FIXTURE = __DIR__ . '/../fixtures/velo-with-wpt.gpx';

  private function remplacer(int $acces, ?string $fichier, bool $auth = true): array
  {
    return $this->httpPostMultipart(
      '/api/replace_acces_gpx.php',
      ['acces_id' => (string) $acces],
      $fichier ? ['gpx_file' => $fichier] : [],
      $auth ? $this->admin() : []
    );
  }

  public function testRemplacementSansTokenRefuse(): void
  {
    $this->assertSame(401, $this->remplacer(1, self::GPX_FIXTURE, false)['status']);
  }

  public function testRemplacementArchiveEtEcritLeGpx(): void
  {
    $acces = $this->createFixtureAcces($this->createFixtureArret(), $this->createFixtureFalaise(), ['variante_formate' => 'phpunit-rep']);
    $nom = "{$acces}_phpunit-depart_phpunit-arrivee_phpunit-rep";
    $gpx = dirname(__DIR__, 2) . "/public/gpx/$nom.gpx";
    @mkdir(dirname($gpx), 0755, true);
    $this->cleanupCallbackOnTearDown(function () use ($gpx, $nom) {
      @unlink($gpx);
      array_map('unlink', glob(dirname($gpx, 2) . "/gpx-historique/$nom-*.gpx") ?: []);
    });
    $this->cleanupOnTearDown("DELETE FROM edit_logs WHERE collection = 'acces_falaise' AND record_id = $acces");

    // Sans GPX : ajout.
    $res = $this->remplacer($acces, self::GPX_FIXTURE);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame('ajoutée', json_decode($res['raw'], true)['gpx']);
    $this->assertFileExists($gpx);
    $this->assertStringNotContainsString('<wpt', file_get_contents($gpx), 'waypoints retirés');

    // Avec GPX : remplacement, ancienne version archivée.
    file_put_contents($gpx, '<gpx><trk/></gpx>');
    $res = $this->remplacer($acces, self::GPX_FIXTURE);
    $this->assertSame('remplacée', json_decode($res['raw'], true)['gpx']);
    $this->assertNotEmpty(glob(dirname($gpx, 2) . "/gpx-historique/$nom-*.gpx"));
    $this->assertStringNotContainsString('<trk/>', file_get_contents($gpx));
  }

  public function testRemplacementRefuseUnFichierInvalide(): void
  {
    $acces = $this->createFixtureAccesPied($this->createFixtureArret(), $this->createFixtureFalaise());
    $this->assertSame(422, $this->remplacer($acces, __DIR__ . '/../fixtures/not-a-gpx.xml')['status']);
    $this->assertSame(400, $this->remplacer($acces, null)['status']);
    $this->assertSame(404, $this->remplacer(999999999, self::GPX_FIXTURE)['status']);
  }
}
