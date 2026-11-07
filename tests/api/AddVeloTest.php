<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/add_velo.php : création d'un itinéraire vélo à partir d'une gare et
 * d'une falaise EXISTANTES (témoins ApiTestCase::WITNESS_*, cf. tests/e2e),
 * plutôt que de fixtures fraîchement créées — pour vérifier que l'itinéraire
 * créé est réellement exploitable dans son contexte réel (jointures gare/
 * falaise déjà peuplées, gpx écrit sur le vrai dossier de données), pas
 * seulement que l'INSERT réussit.
 */
final class AddVeloTest extends ApiTestCase
{
  private const GPX_FIXTURE = __DIR__ . '/../fixtures/velo-with-wpt.gpx';
  private const GPX_INVALID_XML_FIXTURE = __DIR__ . '/../fixtures/test.png'; // pas du XML du tout
  private const GPX_WRONG_ROOT_FIXTURE = __DIR__ . '/../fixtures/not-a-gpx.xml'; // XML valide, racine != <gpx>

  public function testItineraireCreeEstExploitableViaFetchVelosEtFalaisePhp(): void
  {
    $created = $this->creerItineraireVelo();
    $veloId = $created['veloId'];

    $this->assertFileExists($created['gpxPath'], 'le GPX nettoyé aurait dû être écrit dans public/gpx/');
    $gpxContent = file_get_contents($created['gpxPath']);
    $this->assertStringNotContainsString('<wpt', $gpxContent, 'les waypoints auraient dû être retirés du GPX enregistré');
    $this->assertStringContainsString('<trkpt', $gpxContent, 'la trace aurait dû être conservée dans le GPX enregistré');

    // Exploitable via fetch_velos.php (utilisé par l'éditeur falaise pour la
    // cascade falaise -> gare -> variante)
    $found = $this->trouverDansFetchVelos($veloId);
    $this->assertNotNull($found, "l'itinéraire créé (#$veloId) n'apparaît pas dans fetch_velos.php");
    $this->assertSame(self::WITNESS_GARE_ID, $found['arret_id']);
    $this->assertNotEmpty($found['arret']['nom'], 'l\'arrêt joint par fetch_velos.php devrait avoir un nom');
    $this->assertNotNull($found['gpx_url'], 'fetch_velos.php devrait détecter le GPX tout juste écrit');

    // Exploitable sur falaise.php (donnée publique affichée aux visiteurs)
    $foundOnPage = $this->trouverSurFalaisePhp($veloId);
    $this->assertNotNull($foundOnPage, "l'itinéraire créé (#$veloId) n'apparaît pas sur falaise.php");
    $this->assertSame(self::WITNESS_GARE_ID, (int) $foundOnPage['gare_id']);
    $this->assertNotEmpty($foundOnPage['gare_nom']);
  }

  public function testFlagPiedUniquementEstIgnoreEnModeVelo(): void
  {
    // Lot 5 : les accès à pied uniquement passent par mode=pied
    // (acces_pieton_falaise), cf. AddAccesTest. Un ancien formulaire en cache
    // qui enverrait encore la case ne doit pas créer d'itinéraire « à pied uniquement ».
    $created = $this->creerItineraireVelo(['velo_apieduniquement' => '1']);

    $foundOnPage = $this->trouverSurFalaisePhp($created['veloId']);
    $this->assertNotNull($foundOnPage);
    $stocke = self::dbQueryOne("SELECT velo_apieduniquement FROM velo WHERE velo_id = {$created['veloId']}");
    $this->assertSame('0', $stocke['velo_apieduniquement']);
  }

  public function testItineraireVeloEtPiedApparaitDansListeVelos(): void
  {
    $created = $this->creerItineraireVelo(['velo_apiedpossible' => '1']);

    $found = $this->trouverDansFetchVelos($created['veloId']);
    $this->assertNotNull($found, "l'itinéraire vélo-et-pied n'apparaît pas dans la liste des itinéraires vélo");
    $this->assertArrayNotHasKey('velo_apieduniquement', $found, 'Lot 8 : champ retiré, les accès à pied sont dans acces_pieton_falaise');
    $this->assertSame(1, $found['velo_apiedpossible']);
  }

  public function testSansFichierGpxEstRefuse(): void
  {
    $gare = self::dbQueryOne('SELECT gare_nomformate FROM gares WHERE gare_id = ' . self::WITNESS_GARE_ID);
    $falaise = self::dbQueryOne('SELECT falaise_nomformate FROM falaises WHERE falaise_id = ' . self::WITNESS_FALAISE_ID);
    $varianteformate = 'phpunit-test-' . bin2hex(random_bytes(4));

    $res = $this->httpPostMultipart('/api/add_velo.php', $this->champsDeBase($gare, $falaise, $varianteformate));

    $this->assertStringContainsString('Il manque le fichier GPX.', $res['raw']);
    $this->assertNull(
      self::dbQueryOne("SELECT velo_id FROM velo WHERE velo_varianteformate = '$varianteformate'"),
      'aucune ligne velo ne doit être créée sans fichier GPX'
    );
  }

  public function testGpxDansUnFormatNonXmlEstRefuse(): void
  {
    $this->assertUploadRefuse(self::GPX_INVALID_XML_FIXTURE, "n'est pas un XML valide");
  }

  public function testXmlSansRacineGpxEstRefuse(): void
  {
    $this->assertUploadRefuse(self::GPX_WRONG_ROOT_FIXTURE, "n'est pas valide");
  }

  private function assertUploadRefuse(string $fixture, string $messageAttendu): void
  {
    $gare = self::dbQueryOne('SELECT gare_nomformate FROM gares WHERE gare_id = ' . self::WITNESS_GARE_ID);
    $falaise = self::dbQueryOne('SELECT falaise_nomformate FROM falaises WHERE falaise_id = ' . self::WITNESS_FALAISE_ID);
    $varianteformate = 'phpunit-test-' . bin2hex(random_bytes(4));

    $res = $this->httpPostMultipart(
      '/api/add_velo.php',
      $this->champsDeBase($gare, $falaise, $varianteformate),
      ['gpx_file' => $fixture]
    );

    $this->assertStringContainsString($messageAttendu, $res['raw']);
    $this->assertNull(
      self::dbQueryOne("SELECT velo_id FROM velo WHERE velo_varianteformate = '$varianteformate'"),
      'aucune ligne velo ne doit être créée avec un GPX invalide'
    );
  }

  /** @return array{gpxPath:string, veloId:int} */
  private function creerItineraireVelo(array $champsSupplementaires = []): array
  {
    $gare = self::dbQueryOne('SELECT gare_nomformate FROM gares WHERE gare_id = ' . self::WITNESS_GARE_ID);
    $this->assertNotNull($gare, 'gare témoin absente : la BDD locale a-t-elle changé ?');
    $falaise = self::dbQueryOne('SELECT falaise_nomformate FROM falaises WHERE falaise_id = ' . self::WITNESS_FALAISE_ID);
    $this->assertNotNull($falaise, 'falaise témoin absente : la BDD locale a-t-elle changé ?');

    $varianteformate = 'phpunit-test-' . bin2hex(random_bytes(4));
    $champs = array_merge($this->champsDeBase($gare, $falaise, $varianteformate), $champsSupplementaires);

    $res = $this->httpPostMultipart('/api/add_velo.php', $champs, ['gpx_file' => self::GPX_FIXTURE]);

    $this->assertSame(302, $res['status'], "réponse inattendue : {$res['raw']}");
    $this->assertNotNull($res['location']);
    $this->assertStringContainsString('/ajout/confirmation_velo.php', $res['location']);

    $created = self::dbQueryOne(
      "SELECT velo_id FROM velo WHERE arret_id = " . self::WITNESS_GARE_ID
      . " AND falaise_id = " . self::WITNESS_FALAISE_ID
      . " AND velo_varianteformate = '$varianteformate'"
    );
    $this->assertNotNull($created, "aucune ligne velo créée pour la variante $varianteformate");
    $veloId = (int) $created['velo_id'];
    $this->cleanupOnTearDown("DELETE FROM velo WHERE velo_id = $veloId");

    $gpxPath = dirname(__DIR__, 2) . "/public/gpx/{$veloId}_{$gare['gare_nomformate']}_{$falaise['falaise_nomformate']}_{$varianteformate}.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($gpxPath) {
      if (file_exists($gpxPath)) {
        unlink($gpxPath);
      }
    });

    return ['gpxPath' => $gpxPath, 'veloId' => $veloId];
  }

  private function champsDeBase(array $gare, array $falaise, string $varianteformate): array
  {
    return [
      'admin' => '0',
      'arret_id' => (string) self::WITNESS_GARE_ID,
      'falaise_id' => (string) self::WITNESS_FALAISE_ID,
      'velo_depart' => $gare['gare_nomformate'],
      'velo_arrivee' => $falaise['falaise_nomformate'],
      'velo_variante' => 'Test PHPUnit',
      'velo_varianteformate' => $varianteformate,
      'velo_km' => '5.5',
      'velo_dplus' => '100',
      'velo_dmoins' => '20',
      'velo_descr' => 'Itinéraire de test créé par AddVeloTest.',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ];
  }

  private function trouverDansFetchVelos(int $veloId): ?array
  {
    $fetch = $this->httpGet('/api/fetch_velos.php?falaise_id=' . self::WITNESS_FALAISE_ID);
    $this->assertSame(200, $fetch['status']);
    foreach ($fetch['body']['velos'] as $v) {
      if ($v['velo_id'] === $veloId) {
        return $v;
      }
    }
    return null;
  }

  private function trouverSurFalaisePhp(int $veloId): ?array
  {
    $page = $this->httpGet('/falaise.php?falaise_id=' . self::WITNESS_FALAISE_ID);
    $itineraires = self::extractJsValue($page['raw'], 'const itineraires = ');
    foreach ($itineraires as $it) {
      if ((int) $it['velo_id'] === $veloId) {
        return $it;
      }
    }
    return null;
  }
}
