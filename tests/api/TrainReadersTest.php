<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8bis : les lecteurs de `train` passent de `gares` à `arrets`. Preuve par
 * un arrêt de BUS (absent de la table `gares`) relié à Lyon par un train et
 * à une falaise par un itinéraire vélo : tableau, falaise, carte et sitemap
 * doivent le voir comme n'importe quelle gare.
 */
final class TrainReadersTest extends ApiTestCase
{
  private const NOM = 'PHPUnit Car Lyon';

  /** @return array{falaiseId:int, arretId:int} */
  private function falaiseDepuisUnCar(): array
  {
    $falaiseId = $this->createFixtureFalaise('PHPUnit Falaise du car');
    self::dbExec("UPDATE falaises SET falaise_maa = 10, falaise_mar = 10, falaise_fermee = '' WHERE falaise_id = $falaiseId");
    $arretId = $this->createFixtureArret(self::NOM, 45.3, 5.3, ['bus']);
    $villeId = self::WITNESS_VILLE_ID;
    $trainId = self::dbInsert(
      "INSERT INTO train (ville_id, arret_id, train_depart, train_arrivee, train_temps, train_correspmin, train_correspmax,
        train_descr, train_public, train_contrib, train_tgv)
       VALUES ($villeId, $arretId, 'lyon-part-dieu', 'phpunit-car-lyon', 40, 0, 0, '', 1, 'phpunit', 0)"
    );
    $this->cleanupOnTearDown("DELETE FROM train WHERE train_id = $trainId");
    $this->createFixtureAcces($arretId, $falaiseId, ['km' => 8, 'dplus' => 50, 'dmoins' => 50, 'depart_slug' => 'a', 'arrivee_slug' => 'b']);
    return ['falaiseId' => $falaiseId, 'arretId' => $arretId];
  }

  public function testTableauListeUneFalaiseAtteinteDepuisUnArretDeBus(): void
  {
    ['falaiseId' => $falaiseId] = $this->falaiseDepuisUnCar();

    $res = $this->httpGet('/tableau.php?ville_id=' . self::WITNESS_VILLE_ID);
    $blockPos = strpos($res['raw'], 'window.__TABLEAU_DATA__ = ');
    $groupes = self::extractJsValue($res['raw'], 'falaises: ', $blockPos);

    $row = null;
    foreach ($groupes as $g) {
      if ((int) $g[0]['falaise_id'] === $falaiseId) {
        $row = $g[0];
      }
    }
    $this->assertNotNull($row, "la falaise reliée à Lyon par un car doit figurer au tableau");
    $this->assertSame(self::NOM, $row['gare_nom']);
    $this->assertSame(40, (int) $row['train_temps']);
    $this->assertSame(0, (int) $row['acces_pieton']);
  }

  public function testPageFalaiseProposeLaVilleEtLeTrainDepuisUnArretDeBus(): void
  {
    ['falaiseId' => $falaiseId] = $this->falaiseDepuisUnCar();

    $res = $this->httpGet("/falaise.php?falaise_id=$falaiseId&ville_id=" . self::WITNESS_VILLE_ID);

    $this->assertSame(200, $res['status']);
    $this->assertMatchesRegularExpression('/<option value="' . self::WITNESS_VILLE_ID . '"/', $res['raw'], 'la ville reliée par train doit être proposée');
    $this->assertStringContainsString('🚆', $res['raw'], "le temps de train depuis l'arrêt doit s'afficher");
  }

  public function testCarteExposeLesVillesDeLArretDeBus(): void
  {
    ['arretId' => $arretId] = $this->falaiseDepuisUnCar();

    $res = $this->httpGet('/carte.php');
    $arrets = self::extractJsValue($res['raw'], 'const arretsBase = ');

    $arret = null;
    foreach ($arrets as $a) {
      if ((int) $a['arret_id'] === $arretId) {
        $arret = $a;
      }
    }
    $this->assertNotNull($arret);
    $this->assertStringContainsString(self::WITNESS_VILLE_ID . '|', (string) $arret['villes']);
  }

  public function testSitemapListeLaFalaiseAvecLaVille(): void
  {
    ['falaiseId' => $falaiseId] = $this->falaiseDepuisUnCar();

    $res = $this->httpGet('/sitemap.php');

    $this->assertStringContainsString(
      "falaise.php?falaise_id=$falaiseId&amp;ville_id=" . self::WITNESS_VILLE_ID,
      $res['raw'],
      "la page falaise × ville issue d'un arrêt non-gare doit figurer au sitemap"
    );
  }
}
