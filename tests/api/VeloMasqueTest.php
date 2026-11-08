<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8 : un accès vélo masqué (public = -1) ne doit apparaître dans aucune
 * liste publique ni d'édition, et le champ `velo_apieduniquement` n'est plus
 * exposé par les API (Lot 8quater : colonne supprimée, type `pied` à la place).
 */
final class VeloMasqueTest extends ApiTestCase
{
  private function creerVelo(int $arretId, int $falaiseId, int $public): int
  {
    // Variante distincte : (arrêt, falaise, type, variante) est unique.
    return $this->createFixtureAcces($arretId, $falaiseId, [
      'type' => 'velo', 'km' => 3, 'dplus' => 20, 'dmoins' => 20, 'public' => $public,
      'variante' => 'v' . bin2hex(random_bytes(3)),
    ]);
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
