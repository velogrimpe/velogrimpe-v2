<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Non-régression sur les données embarquées par falaise.php (`const falaise`
 * et `const itineraires`, falaise.php:1196-1197) : chaque itinéraire doit
 * référencer la bonne falaise et exposer une gare complète (nom, coordonnées,
 * commune) — c'est la seule page du site qui joint `acces_falaise` × `arrets` sans
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
      // falaise.php n'embarque plus falaise_id (champs réduits, « fix email leak ») :
      // on relit l'accès en base pour vérifier qu'il appartient bien à la falaise.
      $ligne = self::dbQueryOne("SELECT falaise_id, type FROM acces_falaise WHERE acces_id = " . (int) $it['velo_id']);
      $this->assertNotNull($ligne, "l'itinéraire #{$it['velo_id']} n'existe pas dans acces_falaise");
      $this->assertSame(self::WITNESS_FALAISE_ID, (int) $ligne['falaise_id'], "un itinéraire de falaise.php?falaise_id=" . self::WITNESS_FALAISE_ID . " référence une autre falaise");
      $this->assertSame('velo', $ligne['type'], "seuls les accès vélo sont des itinéraires (les accès à pied ont leur section)");

      // La jointure `LEFT JOIN gares ... AND gares.deleted = 0` renvoie des
      // colonnes gare_* NULL si la gare référencée a été supprimée/désactivée
      // (velo.gare_id reste NOT NULL) : un gare_nom vide signale un lien cassé.
      $this->assertNotEmpty(
        $it['gare_nom'],
        "l'itinéraire vélo #{$it['velo_id']} référence un arrêt supprimé/désactivé"
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
    // Hostiaz : l'ancien itinéraire « à pied uniquement » (acces_id 19) est de
    // type `pied` depuis le Lot 8quater (il avait été copié puis masqué au Lot 8) ;
    // l'accès vélo (acces_id 18) reste affiché.
    $res = $this->httpGet('/falaise.php?falaise_id=' . self::WITNESS_FALAISE_HOSTIAZ_ID);
    $this->assertSame(200, $res['status']);
    $itineraires = self::extractJsValue($res['raw'], 'const itineraires = ');

    $ids = array_map(fn($it) => (int) $it['velo_id'], $itineraires);
    $this->assertNotContains(19, $ids, "l'itinéraire à pied uniquement migré ne doit plus s'afficher comme itinéraire vélo");
    $this->assertContains(18, $ids);
    foreach ($itineraires as $it) {
      $this->assertArrayNotHasKey('velo_apieduniquement', $it);
    }

    $acces = self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE type = 'pied' AND arret_id = 12 AND falaise_id = " . self::WITNESS_FALAISE_HOSTIAZ_ID);
    $this->assertNotNull($acces, "l'accès piéton migré doit exister dans acces_falaise");
    $this->assertSame('19', $acces['acces_id'], 'conservé sous son ancien velo_id');
  }

  public function testItineraireVirieuLeGrandResteFaisableAPied(): void
  {
    // « À pied possible » est calculé (≤ 5 km, Lot 8quater) et n'est pas embarqué
    // par falaise.php : fetch_velos.php l'expose.
    $res = $this->httpGet('/api/fetch_velos.php?falaise_id=' . self::WITNESS_FALAISE_VIRIEU_ID);
    $this->assertSame(200, $res['status']);

    $found = null;
    foreach ($res['body']['velos'] as $it) {
      if ((int) $it['velo_apiedpossible'] === 1) {
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

    // gare_id n'est plus embarqué : on compte les gares distinctes par leur nom.
    $gareIds = array_unique(array_map(fn($it) => (string) $it['gare_nom'], $itineraires));
    $this->assertGreaterThanOrEqual(
      2,
      count($gareIds),
      'la falaise témoin Contrevoz devrait avoir des accès vélo depuis au moins 2 gares différentes — la BDD locale a-t-elle changé ?'
    );
  }
}
