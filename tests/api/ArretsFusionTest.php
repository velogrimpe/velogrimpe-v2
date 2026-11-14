<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot P2 (docs/plan-arrets-parents.md) : fusion d'arrêts en parent / enfants.
 *  - api/merge_arrets.php  : { source_id, cible_id } → regroupement sous un parent (plus de suppression)
 *  - api/detach_arret.php  : { arret_id } → l'enfant redevient orphelin
 *  - api/unmerge_arret.php : { parent_id, heritier_id? } → dissolution du parent
 *  - api/delete_arret.php, api/move_arret.php : comportement avec parents / position manuelle
 */
final class ArretsFusionTest extends ApiTestCase
{
  private function bearer(): array
  {
    return ['Authorization: Bearer ' . (string) VG_TEST_CONFIG['admin_token']];
  }

  private function merge(int $source, int $cible): array
  {
    return $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $source, 'cible_id' => $cible], $this->bearer());
  }

  /** Enregistre le nettoyage d'un parent créé par l'API (enfants détachés d'abord, accès / trains du parent supprimés). */
  private function registerParent(int $p): void
  {
    $this->cleanupOnTearDown("DELETE FROM arrets WHERE id = $p");
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE arret_id = $p");
    $this->cleanupOnTearDown("UPDATE arrets SET parent_id = NULL WHERE parent_id = $p");
    $this->cleanupOnTearDown("DELETE FROM train WHERE arret_id = $p");
  }

  private function mergeOk(int $source, int $cible): int
  {
    $res = $this->merge($source, $cible);
    $this->assertSame(200, $res['status'], $res['raw']);
    $p = (int) $res['body']['parent_id'];
    $this->registerParent($p);
    return $p;
  }

  private function arret(int $id): array
  {
    return self::dbQueryOne(
      "SELECT id, nom, parent_id, deleted, position_manuelle, ter, tgv, bus, tram, teleph, ST_Y(loc) AS lat, ST_X(loc) AS lng
       FROM arrets WHERE id = $id"
    );
  }

  private function createTrain(int $arretId): int
  {
    $id = self::dbInsert(
      "INSERT INTO train (ville_id, arret_id, train_depart, train_arrivee, train_descr, train_public, train_contrib)
       VALUES (" . self::WITNESS_VILLE_ID . ", $arretId, 'phpunit', 'phpunit', '', 1, 'phpunit')"
    );
    $this->cleanupOnTearDown("DELETE FROM train WHERE train_id = $id");
    return $id;
  }

  private function createLigneLiee(int $arretId): int
  {
    $l = self::dbInsert("INSERT INTO lignes_transport (nom) VALUES ('PHPUnit ligne fusion')");
    self::dbExec("INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES ($l, $arretId)");
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $l");
    return $l;
  }

  // --- merge_arrets : protocole ---------------------------------------------------------------

  public function testMergeRequiresBearerAndPost(): void
  {
    $this->assertSame(401, $this->httpPostJson('/api/merge_arrets.php', ['source_id' => 1, 'cible_id' => 2])['status']);
    $this->assertSame(405, $this->httpGet('/api/merge_arrets.php')['status']);
  }

  public function testMergeRejectsMissingOrIdenticalIds(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion A');
    $this->assertSame(400, $this->merge($a, $a)['status']);
    $this->assertSame(400, $this->merge(0, $a)['status']);
  }

  public function testMergeUnknownArretReturns404(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion A');
    $this->assertSame(404, $this->merge($a, 999999999)['status']);
  }

  // --- orphelin + orphelin : création d'un parent -----------------------------------------------

  public function testDeuxOrphelinsDonnentUnParentAuBarycentre(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion Gare', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Fusion Gare (retour)', 43.8010, 5.4020, ['bus']);
    $p = $this->mergeOk($a, $b); // b = cible : le parent reprend ses attributs

    $parent = $this->arret($p);
    $this->assertNotSame($a, $p);
    $this->assertNotSame($b, $p);
    $this->assertNull($parent['parent_id']);
    $this->assertSame('0', $parent['deleted']);
    $this->assertSame('PHPUnit Fusion Gare (retour)', $parent['nom']);
    $this->assertEqualsWithDelta(43.8005, (float) $parent['lat'], 1e-6);
    $this->assertEqualsWithDelta(5.4010, (float) $parent['lng'], 1e-6);

    foreach ([$a, $b] as $enfant) {
      $row = $this->arret($enfant);
      $this->assertSame((string) $p, $row['parent_id']);
      $this->assertSame('0', $row['deleted'], "l'enfant $enfant n'est plus supprimé logiquement");
    }
    // Les positions des enfants ne bougent pas
    $this->assertEqualsWithDelta(43.8000, (float) $this->arret($a)['lat'], 1e-6);
  }

  public function testLeParentCumuleLesModalitesDesEnfants(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion TER', 43.8, 5.4, ['ter']);
    $b = $this->createFixtureArret('PHPUnit Fusion TGV', 43.8, 5.4001, ['tgv']);
    $p = $this->mergeOk($a, $b);
    $parent = $this->arret($p);
    $this->assertSame(['1', '1'], [$parent['ter'], $parent['tgv']]);
    $this->assertSame(['0', '0', '0'], [$parent['bus'], $parent['tram'], $parent['teleph']]);
  }

  public function testFusionEntreModesDifferentsRefusee(): void
  {
    $bus = $this->createFixtureArret('PHPUnit Fusion bus', 43.8, 5.4, ['bus']);
    $ter = $this->createFixtureArret('PHPUnit Fusion gare', 43.8, 5.4001, ['ter']);
    $res = $this->merge($bus, $ter);
    $this->assertSame(409, $res['status'], $res['raw']);
    $this->assertNull($this->arret($bus)['parent_id']);
    $this->assertNull($this->arret($ter)['parent_id']);
  }

  public function testFusionAccepteUnArretMultimodalPartageantUneFamille(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion bus+tram', 43.8, 5.4, ['bus', 'tram']);
    $b = $this->createFixtureArret('PHPUnit Fusion tram', 43.8, 5.4001, ['tram']);
    $this->mergeOk($a, $b);
  }

  // --- relations ------------------------------------------------------------------------------

  public function testAccesEtTrainsVontAuParentLignesEtReferencesRestentSurLEnfant(): void
  {
    $falaise = $this->createFixtureFalaise();
    $a = $this->createFixtureArret('PHPUnit Fusion rel A', 43.8, 5.4, ['ter']);
    $b = $this->createFixtureArret('PHPUnit Fusion rel B', 43.8, 5.4001, ['ter']);
    $acces = $this->createFixtureAcces($a, $falaise);
    $train = $this->createTrain($b);
    $ligne = $this->createLigneLiee($a);
    self::dbExec("INSERT INTO references_externes (arret_id, source, ref) VALUES ($a, 'gtfs', 'STOP_A')");

    $p = $this->mergeOk($a, $b);

    $this->assertSame((string) $p, self::dbQueryOne("SELECT arret_id FROM acces_falaise WHERE acces_id = $acces")['arret_id']);
    $this->assertSame((string) $p, self::dbQueryOne("SELECT arret_id FROM train WHERE train_id = $train")['arret_id']);
    $this->assertSame((string) $a, self::dbQueryOne("SELECT arret_id FROM arrets_lignes_transport WHERE ligne_id = $ligne")['arret_id']);
    $this->assertSame((string) $a, self::dbQueryOne("SELECT arret_id FROM references_externes WHERE ref = 'STOP_A'")['arret_id']);
  }

  public function testAccesIdentiquesRefusentLaFusionSansRienModifier(): void
  {
    $falaise = $this->createFixtureFalaise();
    $a = $this->createFixtureArret('PHPUnit Fusion conflit A', 43.8, 5.4, ['ter']);
    $b = $this->createFixtureArret('PHPUnit Fusion conflit B', 43.8, 5.4001, ['ter']);
    $accesA = $this->createFixtureAcces($a, $falaise);
    $this->createFixtureAcces($b, $falaise); // même falaise, type et variante

    $res = $this->merge($a, $b);
    $this->assertSame(409, $res['status'], $res['raw']);
    $this->assertStringContainsString('accès identique', $res['body']['error']);
    $this->assertNull($this->arret($a)['parent_id']);
    $this->assertNull($this->arret($b)['parent_id']);
    $this->assertSame((string) $a, self::dbQueryOne("SELECT arret_id FROM acces_falaise WHERE acces_id = $accesA")['arret_id']);
  }

  // --- orphelin + parent existant ---------------------------------------------------------------

  public function testOrphelinRejointLeParentExistantDansLesDeuxSens(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion P-a', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Fusion P-b', 43.8000, 5.4002, ['bus']);
    $c = $this->createFixtureArret('PHPUnit Fusion P-c', 43.8000, 5.4004, ['bus']);
    $d = $this->createFixtureArret('PHPUnit Fusion P-d', 43.8000, 5.4006, ['bus']);
    $p = $this->mergeOk($a, $b);

    // orphelin source, parent cible
    $res = $this->merge($c, $p);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame($p, (int) $res['body']['parent_id']);
    $this->assertSame((string) $p, $this->arret($c)['parent_id']);
    // parent source, orphelin cible : même résultat
    $res = $this->merge($p, $d);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame($p, (int) $res['body']['parent_id']);
    $this->assertSame((string) $p, $this->arret($d)['parent_id']);

    $this->assertEqualsWithDelta(5.4003, (float) $this->arret($p)['lng'], 1e-6); // moyenne des 4 enfants
  }

  public function testPositionManuelleDuParentNEstJamaisRecalculee(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion M-a', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Fusion M-b', 43.8000, 5.4002, ['bus']);
    $c = $this->createFixtureArret('PHPUnit Fusion M-c', 43.8000, 5.4010, ['bus']);
    $p = $this->mergeOk($a, $b);
    self::dbExec("UPDATE arrets SET position_manuelle = 1, loc = ST_GeomFromText('POINT(5.5 43.9)', 4326) WHERE id = $p");

    $this->assertSame(200, $this->merge($c, $p)['status']);
    $parent = $this->arret($p);
    $this->assertEqualsWithDelta(5.5, (float) $parent['lng'], 1e-6);
    $this->assertEqualsWithDelta(43.9, (float) $parent['lat'], 1e-6);
  }

  // --- parent + parent --------------------------------------------------------------------------

  public function testDeuxParentsSAplatissentEnUn(): void
  {
    $falaise = $this->createFixtureFalaise();
    $a = $this->createFixtureArret('PHPUnit Fusion PP-a', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Fusion PP-b', 43.8000, 5.4002, ['bus']);
    $c = $this->createFixtureArret('PHPUnit Fusion PP-c', 43.8000, 5.4004, ['bus']);
    $d = $this->createFixtureArret('PHPUnit Fusion PP-d', 43.8000, 5.4006, ['bus']);
    $p1 = $this->mergeOk($a, $b);
    $p2 = $this->mergeOk($c, $d);
    $acces = $this->createFixtureAcces($p1, $falaise);

    $res = $this->merge($p1, $p2); // p1 absorbé par p2
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame($p2, (int) $res['body']['parent_id']);

    $this->assertSame('1', $this->arret($p1)['deleted']);
    foreach ([$a, $b, $c, $d] as $enfant) {
      $this->assertSame((string) $p2, $this->arret($enfant)['parent_id'], "enfant $enfant");
    }
    $this->assertSame((string) $p2, self::dbQueryOne("SELECT arret_id FROM acces_falaise WHERE acces_id = $acces")['arret_id']);
    $this->assertEqualsWithDelta(5.4003, (float) $this->arret($p2)['lng'], 1e-6);
  }

  public function testUnEnfantNePeutPasEtreFusionne(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion E-a', 43.8, 5.4, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Fusion E-b', 43.8, 5.4002, ['bus']);
    $c = $this->createFixtureArret('PHPUnit Fusion E-c', 43.8, 5.4004, ['bus']);
    $this->mergeOk($a, $b);
    $this->assertSame(409, $this->merge($a, $c)['status']); // a est un enfant
    $this->assertSame(409, $this->merge($c, $b)['status']);
  }

  public function testArretSupprimeNePeutPasEtreFusionne(): void
  {
    $a = $this->createFixtureArret('PHPUnit Fusion S-a');
    $b = $this->createFixtureArret('PHPUnit Fusion S-b');
    self::dbExec("UPDATE arrets SET deleted = 1 WHERE id = $a");
    $this->assertSame(409, $this->merge($a, $b)['status']);
    $this->assertSame(409, $this->merge($b, $a)['status']);
  }

  // --- detach_arret -----------------------------------------------------------------------------

  private function detach(int $id): array
  {
    return $this->httpPostJson('/api/detach_arret.php', ['arret_id' => $id], $this->bearer());
  }

  public function testDetachRequiresBearer(): void
  {
    $this->assertSame(401, $this->httpPostJson('/api/detach_arret.php', ['arret_id' => 1])['status']);
  }

  public function testDetacherUnEnfant(): void
  {
    $a = $this->createFixtureArret('PHPUnit Detach a', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Detach b', 43.8000, 5.4002, ['bus']);
    $c = $this->createFixtureArret('PHPUnit Detach c', 43.8000, 5.4010, ['bus']);
    $p = $this->mergeOk($a, $b);
    $this->assertSame(200, $this->merge($c, $p)['status']);

    $res = $this->detach($c);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertNull($this->arret($c)['parent_id']);
    $this->assertSame('0', $this->arret($c)['deleted']);
    $this->assertEqualsWithDelta(5.4001, (float) $this->arret($p)['lng'], 1e-6);
  }

  public function testDetacherLeDernierEnfantEstRefuse(): void
  {
    $a = $this->createFixtureArret('PHPUnit Detach d1', 43.8, 5.4, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Detach d2', 43.8, 5.4002, ['bus']);
    $p = $this->mergeOk($a, $b);
    $this->assertSame(200, $this->detach($a)['status']);
    $res = $this->detach($b);
    $this->assertSame(409, $res['status'], $res['raw']); // défusionner à la place
    $this->assertSame((string) $p, $this->arret($b)['parent_id']);
  }

  public function testDetacherUnNonEnfantEstRefuse(): void
  {
    $a = $this->createFixtureArret('PHPUnit Detach orphelin');
    $this->assertSame(409, $this->detach($a)['status']);
    $this->assertSame(404, $this->detach(999999999)['status']);
  }

  // --- unmerge_arret ----------------------------------------------------------------------------

  private function unmerge(array $payload): array
  {
    return $this->httpPostJson('/api/unmerge_arret.php', $payload, $this->bearer());
  }

  public function testUnmergeRequiresBearer(): void
  {
    $this->assertSame(401, $this->httpPostJson('/api/unmerge_arret.php', ['parent_id' => 1])['status']);
  }

  public function testDefusionnerRendLesEnfantsEtSupprimeLeParent(): void
  {
    $a = $this->createFixtureArret('PHPUnit Unmerge a', 43.8, 5.4, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Unmerge b', 43.8, 5.4002, ['bus']);
    $p = $this->mergeOk($a, $b);

    $res = $this->unmerge(['parent_id' => $p]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertNull($this->arret($a)['parent_id']);
    $this->assertNull($this->arret($b)['parent_id']);
    $this->assertSame('1', $this->arret($p)['deleted']);
  }

  public function testDefusionAvecAccesExigeUnHeritierEtLuiReporteLesRelations(): void
  {
    $falaise = $this->createFixtureFalaise();
    $a = $this->createFixtureArret('PHPUnit Unmerge h-a', 43.8, 5.4, ['ter']);
    $b = $this->createFixtureArret('PHPUnit Unmerge h-b', 43.8, 5.4002, ['ter']);
    $stranger = $this->createFixtureArret('PHPUnit Unmerge h-x', 43.8, 5.4004, ['ter']);
    $acces = $this->createFixtureAcces($a, $falaise);
    $train = $this->createTrain($a);
    $p = $this->mergeOk($a, $b);

    $this->assertSame(400, $this->unmerge(['parent_id' => $p])['status']);
    $this->assertSame(400, $this->unmerge(['parent_id' => $p, 'heritier_id' => $stranger])['status']);
    $this->assertSame((string) $p, $this->arret($a)['parent_id'], 'rien modifié après les refus');

    $res = $this->unmerge(['parent_id' => $p, 'heritier_id' => $b]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame((string) $b, self::dbQueryOne("SELECT arret_id FROM acces_falaise WHERE acces_id = $acces")['arret_id']);
    $this->assertSame((string) $b, self::dbQueryOne("SELECT arret_id FROM train WHERE train_id = $train")['arret_id']);
  }

  public function testDefusionRefuseUnArretQuiNEstPasParent(): void
  {
    $a = $this->createFixtureArret('PHPUnit Unmerge orphelin');
    $this->assertSame(409, $this->unmerge(['parent_id' => $a])['status']);
    $this->assertSame(404, $this->unmerge(['parent_id' => 999999999])['status']);
  }

  // --- delete_arret / move_arret ------------------------------------------------------------------

  public function testSupprimerUnParentAvecEnfantsEstRefuse(): void
  {
    $a = $this->createFixtureArret('PHPUnit Delete a', 43.8, 5.4, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Delete b', 43.8, 5.4002, ['bus']);
    $p = $this->mergeOk($a, $b);
    $res = $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $p], $this->bearer());
    $this->assertSame(409, $res['status'], $res['raw']);
    $this->assertSame('0', $this->arret($p)['deleted']);
  }

  public function testSupprimerUnEnfantRecalculeLeParent(): void
  {
    $a = $this->createFixtureArret('PHPUnit Delete e-a', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Delete e-b', 43.8000, 5.4010, ['bus']);
    $p = $this->mergeOk($a, $b);
    $res = $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $b], $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertEqualsWithDelta(5.4000, (float) $this->arret($p)['lng'], 1e-6);
  }

  public function testDeplacerUnArretMetPositionManuelle(): void
  {
    $a = $this->createFixtureArret('PHPUnit Move a', 43.8, 5.4, ['bus']);
    $res = $this->httpPostJson('/api/move_arret.php', ['arret_id' => $a, 'lat' => 43.81, 'lng' => 5.41], $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);
    $row = $this->arret($a);
    $this->assertSame('1', $row['position_manuelle']);
    $this->assertEqualsWithDelta(5.41, (float) $row['lng'], 1e-6);
  }

  public function testDeplacerUnEnfantRecalculeLeParent(): void
  {
    $a = $this->createFixtureArret('PHPUnit Move e-a', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Move e-b', 43.8000, 5.4010, ['bus']);
    $p = $this->mergeOk($a, $b);
    $this->httpPostJson('/api/move_arret.php', ['arret_id' => $b, 'lat' => 43.8, 'lng' => 5.4020], $this->bearer());
    $this->assertEqualsWithDelta(5.4010, (float) $this->arret($p)['lng'], 1e-6);
  }

  public function testRepasserUnParentEnPositionAutomatique(): void
  {
    $a = $this->createFixtureArret('PHPUnit Move auto a', 43.8000, 5.4000, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Move auto b', 43.8000, 5.4010, ['bus']);
    $p = $this->mergeOk($a, $b);
    $this->httpPostJson('/api/move_arret.php', ['arret_id' => $p, 'lat' => 43.9, 'lng' => 5.5], $this->bearer());
    $this->assertSame('1', $this->arret($p)['position_manuelle']);

    $res = $this->httpPostJson('/api/move_arret.php', ['arret_id' => $p, 'auto' => true], $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);
    $parent = $this->arret($p);
    $this->assertSame('0', $parent['position_manuelle']);
    $this->assertEqualsWithDelta(5.4005, (float) $parent['lng'], 1e-6);
  }
}
