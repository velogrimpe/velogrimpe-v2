<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/add_velo.php, Lot 5 : le formulaire devient un formulaire d'ajout
 * d'ACCÈS arrêt → falaise. Deux modes, discriminés par le champ `mode` :
 *  - `velo` (défaut) : itinéraire vélo depuis un arrêt QUELCONQUE (les cars
 *    qui prennent les vélos existent) → table `velo`, clé `arret_id`
 *    (renommée depuis `gare_id`, cf. sql_migrations/3_velo_arret_id.sql) ;
 *  - `pied` : accès piéton (description, pas de GPX) → `acces_pieton_falaise`,
 *    jamais `velo`.
 * Les cas vélo depuis une gare sont dans AddVeloTest.
 */
final class AddAccesTest extends ApiTestCase
{
  private const GPX_FIXTURE = __DIR__ . '/../fixtures/velo-with-wpt.gpx';

  // --- Mode piéton ---------------------------------------------------------

  public function testAccesPietonEcritDansAccesPietonFalaiseEtPasDansVelo(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->postPied($arretId, $falaiseId, ['description' => 'Sentier balisé, 15 min.']);

    $this->assertSame(302, $res['status'], $res['raw']);
    $this->assertStringContainsString('/ajout/confirmation_velo.php', $res['location']);
    $this->assertStringContainsString('mode=pied', $res['location']);

    $row = self::dbQueryOne(
      "SELECT description, contrib, contrib_mail FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertNotNull($row, "l'accès piéton aurait dû être écrit dans acces_pieton_falaise");
    $this->assertSame('Sentier balisé, 15 min.', $row['description']);
    $this->assertSame('PHPUnit', $row['contrib']);
    $this->assertSame('phpunit@example.org', $row['contrib_mail']);

    $this->assertNull(
      self::dbQueryOne("SELECT velo_id FROM velo WHERE arret_id = $arretId AND falaise_id = $falaiseId"),
      "un accès piéton ne doit créer aucune ligne dans velo"
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
    $rows = self::dbQuery("SELECT description FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertCount(1, $rows);
    $this->assertSame('Première version', $rows[0]['description'], "le doublon ne doit pas écraser l'existant");
  }

  public function testAccesPietonAvecArretInexistantEstRefuse(): void
  {
    $falaiseId = $this->createFixtureFalaise();

    $res = $this->postPied(999999999, $falaiseId);

    $this->assertStringContainsString('arrêt', mb_strtolower($res['raw']));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_pieton_falaise WHERE falaise_id = $falaiseId"));
  }

  public function testAccesPietonAvecFalaiseInexistanteEstRefuse(): void
  {
    $arretId = $this->createFixtureArret();

    $res = $this->postPied($arretId, 32000);

    $this->assertStringContainsString('falaise', mb_strtolower($res['raw']));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_pieton_falaise WHERE arret_id = $arretId"));
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
    $created = self::dbQueryOne("SELECT velo_id FROM velo WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertNotNull($created, "l'itinéraire vélo depuis un arrêt de bus aurait dû être créé dans velo.arret_id");
    $veloId = (int) $created['velo_id'];
    $this->cleanupOnTearDown("DELETE FROM velo WHERE velo_id = $veloId");
    $gpxPath = dirname(__DIR__, 2) . "/public/gpx/{$veloId}_phpunit-car-velo_phpunit-fixture_{$varianteformate}.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($gpxPath) {
      if (file_exists($gpxPath)) {
        unlink($gpxPath);
      }
    });

    $this->assertNull(
      self::dbQueryOne("SELECT 1 AS x FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"),
      "un itinéraire vélo ne doit pas écrire dans acces_pieton_falaise"
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
    $this->assertNull(self::dbQueryOne("SELECT velo_id FROM velo WHERE velo_varianteformate = '$varianteformate'"));
  }

  public function testPageAjoutVeloPrerempliDepuisArretId(): void
  {
    $arretId = $this->createFixtureArret('PHPUnit Arrêt Prérempli');

    $page = $this->httpGet("/ajout/ajout_velo.php?arret_id=$arretId");

    $this->assertSame(200, $page['status']);
    $this->assertStringContainsString('data-preset-arret-id="' . $arretId . '"', $page['raw']);
  }

  // --- Helpers -------------------------------------------------------------

  private function postPied(int $arretId, int $falaiseId, array $extra = []): array
  {
    return $this->httpPostMultipart('/api/add_velo.php', array_merge([
      'mode' => 'pied',
      'admin' => '0',
      'arret_id' => (string) $arretId,
      'falaise_id' => (string) $falaiseId,
      'description' => 'Accès piéton de test.',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ], $extra));
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
}
