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
    // falaise.php n'expose plus gare_id ni falaise_id (champs réduits, cf. « fix email leak ») :
    // le nom et les coordonnées de la gare jointe prouvent que l'arrêt est bien relié.
    $this->assertNotEmpty($foundOnPage['gare_nom']);
    $this->assertNotEmpty($foundOnPage['gare_latlng']);
  }

  public function testFlagPiedUniquementEstIgnoreEnModeVelo(): void
  {
    // Lot 5 : les accès à pied passent par mode=pied, cf. AddAccesTest. Un ancien
    // formulaire en cache qui enverrait encore la case ne doit pas créer d'accès
    // « à pied uniquement » : en mode vélo, le type stocké reste `velo`.
    $created = $this->creerItineraireVelo(['velo_apieduniquement' => '1']);

    $foundOnPage = $this->trouverSurFalaisePhp($created['veloId']);
    $this->assertNotNull($foundOnPage);
    $stocke = self::dbQueryOne("SELECT type FROM acces_falaise WHERE acces_id = {$created['veloId']}");
    $this->assertSame('velo', $stocke['type']);
  }

  public function testItineraireDeMoinsDeCinqKmEstFaisableAPiedSansCaseCochee(): void
  {
    // Lot 8quater : « à pied possible » se déduit de la distance (≤ 5 km), il n'est plus saisi.
    $created = $this->creerItineraireVelo(['velo_km' => '4.5']);

    $found = $this->trouverDansFetchVelos($created['veloId']);
    $this->assertNotNull($found, "l'itinéraire court n'apparaît pas dans la liste des itinéraires vélo");
    $this->assertArrayNotHasKey('velo_apieduniquement', $found, 'Lot 8 : champ retiré, les accès à pied sont de type pied');
    $this->assertSame(1, $found['velo_apiedpossible']);
  }

  public function testItineraireDePlusDeCinqKmNEstPasFaisableAPiedMemeAvecLAncienneCase(): void
  {
    $created = $this->creerItineraireVelo(['velo_km' => '5.5', 'velo_apiedpossible' => '1']);

    $found = $this->trouverDansFetchVelos($created['veloId']);
    $this->assertNotNull($found);
    $this->assertSame(0, $found['velo_apiedpossible'], 'la case de l\'ancien formulaire est ignorée : seule la distance compte');
  }

  public function testContributeurEstEcritEnNomEtMailSepares(): void
  {
    $created = $this->creerItineraireVelo();
    $row = self::dbQueryOne("SELECT type, contrib, contrib_mail FROM acces_falaise WHERE acces_id = {$created['veloId']}");
    $this->assertSame('velo', $row['type']);
    $this->assertSame('PHPUnit', $row['contrib']);
    $this->assertSame('phpunit@example.org', $row['contrib_mail']);
  }

  public function testUneVarianteDejaPresenteEstRefuseeSansCreerDeDoublon(): void
  {
    $created = $this->creerItineraireVelo();
    $row = self::dbQueryOne("SELECT variante FROM acces_falaise WHERE acces_id = {$created['veloId']}");
    $gare = self::dbQueryOne('SELECT gare_nomformate FROM gares WHERE gare_id = ' . self::WITNESS_GARE_ID);
    $falaise = self::dbQueryOne('SELECT falaise_nomformate FROM falaises WHERE falaise_id = ' . self::WITNESS_FALAISE_ID);

    $res = $this->httpPostMultipart(
      '/api/add_velo.php',
      $this->champsDeBase($gare, $falaise, 'phpunit-test-' . bin2hex(random_bytes(4))), // même variante « {$row['variante']} »
      ['gpx_file' => self::GPX_FIXTURE]
    );

    $this->assertStringContainsString('existe déjà', $res['raw']);
    $n = self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE type = 'velo' AND arret_id = " . self::WITNESS_GARE_ID
      . " AND falaise_id = " . self::WITNESS_FALAISE_ID . " AND variante = '" . self::escape($row['variante']) . "'");
    $this->assertSame('1', $n['n']);
  }

  public function testSansFichierGpxEstRefuse(): void
  {
    $gare = self::dbQueryOne('SELECT gare_nomformate FROM gares WHERE gare_id = ' . self::WITNESS_GARE_ID);
    $falaise = self::dbQueryOne('SELECT falaise_nomformate FROM falaises WHERE falaise_id = ' . self::WITNESS_FALAISE_ID);
    $varianteformate = 'phpunit-test-' . bin2hex(random_bytes(4));

    $res = $this->httpPostMultipart('/api/add_velo.php', $this->champsDeBase($gare, $falaise, $varianteformate));

    $this->assertStringContainsString('Il manque le fichier GPX.', $res['raw']);
    $this->assertNull(
      self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE variante_formate = '$varianteformate'"),
      'aucun accès ne doit être créé sans fichier GPX'
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
      self::dbQueryOne("SELECT acces_id FROM acces_falaise WHERE variante_formate = '$varianteformate'"),
      'aucun accès ne doit être créé avec un GPX invalide'
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
      "SELECT acces_id FROM acces_falaise WHERE type = 'velo' AND arret_id = " . self::WITNESS_GARE_ID
      . " AND falaise_id = " . self::WITNESS_FALAISE_ID
      . " AND variante_formate = '$varianteformate'"
    );
    $this->assertNotNull($created, "aucun accès vélo créé pour la variante $varianteformate");
    $veloId = (int) $created['acces_id'];
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE acces_id = $veloId");

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
