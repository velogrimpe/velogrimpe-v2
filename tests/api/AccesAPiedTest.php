<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8quater : « faisable à pied » n'est plus saisi (colonne `velo_apiedpossible`
 * supprimée), il se déduit de l'accès : `type = 'pied'` OU `km <= 5`. Une seule
 * définition (lib/velo_lib.php : acces_a_pied_possible() et son équivalent SQL
 * acces_a_pied_sql()), exposée aux lecteurs sous l'ancienne clé JSON
 * `velo_apiedpossible`.
 */
final class AccesAPiedTest extends ApiTestCase
{
  public static function setUpBeforeClass(): void
  {
    $_SERVER['DOCUMENT_ROOT'] = dirname(__DIR__, 2) . '/public_html'; // vide en CLI : velo_lib.php en dérive ses require
    require_once dirname(__DIR__, 2) . '/public_html/lib/velo_lib.php';
  }

  public function testRegleEnPhp(): void
  {
    $this->assertTrue(acces_a_pied_possible('pied', null), 'un accès pied l\'est toujours, même sans distance');
    $this->assertTrue(acces_a_pied_possible('pied', 12.0), 'même au-delà de 5 km');
    $this->assertTrue(acces_a_pied_possible('velo', 5), '5 km pile : à pied possible');
    $this->assertTrue(acces_a_pied_possible('velo', '4.2'));
    $this->assertFalse(acces_a_pied_possible('velo', 5.1));
    $this->assertFalse(acces_a_pied_possible('velo', null), 'distance inconnue : pas déduit');
    $this->assertFalse(acces_a_pied_possible('velo', ''));
  }

  public function testLeSqlEstEquivalentAuPhp(): void
  {
    $cas = [['pied', 'NULL'], ['pied', '12'], ['velo', '5'], ['velo', '4.2'], ['velo', '5.1'], ['velo', 'NULL']];
    $union = implode(' UNION ALL ', array_map(fn($c) => "SELECT '{$c[0]}' AS type, {$c[1]} AS km", $cas));
    $rows = self::dbQuery('SELECT x.type, x.km, ' . acces_a_pied_sql('x') . " AS ok FROM ($union) x");
    $this->assertCount(count($cas), $rows);
    foreach ($rows as $r) {
      $this->assertNotNull($r['ok'], 'jamais NULL, même sans distance (sûr sous un NOT)');
      $this->assertSame(acces_a_pied_possible($r['type'], $r['km']) ? '1' : '0', $r['ok'], "type={$r['type']} km=" . var_export($r['km'], true));
    }
  }

  public function testFetchVelosExposeLaValeurCalculee(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit À pied', 45.1, 5.1, ['ter']);
    $court = $this->createFixtureAcces($arretId, $falaiseId, ['km' => 5, 'variante' => 'court']);
    $long = $this->createFixtureAcces($arretId, $falaiseId, ['km' => 5.1, 'variante' => 'long']);
    $inconnu = $this->createFixtureAcces($arretId, $falaiseId, ['km' => null, 'variante' => 'sans-km']);

    $res = $this->httpGet("/api/fetch_velos.php?falaise_id=$falaiseId");

    $this->assertSame(200, $res['status']);
    $parId = array_column($res['body']['velos'], 'velo_apiedpossible', 'velo_id');
    $this->assertSame(1, $parId[$court], '5 km pile');
    $this->assertSame(0, $parId[$long], '5,1 km');
    $this->assertSame(0, $parId[$inconnu], 'km inconnu');
  }

  public function testCarteExposeLaValeurCalculee(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit À pied carte', 45.1, 5.1, ['ter']);
    $court = $this->createFixtureAcces($arretId, $falaiseId, ['km' => 3, 'variante' => 'court']);
    $long = $this->createFixtureAcces($arretId, $falaiseId, ['km' => 9, 'variante' => 'long']);

    $res = $this->httpGet('/carte.php');
    $it = array_column(self::extractJsValue($res['raw'], 'const itineraires = '), null, 'velo_id');

    $this->assertSame('1', (string) $it[$court]['velo_apiedpossible']);
    $this->assertSame('0', (string) $it[$long]['velo_apiedpossible']);
  }
}
