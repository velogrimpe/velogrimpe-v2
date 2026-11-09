<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/fetch_arrets.php : liste des arrêts pour l'éditeur de détails falaise
 * (bbox + arrêts liés à la falaise, même hors bbox).
 */
final class FetchBusArretsTest extends ApiTestCase
{
  public function testMissingFalaiseIdIsRejected(): void
  {
    $res = $this->httpGet('/api/fetch_arrets.php');
    $this->assertSame(400, $res['status']);
  }

  public function testReturnsArretsInBboxAndLinkedArretsOutsideBbox(): void
  {
    $falaiseId = $this->createFixtureFalaise();

    // Dans la bbox, non lié à la falaise
    $inBboxUnlinked = $this->createFixtureArret('PHPUnit In Bbox Unlinked', 43.8270, 5.3830);
    // Dans la bbox, lié à la falaise
    $inBboxLinked = $this->createFixtureArret('PHPUnit In Bbox Linked', 43.8280, 5.3840);
    $this->createFixtureAccesPied($inBboxLinked, $falaiseId);
    // Hors bbox, mais lié à la falaise : doit quand même apparaître
    $outsideBboxLinked = $this->createFixtureArret('PHPUnit Outside Bbox Linked', 10.0, 10.0);
    $this->createFixtureAccesPied($outsideBboxLinked, $falaiseId);
    // Hors bbox, non lié : ne doit pas apparaître
    $this->createFixtureArret('PHPUnit Outside Bbox Unlinked', -10.0, -10.0);

    $bbox = '43.80,5.30,43.90,5.45'; // south,west,north,east
    $res = $this->httpGet("/api/fetch_arrets.php?falaise_id=$falaiseId&bbox=$bbox");
    $this->assertSame(200, $res['status'], $res['raw']);

    $ids = array_column($res['body']['arrets'], 'id');
    $this->assertContains($inBboxUnlinked, $ids);
    $this->assertContains($inBboxLinked, $ids);
    $this->assertContains($outsideBboxLinked, $ids);
    $this->assertNotContains(
      $this->findArretIdByName('PHPUnit Outside Bbox Unlinked'),
      $ids
    );

    $linkedFlags = array_combine($ids, array_column($res['body']['arrets'], 'linked'));
    $this->assertFalse($linkedFlags[$inBboxUnlinked]);
    $this->assertTrue($linkedFlags[$inBboxLinked]);
    $this->assertTrue($linkedFlags[$outsideBboxLinked]);
  }

  public function testWithoutBboxReturnsOnlyLinkedArrets(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $linked = $this->createFixtureArret('PHPUnit Linked Only');
    $this->createFixtureAccesPied($linked, $falaiseId);
    $this->createFixtureArret('PHPUnit Not Linked');

    $res = $this->httpGet("/api/fetch_arrets.php?falaise_id=$falaiseId");
    $this->assertSame(200, $res['status']);
    $ids = array_column($res['body']['arrets'], 'id');
    $this->assertSame([$linked], $ids);
  }

  public function testReturnsArretsOfAllModalitiesNotOnlyBus(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $gare = $this->createFixtureArret('PHPUnit Gare TER', 43.8270, 5.3830, ['ter']);
    $tram = $this->createFixtureArret('PHPUnit Arret Tram', 43.8271, 5.3831, ['tram']);

    $bbox = '43.80,5.30,43.90,5.45'; // south,west,north,east
    $res = $this->httpGet("/api/fetch_arrets.php?falaise_id=$falaiseId&bbox=$bbox");
    $this->assertSame(200, $res['status'], $res['raw']);

    $arrets = $res['body']['arrets'];
    $byId = [];
    foreach ($arrets as $a) {
      $byId[$a['id']] = $a;
    }

    $this->assertArrayHasKey($gare, $byId, 'la gare TER doit apparaître, pas seulement les arrêts de bus');
    $this->assertSame(['ter'], $byId[$gare]['types']);
    $this->assertSame('ter', $byId[$gare]['type_dominant']);

    $this->assertArrayHasKey($tram, $byId);
    $this->assertSame(['tram'], $byId[$tram]['types']);
  }

  public function testTypesParamFiltersModalities(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $gare = $this->createFixtureArret('PHPUnit Gare TER Filtre', 43.8270, 5.3830, ['ter']);
    $bus = $this->createFixtureArret('PHPUnit Bus Filtre', 43.8271, 5.3831, ['bus']);

    $bbox = '43.80,5.30,43.90,5.45';
    $res = $this->httpGet("/api/fetch_arrets.php?falaise_id=$falaiseId&bbox=$bbox&types=bus");
    $this->assertSame(200, $res['status'], $res['raw']);

    $ids = array_column($res['body']['arrets'], 'id');
    $this->assertContains($bus, $ids);
    $this->assertNotContains($gare, $ids);
  }

  private function findArretIdByName(string $nom): ?int
  {
    $row = self::dbQueryOne("SELECT id FROM arrets WHERE nom = '" . str_replace("'", "\\'", $nom) . "'");
    return $row ? (int) $row['id'] : null;
  }

  public function testListeLesAccesExistantsDeLaFalaiseParArret(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $autreFalaise = $this->createFixtureFalaise('PHPUnit Autre falaise');
    $arretId = $this->createFixtureArret('PHPUnit Arrêt accès listés', 43.8280, 5.3840);
    $sans = $this->createFixtureArret('PHPUnit Arrêt sans accès', 43.8290, 5.3850);
    $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'velo', 'km' => 8, 'dplus' => 200, 'dmoins' => 150, 'variante' => 'Nord', 'public' => 2]);
    $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'pied', 'km' => 1.2, 'variante' => '']);
    $this->createFixtureAcces($arretId, $autreFalaise, ['type' => 'pied']); // autre falaise : jamais listé ici

    $res = $this->httpGet("/api/fetch_arrets.php?falaise_id=$falaiseId&bbox=43.80,5.30,43.90,5.45");

    $this->assertSame(200, $res['status']);
    $parId = array_column($res['body']['arrets'], null, 'id');
    $acces = $parId[$arretId]['acces'];
    $this->assertCount(2, $acces, 'seuls les accès de CETTE falaise');
    $this->assertSame(['pied', 'velo'], array_column($acces, 'type'));
    $velo = $acces[1];
    $this->assertSame('Nord', $velo['variante']);
    $this->assertEquals(8.0, $velo['km']);
    $this->assertSame(2, $velo['public'], 'à valider');
    $this->assertArrayNotHasKey('contrib_mail', $velo, 'aucun contributeur exposé');
    $this->assertSame([], $parId[$sans]['acces']);
  }

  public function testFetchArretExposeSesAccesExistants(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Arrêt fetch_arret acces');
    $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'pied', 'variante' => 'Sentier', 'km' => 1.5]);
    $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'velo', 'km' => 9, 'variante' => 'Route']);

    $res = $this->httpGet("/api/fetch_arret.php?arret_id=$arretId");

    $this->assertSame(200, $res['status']);
    $this->assertSame([$falaiseId], $res['body']['falaise_ids'], 'falaise_ids : accès sans vélo seulement, comme avant');
    $acces = $res['body']['acces'];
    $this->assertSame(['pied', 'velo'], array_column($acces, 'type'));
    $this->assertSame([$falaiseId, $falaiseId], array_column($acces, 'falaise_id'));
    $this->assertSame('Sentier', $acces[0]['variante']);
    $this->assertArrayNotHasKey('contrib_mail', $acces[0]);
  }
}
