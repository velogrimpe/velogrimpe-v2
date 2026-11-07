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
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail)
                  VALUES ($inBboxLinked, $falaiseId, 'phpunit', 'phpunit@example.org')");
    // Hors bbox, mais lié à la falaise : doit quand même apparaître
    $outsideBboxLinked = $this->createFixtureArret('PHPUnit Outside Bbox Linked', 10.0, 10.0);
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail)
                  VALUES ($outsideBboxLinked, $falaiseId, 'phpunit', 'phpunit@example.org')");
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
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail)
                  VALUES ($linked, $falaiseId, 'phpunit', 'phpunit@example.org')");
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
}
