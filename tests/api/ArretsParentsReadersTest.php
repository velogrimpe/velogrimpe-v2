<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot P3 (docs/plan-arrets-parents.md) : les arrêts enfants ne sont pas sélectionnables (formulaires,
 * éditeur de falaise, cibles d'accès / de trajets train) ; la carte expose les parents avec leurs enfants,
 * et les lignes desservant les enfants remontent sur le parent.
 */
final class ArretsParentsReadersTest extends ApiTestCase
{
  /** @return array{parent:int, enfant1:int, enfant2:int} parent « PHPUnit Lecteur Parent », enfants « PHPUnit Lecteur Enfant 1/2 » */
  private function createParentAvecEnfants(array $types = ['ter'], float $lat = 43.8270, float $lng = 5.3830): array
  {
    $e1 = $this->createFixtureArret('PHPUnit Lecteur Enfant 1', $lat, $lng, $types);
    $e2 = $this->createFixtureArret('PHPUnit Lecteur Enfant 2', $lat + 0.0004, $lng + 0.0004, $types);
    $res = $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $e1, 'cible_id' => $e2], ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $p = (int) $res['body']['parent_id'];
    $this->cleanupOnTearDown("DELETE FROM arrets WHERE id = $p");
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE arret_id = $p");
    $this->cleanupOnTearDown("UPDATE arrets SET parent_id = NULL WHERE parent_id = $p");
    self::dbExec("UPDATE arrets SET nom = 'PHPUnit Lecteur Parent' WHERE id = $p");
    return ['parent' => $p, 'enfant1' => $e1, 'enfant2' => $e2];
  }

  private function assertPageListeLeParentSeulement(string $path): void
  {
    $res = $this->httpGet($path);
    $this->assertSame(200, $res['status'], $path);
    $this->assertStringContainsString('PHPUnit Lecteur Parent', $res['raw'], "$path doit proposer le parent");
    $this->assertStringNotContainsString('PHPUnit Lecteur Enfant', $res['raw'], "$path ne doit pas proposer les enfants");
  }

  // --- formulaires -------------------------------------------------------------------------------

  public function testFormulaireAjoutAccesProposeLeParentPasLesEnfants(): void
  {
    $this->createParentAvecEnfants(['ter']);
    $this->assertPageListeLeParentSeulement('/ajout/ajout_velo.php');
  }

  public function testFormulaireAjoutTrainProposeLeParentPasLesEnfants(): void
  {
    $this->createParentAvecEnfants(['ter']);
    $this->assertPageListeLeParentSeulement('/ajout/ajout_train.php');
  }

  public function testFormulaireSortieProposeLeParentPasLesEnfants(): void
  {
    $this->createParentAvecEnfants(['ter']);
    $this->assertPageListeLeParentSeulement('/ajout/ajout_sortie.php');
  }

  // --- éditeur de falaise ------------------------------------------------------------------------

  public function testFetchArretsRenvoieLeParentEtPasLesEnfants(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $res = $this->httpGet('/api/fetch_arrets.php?falaise_id=' . self::WITNESS_FALAISE_ID . '&bbox=43.82,5.38,43.84,5.40');
    $this->assertSame(200, $res['status'], $res['raw']);
    $renvoyes = array_map(fn($a) => (int) $a['id'], $res['body']['arrets']);
    $this->assertContains($ids['parent'], $renvoyes);
    $this->assertNotContains($ids['enfant1'], $renvoyes);
    $this->assertNotContains($ids['enfant2'], $renvoyes);
  }

  // --- cibles d'accès et de trajets ----------------------------------------------------------------

  public function testAccesVersUnEnfantEstRefuse(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $falaise = $this->createFixtureFalaise();
    $res = $this->httpPostMultipart('/api/add_velo.php', [
      'mode' => 'pied', 'admin' => '0', 'arret_id' => (string) $ids['enfant1'], 'falaise_id' => (string) $falaise,
      'description' => 'Accès de test.', 'nom_prenom' => 'PHPUnit', 'email' => 'phpunit@example.org',
    ]);
    $this->assertStringContainsString('arrêt', mb_strtolower($res['raw']));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_falaise WHERE arret_id = {$ids['enfant1']}"));
  }

  public function testAccesVersLeParentEstAccepteEtExploitable(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $falaise = $this->createFixtureFalaise();
    $res = $this->httpPostMultipart('/api/add_velo.php', [
      'mode' => 'pied', 'admin' => '0', 'arret_id' => (string) $ids['parent'], 'falaise_id' => (string) $falaise,
      'description' => 'Accès de test.', 'nom_prenom' => 'PHPUnit', 'email' => 'phpunit@example.org',
    ]);
    $this->assertSame(302, $res['status'], $res['raw']);
    $fetch = $this->httpGet("/api/fetch_arrets.php?falaise_id=$falaise");
    $this->assertContains($ids['parent'], array_map(fn($a) => (int) $a['id'], $fetch['body']['arrets']));
  }

  public function testTrainVersUnEnfantEstRefuseEtVersLeParentAccepte(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $champs = fn(int $arret) => [
      'admin' => '0', 'arret_id' => (string) $arret, 'ville_id' => (string) self::WITNESS_VILLE_ID,
      'train_temps' => '45', 'train_correspmin' => '0', 'train_correspmax' => '1', 'train_public' => '2',
      'train_descr' => 'Car direct.', 'horaires_depart' => 'Lyon Part-Dieu', 'train_arrivee' => 'PHPUnit arrivée',
      'nom_prenom' => 'PHPUnit', 'email' => 'phpunit@example.org',
    ];
    $this->cleanupOnTearDown("DELETE FROM train WHERE arret_id IN ({$ids['parent']}, {$ids['enfant1']})");

    $refuse = $this->httpPostMultipart('/api/add_train.php', $champs($ids['enfant1']));
    $this->assertSame(400, $refuse['status'], $refuse['raw']);
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM train WHERE arret_id = {$ids['enfant1']}"));

    $accepte = $this->httpPostMultipart('/api/add_train.php', $champs($ids['parent']));
    $this->assertSame(302, $accepte['status'], $accepte['raw']);
    $this->assertNotNull(self::dbQueryOne("SELECT 1 AS x FROM train WHERE arret_id = {$ids['parent']}"));
  }

  // --- carte ---------------------------------------------------------------------------------------

  public function testCarteExposeLeParentAvecSesEnfantsEtSesLignes(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $l = self::dbInsert("INSERT INTO lignes_transport (nom, numero) VALUES ('PHPUnit ligne carte', 'PHPT9')");
    self::dbExec("INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES ($l, {$ids['enfant1']})");
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $l");

    $res = $this->httpGet('/carte.php');
    $this->assertSame(200, $res['status']);
    $arrets = [];
    foreach (self::extractJsValue($res['raw'], 'const arretsBase = ') as $a) $arrets[(int) $a['arret_id']] = $a;

    $this->assertArrayHasKey($ids['parent'], $arrets);
    $this->assertArrayNotHasKey($ids['enfant1'], $arrets, "un enfant n'est pas un point de la carte à lui seul");
    $this->assertArrayNotHasKey($ids['enfant2'], $arrets);

    $parent = $arrets[$ids['parent']];
    $this->assertContains('PHPT9', $parent['lignes'], 'les lignes des enfants remontent sur le parent');
    $enfants = [];
    foreach ($parent['enfants'] as $e) $enfants[(int) $e['arret_id']] = $e;
    $this->assertEqualsCanonicalizing([$ids['enfant1'], $ids['enfant2']], array_keys($enfants));
    $this->assertSame('PHPUnit Lecteur Enfant 1', $enfants[$ids['enfant1']]['arret_nom']);
    $this->assertMatchesRegularExpression('/^43\.827\d*,5\.383\d*$/', $enfants[$ids['enfant1']]['arret_latlng']);
    $this->assertSame(['bus'], $enfants[$ids['enfant1']]['types']);
  }

  public function testLesArretsDUneLigneExposentLeurParent(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $orphelin = $this->createFixtureArret('PHPUnit Lecteur orphelin ligne', 43.9, 5.5, ['bus']);
    $l = self::dbInsert("INSERT INTO lignes_transport (nom, numero) VALUES ('PHPUnit ligne parent', 'PHPT8')");
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $l");
    foreach ([$ids['enfant1'], $ids['enfant2'], $orphelin] as $a) {
      self::dbExec("INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES ($l, $a)");
    }

    $res = $this->httpGet("/api/fetch_lignes.php?arret_id={$ids['enfant1']}");
    $this->assertSame(200, $res['status'], $res['raw']);
    $arrets = [];
    foreach ($res['body']['lignes'][0]['arrets'] as $a) $arrets[(int) $a['id']] = $a;
    $this->assertSame($ids['parent'], $arrets[$ids['enfant1']]['parent_id']);
    $this->assertSame($ids['parent'], $arrets[$ids['enfant2']]['parent_id']);
    $this->assertNull($arrets[$orphelin]['parent_id']);
  }

  // --- lignes portées par les enfants, lues « par arrêt d'accès » (donc par le parent) ---------------------

  /** Parent à deux enfants ; la ligne PHPT7 dessert les DEUX enfants (elle ne doit apparaître qu'une fois). */
  private function parentDesserviParUneLigne(): array
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $l = self::dbInsert("INSERT INTO lignes_transport (nom, numero) VALUES ('PHPUnit ligne parent', 'PHPT7')");
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $l");
    self::dbExec("INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES ($l, {$ids['enfant1']}), ($l, {$ids['enfant2']})");
    return $ids + ['ligne' => $l];
  }

  public function testLaPageFalaiseListeLesLignesDesEnfantsSurLeParent(): void
  {
    $ids = $this->parentDesserviParUneLigne();
    $falaise = $this->createFixtureFalaise();
    $this->createFixtureAccesPied($ids['parent'], $falaise);

    $res = $this->httpGet("/falaise.php?falaise_id=$falaise");
    $this->assertSame(200, $res['status']);
    $acces = [];
    foreach (self::extractJsValue($res['raw'], 'const accesPietons = ') as $a) $acces[(int) $a['arret_id']] = $a;
    $this->assertArrayHasKey($ids['parent'], $acces);
    $this->assertSame([$ids['ligne']], array_map(fn($l) => (int) $l['id'], $acces[$ids['parent']]['lignes']), 'une seule fois, malgré deux enfants desservis');
  }

  public function testFetchLignesParArretDuParentRetrouveLesLignesDesEnfants(): void
  {
    $ids = $this->parentDesserviParUneLigne();
    $res = $this->httpGet("/api/fetch_lignes.php?arret_id={$ids['parent']}");
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame([$ids['ligne']], array_map(fn($l) => (int) $l['id'], $res['body']['lignes']));
  }

  public function testOpenDataRattacheLesLignesAuParentEtPasAuxEnfants(): void
  {
    $ids = $this->parentDesserviParUneLigne();
    $config = require dirname(__DIR__, 2) . '/config.php';
    $ch = curl_init(VG_TEST_BASE_URL . '/api/private/crons/export_open_data.php');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 240, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $config['vg_token']]]);
    curl_exec($ch);
    $this->assertSame(200, curl_getinfo($ch, CURLINFO_HTTP_CODE));
    curl_close($ch);

    $dir = dirname(__DIR__, 2) . '/public/open-data';
    $arretsExportes = array_map(fn($f) => (int) $f['properties']['id'], json_decode(file_get_contents("$dir/arrets.geojson"), true)['features']);
    $this->assertContains($ids['parent'], $arretsExportes);
    $this->assertNotContains($ids['enfant1'], $arretsExportes, 'les enfants ne sont pas exportés comme arrêts');

    foreach (json_decode(file_get_contents("$dir/lignes.geojson"), true)['features'] as $f) {
      if ((int) $f['properties']['id'] !== $ids['ligne']) continue;
      $this->assertSame([$ids['parent']], $f['properties']['arret_ids'], 'la ligne dessert le parent, une seule fois');
      return;
    }
    $this->fail('ligne absente de lignes.geojson');
  }

  public function testCarteSansEnfantsExposeUneListeVide(): void
  {
    $a = $this->createFixtureArret('PHPUnit Lecteur orphelin carte', 43.8271, 5.3831, ['bus']);
    $res = $this->httpGet('/carte.php');
    foreach (self::extractJsValue($res['raw'], 'const arretsBase = ') as $arret) {
      if ((int) $arret['arret_id'] === $a) {
        $this->assertSame([], $arret['enfants']);
        return;
      }
    }
    $this->fail("l'arrêt orphelin devrait être sur la carte");
  }

  public function testSuppressionLogiqueDunEnfantLeRetireDesEnfantsExposes(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $e3 = $this->createFixtureArret('PHPUnit Lecteur Enfant 3', 43.8272, 5.3832, ['bus']);
    $this->assertSame(200, $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $e3, 'cible_id' => $ids['parent']], ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']])['status']);
    $this->assertSame(200, $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $e3], ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']])['status']);

    $res = $this->httpGet('/carte.php');
    foreach (self::extractJsValue($res['raw'], 'const arretsBase = ') as $arret) {
      if ((int) $arret['arret_id'] === $ids['parent']) {
        $this->assertEqualsCanonicalizing([$ids['enfant1'], $ids['enfant2']], array_map(fn($e) => (int) $e['arret_id'], $arret['enfants']));
        return;
      }
    }
    $this->fail('parent absent de la carte');
  }

  // --- suppression du dernier enfant ----------------------------------------------------------------

  public function testSupprimerLeDernierEnfantEstRefuse(): void
  {
    $ids = $this->createParentAvecEnfants(['bus']);
    $admin = ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']];
    $this->assertSame(200, $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $ids['enfant1']], $admin)['status']);
    $res = $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $ids['enfant2']], $admin);
    $this->assertSame(409, $res['status'], $res['raw']);
  }
}
