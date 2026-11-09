<?php

require_once __DIR__ . '/ApiTestCase.php';

/** api/link_arret_falaise.php : lier / délier un arrêt existant à une falaise. */
final class LinkBusFalaiseTest extends ApiTestCase
{
  public function testMethodNotAllowedOnGet(): void
  {
    $res = $this->httpGet('/api/link_arret_falaise.php');
    $this->assertSame(405, $res['status']);
  }

  public function testLinkThenUnlink(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $link = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'link',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(200, $link['status'], $link['raw']);
    $this->assertTrue($link['body']['success']);
    $this->assertTrue($link['body']['linked']);

    $row = self::dbQueryOne(
      "SELECT 1 AS present FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertNotNull($row, 'la liaison arrêt-falaise doit exister en base après link');

    $unlink = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'unlink',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(200, $unlink['status']);
    $this->assertFalse($unlink['body']['linked']);

    $row = self::dbQueryOne(
      "SELECT 1 AS present FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertNull($row, 'la liaison arrêt-falaise ne doit plus exister après unlink');
  }

  public function testLinkTwiceIsIdempotent(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $payload = [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'link',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ];
    $first = $this->httpPostJson('/api/link_arret_falaise.php', $payload);
    $second = $this->httpPostJson('/api/link_arret_falaise.php', $payload);

    $this->assertSame(200, $first['status']);
    $this->assertSame(200, $second['status']);

    $rows = self::dbQuery(
      "SELECT COUNT(*) AS n FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertSame('1', $rows[0]['n']);
  }

  public function testInvalidActionIsRejected(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'delete-everything',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(400, $res['status']);
  }

  public function testLinkAvecDetailsEnJson(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId, 'falaise_id' => $falaiseId, 'action' => 'link',
      'nom_prenom' => 'Testeur', 'email' => 'test@example.org',
      'description' => 'Par le chemin de ronde', 'km' => 0.8, 'dplus' => 25, 'dmoins' => 5,
    ]);

    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertGreaterThan(0, $res['body']['acces_id']);
    $row = self::dbQueryOne("SELECT description, km, dplus, dmoins FROM acces_falaise WHERE acces_id = {$res['body']['acces_id']}");
    $this->assertSame('Par le chemin de ronde', $row['description']);
    $this->assertEquals(0.8, (float) $row['km']);
    $this->assertSame('25', $row['dplus']);
    $this->assertSame('5', $row['dmoins']);
  }

  public function testLinkAvecGpxEnMultipart(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->httpPostMultipart('/api/link_arret_falaise.php', [
      'arret_id' => (string) $arretId, 'falaise_id' => (string) $falaiseId, 'action' => 'link',
      'nom_prenom' => 'Testeur', 'email' => 'test@example.org', 'km' => '1.1',
    ], ['gpx_file' => __DIR__ . '/../fixtures/velo-with-wpt.gpx']);

    $this->assertSame(200, $res['status'], $res['raw']);
    $acces = self::dbQueryOne("SELECT acces_id, depart_slug, arrivee_slug, km FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $path = dirname(__DIR__, 2) . "/public/gpx/{$acces['acces_id']}_{$acces['depart_slug']}_{$acces['arrivee_slug']}_.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) { if (file_exists($path)) unlink($path); });
    $this->assertFileExists($path);
    $this->assertStringNotContainsString('<wpt', file_get_contents($path));
    $this->assertEquals(1.1, (float) $acces['km']);
  }

  public function testLinkAvecGpxInvalideRepondEnJsonSansRienEcrire(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->httpPostMultipart('/api/link_arret_falaise.php', [
      'arret_id' => (string) $arretId, 'falaise_id' => (string) $falaiseId, 'action' => 'link',
      'nom_prenom' => 'Testeur', 'email' => 'test@example.org',
    ], ['gpx_file' => __DIR__ . '/../fixtures/not-a-gpx.xml']);

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertStringContainsString("n'est pas valide", json_decode($res['raw'], true)['error']);
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"));
  }

  public function testLierUnArretDejaRelieParUnAccesNommeCompleteSansCreerDeDoublon(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    // Comme les accès migrés depuis « à pied uniquement » : variante nommée
    $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'pied', 'variante' => 'Option à pied depuis la gare', 'description' => 'Déjà là']);

    $res = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId, 'falaise_id' => $falaiseId, 'action' => 'link',
      'nom_prenom' => 'Testeur', 'email' => 'test@example.org', 'km' => 2.5, 'description' => 'Ignorée',
    ]);

    $this->assertSame(200, $res['status'], $res['raw']);
    $rows = self::dbQuery("SELECT variante, description, km FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertCount(1, $rows, 'aucun doublon sans variante à côté de l\'accès nommé');
    $this->assertSame('Déjà là', $rows[0]['description'], 'rien d\'écrasé');
    $this->assertEquals(2.5, (float) $rows[0]['km'], 'le champ vide est complété');
  }

  private function gpx(): array
  {
    return ['gpx_file' => __DIR__ . '/../fixtures/velo-with-wpt.gpx'];
  }

  private function champsVelo(int $arretId, int $falaiseId, array $extra = []): array
  {
    return array_merge([
      'arret_id' => (string) $arretId, 'falaise_id' => (string) $falaiseId, 'action' => 'link', 'type' => 'velo',
      'nom_prenom' => 'Testeur', 'email' => 'test@example.org', 'km' => '6.5', 'dplus' => '220', 'dmoins' => '90', 'variante' => 'Par le Nord',
    ], $extra);
  }

  public function testAjouteUnItineraireAVeloAvecVarianteEtTrace(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Gare ajout vélo', 45.1, 5.1, ['ter']);

    $res = $this->httpPostMultipart('/api/link_arret_falaise.php', $this->champsVelo($arretId, $falaiseId, ['description' => 'Piste']), $this->gpx());

    $this->assertSame(200, $res['status'], $res['raw']);
    $row = self::dbQueryOne("SELECT acces_id, type, km, dplus, dmoins, variante, variante_formate, depart_slug, arrivee_slug, public FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertSame('velo', $row['type']);
    $this->assertEquals(6.5, (float) $row['km']);
    $this->assertSame('Par le Nord', $row['variante']);
    $this->assertSame('par-le-nord', $row['variante_formate']);
    $this->assertSame('2', $row['public'], 'à valider');
    $path = dirname(__DIR__, 2) . "/public/gpx/{$row['acces_id']}_{$row['depart_slug']}_{$row['arrivee_slug']}_par-le-nord.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) { if (file_exists($path)) unlink($path); });
    $this->assertFileExists($path);
  }

  public function testItineraireAVeloExigeIndicateursEtTraceEtRefuseUnDoublon(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Gare vélo exigences', 45.1, 5.1, ['ter']);

    $sansGpx = $this->httpPostMultipart('/api/link_arret_falaise.php', $this->champsVelo($arretId, $falaiseId));
    $this->assertSame(400, $sansGpx['status']);
    $this->assertStringContainsString('trace GPX est obligatoire', $sansGpx['raw']);

    $sansKm = $this->httpPostMultipart('/api/link_arret_falaise.php', $this->champsVelo($arretId, $falaiseId, ['km' => '']), $this->gpx());
    $this->assertSame(400, $sansKm['status']);
    $this->assertStringContainsString('distance est obligatoire', $sansKm['raw']);
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE arret_id = $arretId"), 'rien d\'écrit en cas de refus');

    $premier = $this->httpPostMultipart('/api/link_arret_falaise.php', $this->champsVelo($arretId, $falaiseId), $this->gpx());
    $this->assertSame(200, $premier['status'], $premier['raw']);
    $id = (int) self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE arret_id = $arretId")['acces_id'];
    $row = self::dbQueryOne("SELECT depart_slug, arrivee_slug FROM acces_falaise WHERE acces_id = $id");
    $path = dirname(__DIR__, 2) . "/public/gpx/{$id}_{$row['depart_slug']}_{$row['arrivee_slug']}_par-le-nord.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) { if (file_exists($path)) unlink($path); });

    $doublon = $this->httpPostMultipart('/api/link_arret_falaise.php', $this->champsVelo($arretId, $falaiseId), $this->gpx());
    $this->assertSame(409, $doublon['status'], 'même variante : refusé');
    $autre = $this->httpPostMultipart('/api/link_arret_falaise.php', $this->champsVelo($arretId, $falaiseId, ['variante' => 'Par le Sud']), $this->gpx());
    $this->assertSame(200, $autre['status'], 'une autre variante est un autre itinéraire');
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE arret_id = $arretId");
    foreach (self::dbQuery("SELECT acces_id, depart_slug, arrivee_slug FROM acces_falaise WHERE arret_id = $arretId") as $r) {
      $p = dirname(__DIR__, 2) . "/public/gpx/{$r['acces_id']}_{$r['depart_slug']}_{$r['arrivee_slug']}_par-le-sud.gpx";
      $this->cleanupCallbackOnTearDown(function () use ($p) { if (file_exists($p)) unlink($p); });
    }
  }

  public function testVarianteDansLaCleEstStricteMemeVide(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'pied', 'variante' => 'Option nommée', 'description' => 'Existant']);

    // Clé `variante` PRÉSENTE (vide) : l'éditeur demande un accès sans variante, distinct de l'accès nommé
    $res = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId, 'falaise_id' => $falaiseId, 'action' => 'link', 'type' => 'pied', 'variante' => '',
      'nom_prenom' => 'Testeur', 'email' => 'test@example.org', 'description' => 'Nouveau',
    ]);

    $this->assertSame(200, $res['status'], $res['raw']);
    $rows = self::dbQuery("SELECT variante, description FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId ORDER BY acces_id");
    $this->assertSame(['Option nommée', ''], array_column($rows, 'variante'), 'un second accès, pas un complément');
    $this->assertSame('Existant', $rows[0]['description']);
  }

  public function testSupprimerUnSeulAccesSansVeloParSonId(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $a = $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'pied', 'variante' => 'A']);
    $b = $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'pied', 'variante' => 'B']);
    $velo = $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'velo', 'km' => 5, 'variante' => 'V']);
    $payload = fn(int $id) => ['arret_id' => $arretId, 'falaise_id' => $falaiseId, 'action' => 'unlink', 'acces_id' => $id, 'nom_prenom' => 'Testeur', 'email' => 'test@example.org'];

    $res = $this->httpPostJson('/api/link_arret_falaise.php', $payload($a));

    $this->assertSame(200, $res['status'], $res['raw']);
    $restants = array_column(self::dbQuery("SELECT acces_id, type FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"), 'type', 'acces_id');
    ksort($restants);
    $this->assertSame([$b => 'pied', $velo => 'velo'], $restants, 'seul l\'accès demandé disparaît');

    // Un itinéraire à vélo ne se supprime jamais par ici, ni un accès inexistant
    $this->assertSame(404, $this->httpPostJson('/api/link_arret_falaise.php', $payload($velo))['status']);
    $this->assertSame(404, $this->httpPostJson('/api/link_arret_falaise.php', $payload(99999999))['status']);
    $this->assertSame(2, (int) self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE arret_id = $arretId")['n']);
  }
}
