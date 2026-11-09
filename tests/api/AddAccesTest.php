<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/add_velo.php, Lot 5 : le formulaire devient un formulaire d'ajout
 * d'ACCÈS arrêt → falaise. Deux modes, discriminés par le champ `mode` :
 *  - `velo` (défaut) : itinéraire vélo depuis un arrêt QUELCONQUE (les cars
 *    qui prennent les vélos existent) → `acces_falaise` type `velo`, clé
 *    `arret_id` (renommée depuis `gare_id`, cf. sql_migrations/1_unification_arrets.sql) ;
 *  - `pied` : accès piéton (description, pas de GPX) → `acces_falaise` type
 *    `pied` (Lot 8quater : une seule table pour les deux).
 * Les cas vélo depuis une gare sont dans AddVeloTest.
 */
final class AddAccesTest extends ApiTestCase
{
  private const GPX_FIXTURE = __DIR__ . '/../fixtures/velo-with-wpt.gpx';

  // --- Mode piéton ---------------------------------------------------------

  public function testAccesPietonEcritUneLigneDeTypePiedEtAucuneDeTypeVelo(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->postPied($arretId, $falaiseId, ['description' => 'Sentier balisé, 15 min.']);

    $this->assertSame(302, $res['status'], $res['raw']);
    $this->assertStringContainsString('/ajout/confirmation_velo.php', $res['location']);
    $this->assertStringContainsString('mode=pied', $res['location']);

    $row = self::dbQueryOne(
      "SELECT type, public, description, contrib, contrib_mail FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertNotNull($row, "l'accès piéton aurait dû être écrit dans acces_falaise");
    $this->assertSame('pied', $row['type']);
    $this->assertSame('1', $row['public'], 'un accès à pied est publié tout de suite');
    $this->assertSame('Sentier balisé, 15 min.', $row['description']);
    $this->assertSame('PHPUnit', $row['contrib']);
    $this->assertSame('phpunit@example.org', $row['contrib_mail']);

    $this->assertNull(
      self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE type = 'velo' AND arret_id = $arretId AND falaise_id = $falaiseId"),
      "un accès piéton ne doit créer aucune ligne de type velo"
    );
  }

  public function testAccesPietonEstExploitableViaFetchArrets(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $this->postPied($arretId, $falaiseId);

    $fetch = $this->httpGet("/api/fetch_arrets.php?falaise_id=$falaiseId");
    $this->assertSame(200, $fetch['status']);
    $liste = $fetch['body']['arrets'] ?? $fetch['body'];
    $ids = array_map(fn($a) => (int) $a['id'], $liste);
    $this->assertContains($arretId, $ids, "l'arrêt lié doit apparaître dans fetch_arrets.php pour la falaise");
  }

  public function testAccesPietonCreeApparaitSurLaPageFalaiseEtSurLaCarte(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Accès exploitable', 45.2, 5.2, ['bus']);
    $this->postPied($arretId, $falaiseId, ['description' => 'Chemin du lavoir.']);

    // Page falaise : section « Accès à pied » (const accesPietons)
    $page = $this->httpGet("/falaise.php?falaise_id=$falaiseId");
    $acces = array_column(self::extractJsValue($page['raw'], 'const accesPietons = '), null, 'arret_id');
    $this->assertArrayHasKey($arretId, $acces, "l'accès à pied créé n'apparaît pas sur falaise.php");
    $this->assertSame('Chemin du lavoir.', $acces[$arretId]['description']);

    // Carte globale : liste des liens arrêt → falaise
    $carte = $this->httpGet('/carte.php');
    $liens = array_map(fn($p) => (int) $p['arret_id'] . '-' . (int) $p['falaise_id'], self::extractJsValue($carte['raw'], 'const accesPieton = '));
    $this->assertContains("$arretId-$falaiseId", $liens, "l'accès à pied créé n'apparaît pas dans les données de carte.php");
  }

  public function testAccesPietonAvecKmDenivelesEtGpx(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Accès détaillé', 45.2, 5.2, ['bus']);

    $res = $this->postPied($arretId, $falaiseId, ['velo_km' => '1.8', 'velo_dplus' => '120', 'velo_dmoins' => '15'], ['gpx_file' => self::GPX_FIXTURE]);

    $this->assertSame(302, $res['status'], $res['raw']);
    $row = self::dbQueryOne("SELECT acces_id, type, km, dplus, dmoins FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertSame('pied', $row['type']);
    $this->assertEquals(1.8, (float) $row['km']);
    $this->assertSame('120', $row['dplus']);
    $this->assertSame('15', $row['dmoins']);
    $gpx = $this->gpxDeLAcces((int) $row['acces_id']);
    $this->assertFileExists($gpx, 'le GPX d\'un accès à pied est écrit comme celui d\'un itinéraire vélo');
    $this->assertStringNotContainsString('<wpt', file_get_contents($gpx), 'waypoints retirés');
    $this->assertStringContainsString('<trkpt', file_get_contents($gpx));

    // Page falaise : chiffres, lien vers la trace, trace embarquée pour la carte
    $page = $this->httpGet("/falaise.php?falaise_id=$falaiseId");
    $acces = array_column(self::extractJsValue($page['raw'], 'const accesPietons = '), null, 'arret_id')[$arretId];
    $this->assertEquals(1.8, $acces['km']);
    $this->assertSame(120, $acces['dplus']);
    $this->assertSame(15, $acces['dmoins']);
    $this->assertStringContainsString("/public/gpx/{$row['acces_id']}_", (string) $acces['gpx_url']);
    $this->assertMatchesRegularExpression('#1\.8 km, 120 D\+, 15 D-#', $page['raw'], 'section « liaison » du bloc de l\'accès');

    // Carte globale : trace signalée, mêmes clés que les itinéraires vélo pour le rendu GPX
    $carte = $this->httpGet('/carte.php');
    $p = array_values(array_filter(self::extractJsValue($carte['raw'], 'const accesPieton = '), fn($x) => $x['arret_id'] === $arretId))[0];
    $this->assertTrue($p['has_gpx']);
    $this->assertSame((int) $row['acces_id'], $p['velo_id']);
    $this->assertEquals(1.8, $p['km']);
  }

  public function testTableauExposeKmEtDenivelesDeLAccesAPied(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Tableau chiffres', 45.2, 5.2, ['ter']);
    $trainId = self::dbInsert(
      "INSERT INTO train (ville_id, arret_id, train_depart, train_arrivee, train_temps, train_correspmin, train_correspmax, train_descr, train_public, train_contrib, train_tgv)
       VALUES (" . self::WITNESS_VILLE_ID . ", $arretId, 'lyon-part-dieu', 'phpunit-chiffres', 40, 0, 0, '', 1, 'phpunit', 0)"
    );
    $this->cleanupOnTearDown("DELETE FROM train WHERE train_id = $trainId");
    $this->postPied($arretId, $falaiseId, ['velo_km' => '2.5', 'velo_dplus' => '80']);

    $res = $this->httpGet('/tableau.php?ville_id=' . self::WITNESS_VILLE_ID);
    $groupes = self::extractJsValue($res['raw'], 'falaises: ', strpos($res['raw'], 'window.__TABLEAU_DATA__ = '));
    $ligne = null;
    foreach ($groupes as $g) {
      foreach ($g as $row) {
        if ((int) $row['falaise_id'] === $falaiseId && (int) $row['acces_pieton'] === 1) {
          $ligne = $row;
        }
      }
    }
    $this->assertNotNull($ligne, 'la ligne piéton doit figurer au tableau');
    $this->assertSame(2.5, $ligne['acces_pieton_km']);
    $this->assertSame(80, $ligne['acces_pieton_dplus']);
    $this->assertNull($ligne['acces_pieton_dmoins'], 'non renseigné : null, pas 0');
    $this->assertSame(0, (int) $ligne['velo_km'], 'les filtres vélo continuent d\'écarter les lignes piéton');
  }

  public function testAccesPietonExistantEstCompleteSansEcraser(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Accès complété', 45.2, 5.2, ['bus']);
    $this->postPied($arretId, $falaiseId, ['description' => 'Description d\'origine.', 'velo_km' => '3']);
    $accesId = (int) self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId")['acces_id'];
    $gpx = $this->gpxDeLAcces($accesId);

    // Complément : D+ et GPX manquants sont ajoutés ; description et km déjà renseignés ne bougent pas
    $res = $this->postPied($arretId, $falaiseId, ['description' => 'Autre texte.', 'velo_km' => '99', 'velo_dplus' => '60'], ['gpx_file' => self::GPX_FIXTURE]);

    $this->assertSame(302, $res['status'], $res['raw']);
    $row = self::dbQueryOne("SELECT description, km, dplus FROM acces_falaise WHERE acces_id = $accesId");
    $this->assertSame('Description d\'origine.', $row['description'], 'jamais d\'écrasement par un formulaire public');
    $this->assertEquals(3.0, (float) $row['km']);
    $this->assertSame('60', $row['dplus']);
    $this->assertFileExists($gpx);
    $this->assertSame('1', self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId")['n'], 'pas de doublon');

    // Plus rien à ajouter : refusé
    $encore = $this->postPied($arretId, $falaiseId, ['description' => 'Encore.', 'velo_km' => '5', 'velo_dplus' => '70'], ['gpx_file' => self::GPX_FIXTURE]);
    $this->assertStringContainsString('existe déjà', $encore['raw']);
    $this->assertEquals(3.0, (float) self::dbQueryOne("SELECT km FROM acces_falaise WHERE acces_id = $accesId")['km']);
  }

  public function testAccesPietonGpxInvalideNeCreeRien(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit GPX invalide', 45.2, 5.2, ['bus']);

    $res = $this->postPied($arretId, $falaiseId, [], ['gpx_file' => __DIR__ . '/../fixtures/not-a-gpx.xml']);

    $this->assertStringContainsString("n'est pas valide", $res['raw']);
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"));
  }

  public function testAccesPietonNeDemandePasDeGpx(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->postPied($arretId, $falaiseId);

    $this->assertSame(302, $res['status']);
    $this->assertStringNotContainsString('GPX', $res['raw']);
  }

  public function testAccesPietonEnDoublonEstRefuseSansErreurNiDoublon(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $this->postPied($arretId, $falaiseId, ['description' => 'Première version']);

    $res = $this->postPied($arretId, $falaiseId, ['description' => 'Seconde version']);

    $this->assertNotSame(500, $res['status']);
    $this->assertStringContainsString('existe déjà', $res['raw']);
    $rows = self::dbQuery("SELECT description FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertCount(1, $rows);
    $this->assertSame('Première version', $rows[0]['description'], "le doublon ne doit pas écraser l'existant");
  }

  public function testAccesPietonAvecArretInexistantEstRefuse(): void
  {
    $falaiseId = $this->createFixtureFalaise();

    $res = $this->postPied(999999999, $falaiseId);

    $this->assertStringContainsString('arrêt', mb_strtolower($res['raw']));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE falaise_id = $falaiseId"));
  }

  public function testAccesPietonAvecFalaiseInexistanteEstRefuse(): void
  {
    $arretId = $this->createFixtureArret();

    $res = $this->postPied($arretId, 32000);

    $this->assertStringContainsString('falaise', mb_strtolower($res['raw']));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE arret_id = $arretId"));
  }

  // --- Mode vélo depuis un arrêt quelconque -------------------------------

  public function testItineraireVeloDepuisUnArretBusEstCreeAvecArretId(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Car Vélo', 43.83, 5.39, ['bus']);
    $varianteformate = 'phpunit-test-' . bin2hex(random_bytes(4));

    $res = $this->httpPostMultipart(
      '/api/add_velo.php',
      $this->champsVelo($arretId, $falaiseId, 'phpunit-car-velo', 'phpunit-fixture', $varianteformate),
      ['gpx_file' => self::GPX_FIXTURE]
    );

    $this->assertSame(302, $res['status'], $res['raw']);
    $created = self::dbQueryOne("SELECT acces_id AS velo_id FROM acces_falaise WHERE type = 'velo' AND arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertNotNull($created, "l'itinéraire vélo depuis un arrêt de bus aurait dû être créé dans acces_falaise.arret_id");
    $veloId = (int) $created['velo_id'];
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE acces_id = $veloId");
    $gpxPath = dirname(__DIR__, 2) . "/public/gpx/{$veloId}_phpunit-car-velo_phpunit-fixture_{$varianteformate}.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($gpxPath) {
      if (file_exists($gpxPath)) {
        unlink($gpxPath);
      }
    });

    $this->assertNull(
      self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId"),
      "un itinéraire vélo ne doit pas créer d'accès de type pied"
    );

    // Exploitable : relu par fetch_velos.php (clés `arret_id` / `arret`, renommées au Lot 6) avec l'arrêt joint.
    $fetch = $this->httpGet("/api/fetch_velos.php?falaise_id=$falaiseId");
    $this->assertSame(200, $fetch['status']);
    $found = null;
    foreach ($fetch['body']['velos'] as $v) {
      if ($v['velo_id'] === $veloId) {
        $found = $v;
      }
    }
    $this->assertNotNull($found, "l'itinéraire depuis un arrêt de bus n'apparaît pas dans fetch_velos.php");
    $this->assertSame($arretId, $found['arret_id']);
    $this->assertSame('PHPUnit Car Vélo', $found['arret']['nom']);
  }

  public function testVeloAvecArretInexistantEstRefuse(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $varianteformate = 'phpunit-test-' . bin2hex(random_bytes(4));

    $res = $this->httpPostMultipart(
      '/api/add_velo.php',
      $this->champsVelo(999999999, $falaiseId, 'inexistant', 'phpunit-fixture', $varianteformate),
      ['gpx_file' => self::GPX_FIXTURE]
    );

    $this->assertStringContainsString('arrêt', mb_strtolower($res['raw']));
    $this->assertNull(self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE variante_formate = '$varianteformate'"));
  }

  public function testPageAjoutVeloPrerempliDepuisArretId(): void
  {
    $arretId = $this->createFixtureArret('PHPUnit Arrêt Prérempli');

    $page = $this->httpGet("/ajout/ajout_velo.php?arret_id=$arretId");

    $this->assertSame(200, $page['status']);
    $this->assertStringContainsString('data-preset-arret-id="' . $arretId . '"', $page['raw']);
  }

  // --- Helpers -------------------------------------------------------------

  private function postPied(int $arretId, int $falaiseId, array $extra = [], array $files = []): array
  {
    return $this->httpPostMultipart('/api/add_velo.php', array_merge([
      'mode' => 'pied',
      'admin' => '0',
      'arret_id' => (string) $arretId,
      'falaise_id' => (string) $falaiseId,
      'description' => 'Accès piéton de test.',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ], $extra), $files);
  }

  /** Chemin disque du GPX d'un accès à pied (variante vide) + nettoyage en tearDown. */
  private function gpxDeLAcces(int $accesId): string
  {
    $row = self::dbQueryOne("SELECT depart_slug, arrivee_slug FROM acces_falaise WHERE acces_id = $accesId");
    $path = dirname(__DIR__, 2) . "/public/gpx/{$accesId}_{$row['depart_slug']}_{$row['arrivee_slug']}_.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) {
      if (file_exists($path)) {
        unlink($path);
      }
    });
    return $path;
  }

  private function champsVelo(int $arretId, int $falaiseId, string $depart, string $arrivee, string $varianteformate): array
  {
    return [
      'mode' => 'velo',
      'admin' => '0',
      'arret_id' => (string) $arretId,
      'falaise_id' => (string) $falaiseId,
      'velo_depart' => $depart,
      'velo_arrivee' => $arrivee,
      'velo_variante' => 'Test PHPUnit',
      'velo_varianteformate' => $varianteformate,
      'velo_km' => '5.5',
      'velo_dplus' => '100',
      'velo_dmoins' => '20',
      'velo_descr' => 'Itinéraire de test.',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ];
  }

  public function testAccesSansVeloAvecVarianteEtDeuxVariantesCoexistent(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Variantes pied', 45.2, 5.2, ['bus']);

    $this->postPied($arretId, $falaiseId, ['description' => 'Par la route']);
    $res = $this->postPied($arretId, $falaiseId, ['velo_variante' => 'Par le sentier', 'description' => 'Par le bois', 'velo_km' => '1.2'], ['gpx_file' => self::GPX_FIXTURE]);

    $this->assertSame(302, $res['status'], $res['raw']);
    $rows = self::dbQuery("SELECT acces_id, variante, variante_formate, description FROM acces_falaise WHERE type = 'pied' AND arret_id = $arretId AND falaise_id = $falaiseId ORDER BY acces_id");
    $this->assertCount(2, $rows, 'une variante nommée est un autre accès, pas un complément de l\'accès sans variante');
    $this->assertSame('', $rows[0]['variante']);
    $this->assertSame('Par le sentier', $rows[1]['variante']);
    $this->assertSame('par-le-sentier', $rows[1]['variante_formate']);
    $row = self::dbQueryOne("SELECT depart_slug, arrivee_slug FROM acces_falaise WHERE acces_id = {$rows[1]['acces_id']}");
    $path = dirname(__DIR__, 2) . "/public/gpx/{$rows[1]['acces_id']}_{$row['depart_slug']}_{$row['arrivee_slug']}_par-le-sentier.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) { if (file_exists($path)) unlink($path); });
    $this->assertFileExists($path, 'le nom du GPX porte le slug de la variante, comme pour un itinéraire vélo');

    // Même variante rejouée sans rien de nouveau : refusé
    $encore = $this->postPied($arretId, $falaiseId, ['velo_variante' => 'Par le sentier', 'description' => 'Autre', 'velo_km' => '9'], ['gpx_file' => self::GPX_FIXTURE]);
    $this->assertStringContainsString('existe déjà', $encore['raw']);
  }
}
