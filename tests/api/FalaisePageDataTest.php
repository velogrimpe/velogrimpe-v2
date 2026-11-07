<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Non-régression sur les données embarquées par falaise.php (`const falaise`
 * et `const itineraires`, falaise.php:1196-1197) : chaque itinéraire doit
 * référencer la bonne falaise et exposer une gare complète (nom, coordonnées,
 * commune) — c'est la seule page du site qui joint `velo` × `gares` sans
 * filtrer les colonnes, donc la meilleure source pour vérifier que les gares
 * ne sont pas orphelines ou incomplètes. S'appuie sur la falaise témoin
 * ApiTestCase::WITNESS_FALAISE_ID ("Pont de Barret - Eson"), déjà utilisée
 * par tests/e2e/falaise.spec.ts, ainsi que sur des falaises témoins
 * additionnelles couvrant chacune une configuration d'accès particulière
 * (cf. ApiTestCase::WITNESS_FALAISE_HOSTIAZ_ID / _VIRIEU_ID / _CONTREVOZ_ID).
 */
final class FalaisePageDataTest extends ApiTestCase
{
  public function testItinerairesDeLaFalaiseTemoinSontBienRelies(): void
  {
    $res = $this->httpGet('/falaise.php?falaise_id=' . self::WITNESS_FALAISE_ID);
    $this->assertSame(200, $res['status']);

    $falaise = self::extractJsValue($res['raw'], 'const falaise = ');
    $itineraires = self::extractJsValue($res['raw'], 'const itineraires = ');

    $this->assertSame(self::WITNESS_FALAISE_ID, $falaise['falaise_id']);
    $this->assertNotEmpty($itineraires, 'la falaise témoin devrait avoir au moins un itinéraire publié — la BDD locale a-t-elle changé ?');

    foreach ($itineraires as $it) {
      $this->assertSame(
        self::WITNESS_FALAISE_ID,
        (int) $it['falaise_id'],
        "un itinéraire de falaise.php?falaise_id=" . self::WITNESS_FALAISE_ID . " référence une autre falaise"
      );

      // La jointure `LEFT JOIN gares ... AND gares.deleted = 0` renvoie des
      // colonnes gare_* NULL si la gare référencée a été supprimée/désactivée
      // (velo.gare_id reste NOT NULL) : un gare_nom vide signale un lien cassé.
      $this->assertNotEmpty(
        $it['gare_nom'],
        "l'itinéraire vélo #{$it['velo_id']} référence une gare supprimée/désactivée (gare_id={$it['gare_id']})"
      );
      $this->assertNotEmpty($it['gare_latlng'], "coordonnées de gare manquantes pour l'itinéraire #{$it['velo_id']}");
      $coords = array_map('trim', explode(',', (string) $it['gare_latlng']));
      $this->assertCount(2, $coords, "gare_latlng mal formé pour l'itinéraire #{$it['velo_id']}");
      $this->assertIsNumeric($coords[0]);
      $this->assertIsNumeric($coords[1]);
    }
  }

  public function testItineraireMigreVersAccesPietonNApparaitPlusCommeItineraireVelo(): void
  {
    // Hostiaz : l'ancien itinéraire « à pied uniquement » (velo_id 19) a été
    // migré vers acces_pieton_falaise (Lot 8) et masqué dans velo ; l'accès
    // vélo (velo_id 18) reste affiché.
    $res = $this->httpGet('/falaise.php?falaise_id=' . self::WITNESS_FALAISE_HOSTIAZ_ID);
    $this->assertSame(200, $res['status']);
    $itineraires = self::extractJsValue($res['raw'], 'const itineraires = ');

    $ids = array_map(fn($it) => (int) $it['velo_id'], $itineraires);
    $this->assertNotContains(19, $ids, "l'itinéraire à pied uniquement migré ne doit plus s'afficher comme itinéraire vélo");
    $this->assertContains(18, $ids);
    foreach ($itineraires as $it) {
      $this->assertArrayNotHasKey('velo_apieduniquement', $it);
    }

    $acces = self::dbQueryOne('SELECT 1 AS x FROM acces_pieton_falaise WHERE arret_id = 12 AND falaise_id = ' . self::WITNESS_FALAISE_HOSTIAZ_ID);
    $this->assertNotNull($acces, "l'accès piéton migré doit exister dans acces_pieton_falaise");
  }

  public function testItineraireVirieuLeGrandResteFaisableAPied(): void
  {
    $res = $this->httpGet('/falaise.php?falaise_id=' . self::WITNESS_FALAISE_VIRIEU_ID);
    $this->assertSame(200, $res['status']);
    $itineraires = self::extractJsValue($res['raw'], 'const itineraires = ');

    $found = null;
    foreach ($itineraires as $it) {
      if ((int) ($it['velo_apiedpossible'] ?? 0) === 1) {
        $found = $it;
        break;
      }
    }
    $this->assertNotNull($found, "aucun itinéraire vélo faisable à pied sur la falaise témoin Virieu le Grand — la BDD locale a-t-elle changé ?");
  }

  public function testItinerairesContrevozPartentDeDeuxGaresDifferentes(): void
  {
    $res = $this->httpGet('/falaise.php?falaise_id=' . self::WITNESS_FALAISE_CONTREVOZ_ID);
    $this->assertSame(200, $res['status']);
    $itineraires = self::extractJsValue($res['raw'], 'const itineraires = ');

    $gareIds = array_unique(array_map(fn($it) => (int) $it['gare_id'], $itineraires));
    $this->assertGreaterThanOrEqual(
      2,
      count($gareIds),
      'la falaise témoin Contrevoz devrait avoir des accès vélo depuis au moins 2 gares différentes — la BDD locale a-t-elle changé ?'
    );
  }
}
