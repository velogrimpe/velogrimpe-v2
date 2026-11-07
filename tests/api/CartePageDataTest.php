<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Non-régression sur les données embarquées par carte.php (falaisesBase,
 * itineraires, arretsBase, accesPieton). Pas de rendu Leaflet ici :
 * on vérifie l'intégrité relationnelle des données que la page expose au JS
 * (itinéraires et accès piétons bien reliés à un arrêt et une falaise existantes, coordonnées
 * exploitables), en s'appuyant sur les données réelles de dev comme témoin
 * plutôt que sur des fixtures synthétiques.
 */
final class CartePageDataTest extends ApiTestCase
{
  public function testItinerairesReferenceArretsEtFalaisesPresentesSurLaCarte(): void
  {
    $res = $this->httpGet('/carte.php');
    $this->assertSame(200, $res['status']);

    $falaisesBase = self::extractJsValue($res['raw'], 'const falaisesBase = ');
    $itineraires = self::extractJsValue($res['raw'], 'const itineraires = ');
    $arretsBase = self::extractJsValue($res['raw'], 'const arretsBase = ');

    $this->assertNotEmpty($falaisesBase, 'la carte doit exposer au moins une falaise publiée');
    $this->assertNotEmpty($arretsBase, 'la carte doit exposer au moins un arrêt');
    $this->assertNotEmpty($itineraires, 'la carte doit exposer au moins un itinéraire publié');

    $falaiseIds = array_map('intval', array_column($falaisesBase, 'falaise_id'));
    $arretIds = array_map('intval', array_column($arretsBase, 'arret_id'));

    foreach ($itineraires as $it) {
      $this->assertContains(
        (int) $it['arret_id'],
        $arretIds,
        "l'itinéraire vélo #{$it['velo_id']} référence un arrêt absent d'arretsBase (arret_id={$it['arret_id']}) : "
          . "arrêt supprimé/désactivé sans que l'itinéraire ne le soit ?"
      );
      $this->assertContains(
        (int) $it['falaise_id'],
        $falaiseIds,
        "l'itinéraire vélo #{$it['velo_id']} référence une falaise absente de falaisesBase (falaise_id={$it['falaise_id']})"
      );
    }
  }

  public function testArretsOntDesCoordonneesExploitables(): void
  {
    $res = $this->httpGet('/carte.php');
    $arretsBase = self::extractJsValue($res['raw'], 'const arretsBase = ');

    foreach ($arretsBase as $arret) {
      $parts = array_map('trim', explode(',', (string) $arret['arret_latlng']));
      $this->assertCount(2, $parts, "arret_latlng mal formé pour l'arrêt #{$arret['arret_id']} : '{$arret['arret_latlng']}'");
      $this->assertIsNumeric($parts[0], "latitude non numérique pour l'arrêt #{$arret['arret_id']}");
      $this->assertIsNumeric($parts[1], "longitude non numérique pour l'arrêt #{$arret['arret_id']}");
    }
  }

  public function testArretsExposentLeursModalites(): void
  {
    $res = $this->httpGet('/carte.php');
    $arretsBase = self::extractJsValue($res['raw'], 'const arretsBase = ');

    $modalites = [];
    foreach ($arretsBase as $a) {
      $this->assertNotEmpty($a['types'], "types vide pour l'arrêt #{$a['arret_id']}");
      $modalites = array_merge($modalites, $a['types']);
    }
    $this->assertContains('ter', $modalites);
    $this->assertContains('bus', $modalites, 'les arrêts de bus doivent être exposés à la carte');
  }

  public function testAccesPietonsReferencentArretsEtFalaisesPresentsSurLaCarte(): void
  {
    $res = $this->httpGet('/carte.php');
    $falaisesBase = self::extractJsValue($res['raw'], 'const falaisesBase = ');
    $arretsBase = self::extractJsValue($res['raw'], 'const arretsBase = ');
    $accesPieton = self::extractJsValue($res['raw'], 'const accesPieton = ');

    $this->assertNotEmpty($accesPieton, 'la carte doit exposer les accès piéton arrêt → falaise');
    $falaiseIds = array_map('intval', array_column($falaisesBase, 'falaise_id'));
    $arretIds = array_map('intval', array_column($arretsBase, 'arret_id'));
    foreach ($accesPieton as $p) {
      $this->assertContains((int) $p['arret_id'], $arretIds, "accès piéton vers un arrêt absent (#{$p['arret_id']})");
      $this->assertContains((int) $p['falaise_id'], $falaiseIds, "accès piéton vers une falaise absente (#{$p['falaise_id']})");
    }
  }

  public function testItinerairesNExposentPlusLeChampAPiedUniquement(): void
  {
    $res = $this->httpGet('/carte.php');
    $itineraires = self::extractJsValue($res['raw'], 'const itineraires = ');
    $this->assertNotEmpty($itineraires);
    foreach ($itineraires as $it) {
      $this->assertArrayNotHasKey('velo_apieduniquement', $it, "Lot 8 : ces accès sont dans acces_pieton_falaise");
    }
  }
}
