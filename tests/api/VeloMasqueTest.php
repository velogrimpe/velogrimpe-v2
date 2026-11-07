<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8 : un itinéraire `velo` masqué (velo_public = -1, cf.
 * sql_migrations/4_apieduniquement_vers_acces_pieton.sql) ne doit apparaître
 * dans aucune liste publique ni d'édition, et le champ `velo_apieduniquement`
 * n'est plus exposé par les API.
 */
final class VeloMasqueTest extends ApiTestCase
{
  private function creerVelo(int $arretId, int $falaiseId, int $public): int
  {
    $id = self::dbInsert(
      "INSERT INTO velo (arret_id, falaise_id, velo_depart, velo_arrivee, velo_km, velo_dplus, velo_dmoins, velo_descr,
        velo_variante, velo_varianteformate, velo_apieduniquement, velo_public, velo_contrib)
       VALUES ($arretId, $falaiseId, 'phpunit-depart', 'phpunit-arrivee', 3, 20, 20, '', '', '', 0, $public, 'phpunit')"
    );
    $this->cleanupOnTearDown("DELETE FROM velo WHERE velo_id = $id");
    return $id;
  }

  public function testItineraireMasqueAbsentDeLaPageFalaise(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Masque Falaise', 45.1, 5.1, ['ter']);
    $visible = $this->creerVelo($arretId, $falaiseId, 1);
    $masque = $this->creerVelo($arretId, $falaiseId, -1);

    $res = $this->httpGet("/falaise.php?falaise_id=$falaiseId");

    $this->assertSame(200, $res['status']);
    $ids = array_map(fn($it) => (int) $it['velo_id'], self::extractJsValue($res['raw'], 'const itineraires = '));
    $this->assertContains($visible, $ids);
    $this->assertNotContains($masque, $ids);
  }

  public function testItineraireMasqueAbsentDeFetchVelos(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Masque Fetch', 45.1, 5.1, ['ter']);
    $visible = $this->creerVelo($arretId, $falaiseId, 1);
    $masque = $this->creerVelo($arretId, $falaiseId, -1);

    $res = $this->httpGet("/api/fetch_velos.php?falaise_id=$falaiseId");

    $this->assertSame(200, $res['status']);
    $ids = array_map(fn($v) => $v['velo_id'], $res['body']['velos']);
    $this->assertContains($visible, $ids);
    $this->assertNotContains($masque, $ids);
    foreach ($res['body']['velos'] as $v) {
      $this->assertArrayNotHasKey('velo_apieduniquement', $v);
    }
  }
}
