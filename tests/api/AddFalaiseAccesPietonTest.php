<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/add_falaise.php, Lot 8 : à la création, le champ `arrets_pietons`
 * (liste JSON d'ids d'arrêts) crée les accès piétons arrêt → falaise
 * (`acces_falaise`, type `pied`) en même temps que la falaise. Tous les arrêts sont
 * validés avant la moindre écriture : un arrêt inconnu ou supprimé refuse
 * toute la création (pas de falaise sans ses accès).
 */
final class AddFalaiseAccesPietonTest extends ApiTestCase
{
  private function champsFalaise(string $slug, array $extra = []): array
  {
    return array_merge([
      'admin' => '0',
      'falaise_public' => '2',
      'falaise_nom' => 'PHPUnit ' . $slug,
      'falaise_nomformate' => $slug,
      'falaise_latlng' => '45.1234,6.2355',
      'falaise_exposhort1' => 'S',
      'falaise_cotmin' => '5-',
      'falaise_cotmax' => '6-',
      'falaise_maa' => '10',
      'falaise_mar' => '5',
      'falaise_topo' => 'Topo test',
      'falaise_expotxt' => 'Sud',
      'falaise_matxt' => '10 min',
      'falaise_voletcarto' => 'Résumé',
      'falaise_voies' => 'Quelques voies',
      'falaise_nbvoies' => '20',
      'falaise_bloc' => '0',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ], $extra);
  }

  private function slug(): string
  {
    $slug = 'phpunit-pieton-' . bin2hex(random_bytes(4));
    $this->cleanupOnTearDown("DELETE FROM falaises WHERE falaise_nomformate = '$slug'");
    // acces_falaise sans cascade (Lot 8quater) : les accès partent avant la falaise.
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE falaise_id IN (SELECT falaise_id FROM falaises WHERE falaise_nomformate = '$slug')");
    return $slug;
  }

  private function falaiseId(string $slug): ?int
  {
    $row = self::dbQueryOne("SELECT falaise_id FROM falaises WHERE falaise_nomformate = '$slug'");
    return $row ? (int) $row['falaise_id'] : null;
  }

  public function testCreationAvecPlusieursArretsPietonsEcritLesAcces(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Arrêt piéton 1', 45.12, 6.23, ['bus']);
    $a2 = $this->createFixtureArret('PHPUnit Arrêt piéton 2', 45.13, 6.24, ['tram']);
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, [
      'arrets_pietons' => json_encode([$a1, $a2]),
    ]));

    $this->assertSame(302, $res['status'], $res['raw']);
    $falaiseId = $this->falaiseId($slug);
    $this->assertNotNull($falaiseId);

    $rows = self::dbQuery("SELECT arret_id, type, depart_slug, arrivee_slug, public, contrib, contrib_mail FROM acces_falaise WHERE falaise_id = $falaiseId ORDER BY arret_id");
    $this->assertSame([$a1, $a2], array_map(fn($r) => (int) $r['arret_id'], $rows));
    $this->assertSame('PHPUnit', $rows[0]['contrib']);
    $this->assertSame('phpunit@example.org', $rows[0]['contrib_mail']);
    $this->assertSame('pied', $rows[0]['type']);
    $this->assertSame('1', $rows[0]['public']);
    $this->assertNotSame('', $rows[0]['depart_slug'], 'slugs renseignés comme pour un accès vélo');
    $this->assertNotSame('', $rows[0]['arrivee_slug']);

    $log = self::dbQueryOne("SELECT 1 AS x FROM edit_logs WHERE collection = 'acces_falaise' AND falaise_id = $falaiseId");
    $this->assertNotNull($log, "la création des accès doit être tracée dans edit_logs");
  }

  public function testArretInconnuRefuseLaCreationSansRienEcrire(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Arrêt piéton ok');
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, [
      'arrets_pietons' => json_encode([$a1, 99999999]),
    ]));

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertNull($this->falaiseId($slug), "aucune falaise ne doit être créée");
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE arret_id = $a1"));
  }

  public function testArretSupprimeEstRefuse(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Arrêt supprimé');
    self::dbExec("UPDATE arrets SET deleted = 1 WHERE id = $a1");
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, [
      'arrets_pietons' => json_encode([$a1]),
    ]));

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertNull($this->falaiseId($slug));
  }

  public function testChampMalFormeEstRefuse(): void
  {
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, [
      'arrets_pietons' => 'pas du json',
    ]));

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertNull($this->falaiseId($slug));
  }

  public function testSansArretsPietonsLaCreationResteInchangee(): void
  {
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug));

    $this->assertSame(302, $res['status'], $res['raw']);
    $falaiseId = $this->falaiseId($slug);
    $this->assertNotNull($falaiseId);
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE falaise_id = $falaiseId"));
  }

  public function testEnEditionLeChampEstIgnore(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $a1 = $this->createFixtureArret('PHPUnit Arrêt édition');

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise('phpunit-fixture', [
      'falaise_id' => (string) $falaiseId,
      'arrets_pietons' => json_encode([$a1]),
    ]));

    $this->assertSame(302, $res['status'], $res['raw']);
    $this->assertNull(
      self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE falaise_id = $falaiseId"),
      "en édition, les accès se gèrent depuis l'éditeur de détails, pas ici"
    );
  }

  public function testDetailsEtGpxParArretALaCreation(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Arrêt détail 1', 45.12, 6.23, ['bus']);
    $a2 = $this->createFixtureArret('PHPUnit Arrêt détail 2', 45.13, 6.24, ['ter']);
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, [
      'arrets_pietons' => json_encode([$a1, $a2]),
      "acces_pieton[$a1][description]" => 'Sentier du lavoir',
      "acces_pieton[$a1][km]" => '1.4',
      "acces_pieton[$a1][dplus]" => '90',
    ]), ["acces_gpx_$a1" => __DIR__ . '/../fixtures/velo-with-wpt.gpx']);

    $this->assertSame(302, $res['status'], $res['raw']);
    $falaiseId = $this->falaiseId($slug);
    $r1 = self::dbQueryOne("SELECT acces_id, depart_slug, arrivee_slug, description, km, dplus, dmoins FROM acces_falaise WHERE arret_id = $a1 AND falaise_id = $falaiseId");
    $this->assertSame('Sentier du lavoir', $r1['description']);
    $this->assertEquals(1.4, (float) $r1['km']);
    $this->assertSame('90', $r1['dplus']);
    $this->assertNull($r1['dmoins']);
    $path = dirname(__DIR__, 2) . "/public/gpx/{$r1['acces_id']}_{$r1['depart_slug']}_{$r1['arrivee_slug']}_.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) { if (file_exists($path)) unlink($path); });
    $this->assertFileExists($path, 'GPX du premier arrêt écrit');
    $r2 = self::dbQueryOne("SELECT description, km FROM acces_falaise WHERE arret_id = $a2 AND falaise_id = $falaiseId");
    $this->assertSame('', $r2['description'], 'sans détails : lien simple, comme avant');
    $this->assertNull($r2['km']);
  }

  public function testGpxInvalideRefuseTouteLaCreation(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Arrêt gpx invalide', 45.12, 6.23, ['bus']);
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, [
      'arrets_pietons' => json_encode([$a1]),
    ]), ["acces_gpx_$a1" => __DIR__ . '/../fixtures/not-a-gpx.xml']);

    $this->assertStringContainsString("n'est pas valide", $res['raw']);
    $this->assertNull($this->falaiseId($slug), 'aucune falaise sans ses accès : GPX validé avant l\'INSERT');
  }

  // --- Accès à vélo à la création (mini-formulaire) ---------------------------

  private function champsAccesVelo(int $arretId, array $extra = []): array
  {
    return array_merge([
      'acces_velo[arret_id]' => (string) $arretId, 'acces_velo[km]' => '7.5', 'acces_velo[dplus]' => '300',
      'acces_velo[dmoins]' => '120', 'acces_velo[variante]' => 'Par le Nord', 'acces_velo[description]' => 'Piste cyclable.',
    ], $extra);
  }

  public function testAccesVeloCreeAvecLaFalaiseEtSaTraceGpx(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Gare vélo', 45.12, 6.23, ['ter']);
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, $this->champsAccesVelo($a1)),
      ['acces_velo_gpx' => __DIR__ . '/../fixtures/velo-with-wpt.gpx']);

    $this->assertSame(302, $res['status'], $res['raw']);
    $falaiseId = $this->falaiseId($slug);
    $r = self::dbQueryOne("SELECT acces_id, type, depart_slug, arrivee_slug, km, dplus, dmoins, variante, variante_formate, description, public FROM acces_falaise WHERE arret_id = $a1 AND falaise_id = $falaiseId");
    $this->assertSame('velo', $r['type']);
    $this->assertEquals(7.5, (float) $r['km']);
    $this->assertSame('300', $r['dplus']);
    $this->assertSame('120', $r['dmoins']);
    $this->assertSame('Par le Nord', $r['variante']);
    $this->assertSame('par-le-nord', $r['variante_formate'], 'slug de variante, comme formatVariante() du formulaire d\'ajout');
    $this->assertSame($slug, $r['arrivee_slug']);
    $this->assertSame('2', $r['public'], 'à valider (non admin)');
    $path = dirname(__DIR__, 2) . "/public/gpx/{$r['acces_id']}_{$r['depart_slug']}_{$r['arrivee_slug']}_par-le-nord.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) { if (file_exists($path)) unlink($path); });
    $this->assertFileExists($path);
    $this->assertStringNotContainsString('<wpt', file_get_contents($path));
    $this->assertNotNull(self::dbQueryOne("SELECT 1 AS x FROM edit_logs WHERE collection = 'acces_falaise' AND falaise_id = $falaiseId"));
  }

  public function testAccesVeloSansGpxRefuseToutLaCreation(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Gare vélo sans gpx', 45.12, 6.23, ['ter']);
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, $this->champsAccesVelo($a1)));

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertStringContainsString('trace GPX est obligatoire', $res['raw']);
    $this->assertNull($this->falaiseId($slug), 'aucune falaise créée sans l\'accès demandé');
  }

  public function testAccesVeloIndicateursObligatoiresEtArretValide(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Gare vélo indic', 45.12, 6.23, ['ter']);
    $slug = $this->slug();
    $gpx = ['acces_velo_gpx' => __DIR__ . '/../fixtures/velo-with-wpt.gpx'];

    $sansKm = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, $this->champsAccesVelo($a1, ['acces_velo[km]' => ''])), $gpx);
    $this->assertSame(400, $sansKm['status']);
    $this->assertStringContainsString('distance est obligatoire', $sansKm['raw']);

    $inconnu = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, $this->champsAccesVelo(99999999)), $gpx);
    $this->assertSame(400, $inconnu['status']);
    $this->assertStringContainsString('Arrêt de départ introuvable', $inconnu['raw']);

    $this->assertNull($this->falaiseId($slug), 'rien n\'est créé en cas de refus');
  }

  public function testAccesVeloEtAccesSansVeloPeuventEtreCreesEnsemble(): void
  {
    $gare = $this->createFixtureArret('PHPUnit Gare combo', 45.12, 6.23, ['ter']);
    $car = $this->createFixtureArret('PHPUnit Car combo', 45.13, 6.24, ['bus']);
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, $this->champsAccesVelo($gare) + [
      'arrets_pietons' => json_encode([$car]),
    ]), ['acces_velo_gpx' => __DIR__ . '/../fixtures/velo-with-wpt.gpx']);

    $this->assertSame(302, $res['status'], $res['raw']);
    $falaiseId = $this->falaiseId($slug);
    $types = array_column(self::dbQuery("SELECT arret_id, type FROM acces_falaise WHERE falaise_id = $falaiseId"), 'type', 'arret_id');
    $this->assertSame([$gare => 'velo', $car => 'pied'], $types);
    $r = self::dbQueryOne("SELECT acces_id, depart_slug, arrivee_slug, variante_formate FROM acces_falaise WHERE arret_id = $gare AND falaise_id = $falaiseId");
    $path = dirname(__DIR__, 2) . "/public/gpx/{$r['acces_id']}_{$r['depart_slug']}_{$r['arrivee_slug']}_{$r['variante_formate']}.gpx";
    $this->cleanupCallbackOnTearDown(function () use ($path) { if (file_exists($path)) unlink($path); });
  }

  public function testEnEditionLeChampAccesVeloEstIgnore(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $a1 = $this->createFixtureArret('PHPUnit Gare vélo édition', 45.12, 6.23, ['ter']);

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise('phpunit-fixture', $this->champsAccesVelo($a1) + [
      'falaise_id' => (string) $falaiseId,
    ]), ['acces_velo_gpx' => __DIR__ . '/../fixtures/velo-with-wpt.gpx']);

    $this->assertSame(302, $res['status'], $res['raw']);
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE falaise_id = $falaiseId"), 'en édition, les accès se gèrent ailleurs');
  }

  public function testVarianteParArretALaCreation(): void
  {
    $a1 = $this->createFixtureArret('PHPUnit Arrêt variante', 45.12, 6.23, ['bus']);
    $slug = $this->slug();

    $res = $this->httpPostMultipart('/api/add_falaise.php', $this->champsFalaise($slug, [
      'arrets_pietons' => json_encode([$a1]),
      "acces_pieton[$a1][variante]" => 'Par le sentier',
      "acces_pieton[$a1][km]" => '1.1',
    ]));

    $this->assertSame(302, $res['status'], $res['raw']);
    $r = self::dbQueryOne("SELECT variante, variante_formate FROM acces_falaise WHERE arret_id = $a1 AND falaise_id = " . $this->falaiseId($slug));
    $this->assertSame('Par le sentier', $r['variante']);
    $this->assertSame('par-le-sentier', $r['variante_formate']);
  }
}
