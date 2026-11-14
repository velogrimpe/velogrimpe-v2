<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot P4 (docs/plan-arrets-parents.md) : import GTFS d'une ligne avec regroupement d'arrêts (api/add_ligne.php).
 *  - nouveaux_arrets[].regrouper_avec : arrêt existant dont le nouvel arrêt devient un « frère » (parent créé si besoin)
 *  - nouveaux_arrets[].groupe / groupe_stop_id : arrêts créés ensemble regroupés (station GTFS → parent + sa ref)
 *  - gtfs_refs[].lat / lng : mise à jour de position à la réimport (sauf position manuelle)
 *  - un parent ne se lie pas directement à une ligne : la ligne est liée aux enfants
 */
final class AddLigneRegroupementTest extends ApiTestCase
{
  private function payload(array $override = []): array
  {
    return array_merge([
      'ligne_id' => null, 'nom' => 'PHPUnit - Ligne regroupement', 'numero' => 'PHT', 'arret_ids' => [],
    ], $override);
  }

  /** @param int[] $ids arrêts (créés par l'API) à nettoyer : enfants détachés d'abord */
  private function registerCreated(array $ids): void
  {
    if (!$ids) return;
    $in = implode(',', $ids);
    $this->cleanupOnTearDown("DELETE FROM arrets WHERE id IN ($in)");
    $this->cleanupOnTearDown("UPDATE arrets SET parent_id = NULL WHERE id IN ($in) OR parent_id IN ($in)");
  }

  /** Envoie la ligne ; enregistre les nettoyages (ligne, arrêts créés, parents créés). */
  private function post(array $override): array
  {
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload($override));
    if ($res['status'] === 200) {
      $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = " . (int) $res['body']['ligne_id']);
      $ids = array_merge($res['body']['arrets_crees'] ?? [], $res['body']['parents'] ?? []);
      foreach ($ids as $id) $this->cleanupOnTearDown("DELETE FROM references_externes WHERE arret_id = " . (int) $id);
      $this->registerCreated(array_map('intval', $ids));
    }
    return $res;
  }

  private function arret(int $id): array
  {
    return self::dbQueryOne("SELECT id, nom, parent_id, position_manuelle, ter, bus, ST_Y(loc) AS lat, ST_X(loc) AS lng FROM arrets WHERE id = $id");
  }

  private function nouvel(string $nom, float $lng, array $extra = []): array
  {
    return array_merge(['nom' => $nom, 'lat' => 45.7600, 'lng' => $lng, 'types' => ['bus'], 'stop_id' => 'S_' . $nom], $extra);
  }

  // --- regrouper_avec -----------------------------------------------------------------------------

  public function testNouvelArretRegroupeAvecUnOrphelinCreeUnParent(): void
  {
    $x = $this->createFixtureArret('PHPUnit Import X', 45.7600, 4.8600, ['bus']);
    $res = $this->post(['nouveaux_arrets' => [$this->nouvel('PHPUnit Import S', 4.8610, ['regrouper_avec' => $x])]]);
    $this->assertSame(200, $res['status'], $res['raw']);

    [$s] = $res['body']['arrets_crees'];
    $this->assertCount(1, $res['body']['parents']);
    $p = $res['body']['parents'][0];
    $this->assertSame((string) $p, $this->arret($x)['parent_id']);
    $this->assertSame((string) $p, $this->arret($s)['parent_id']);
    $this->assertSame('PHPUnit Import X', $this->arret($p)['nom'], 'le parent reprend les attributs de l\'arrêt existant');
    $this->assertNull($this->arret($p)['parent_id']);

    // la ligne dessert l'enfant créé, pas le parent ; sa ref GTFS est sur l'enfant
    $liens = array_column(self::dbQuery("SELECT arret_id FROM arrets_lignes_transport WHERE ligne_id = {$res['body']['ligne_id']}"), 'arret_id');
    $this->assertSame([(string) $s], $liens);
    $this->assertSame('S_PHPUnit Import S', self::dbQueryOne("SELECT ref FROM references_externes WHERE arret_id = $s AND source = 'gtfs'")['ref']);
  }

  public function testRegroupementAvecUnExistantPorteLaRefDeLaStationSurLeParent(): void
  {
    $x = $this->createFixtureArret('PHPUnit Import st-X', 45.7600, 4.8600, ['bus']);
    $res = $this->post(['nouveaux_arrets' => [$this->nouvel('PHPUnit Import st-S', 4.8610, ['regrouper_avec' => $x, 'groupe_stop_id' => 'STATION_X'])]]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $p = $res['body']['parents'][0];
    $this->assertSame('STATION_X', self::dbQueryOne("SELECT ref FROM references_externes WHERE arret_id = $p AND source = 'gtfs'")['ref']);
  }

  public function testNouvelArretRegroupeAvecUnEnfantRejointLeParentExistant(): void
  {
    $a = $this->createFixtureArret('PHPUnit Import fr-a', 45.76, 4.8600, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Import fr-b', 45.76, 4.8602, ['bus']);
    $fusion = $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $a, 'cible_id' => $b], ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']]);
    $p = (int) $fusion['body']['parent_id'];
    $this->registerCreated([$p]);

    $res = $this->post(['nouveaux_arrets' => [$this->nouvel('PHPUnit Import fr-s', 4.8604, ['regrouper_avec' => $a])]]);
    $this->assertSame(200, $res['status'], $res['raw']);
    [$s] = $res['body']['arrets_crees'];
    $this->assertSame([], $res['body']['parents'], "aucun nouveau parent : le parent existant est réutilisé");
    $this->assertSame((string) $p, $this->arret($s)['parent_id']);
    $this->assertEqualsWithDelta(4.8602, (float) $this->arret($p)['lng'], 1e-6, 'barycentre recalculé sur 3 enfants');
  }

  public function testRegrouperAvecUnArretInconnuOuDeModeDifferentEstRefuseSansRienEcrire(): void
  {
    $gare = $this->createFixtureArret('PHPUnit Import gare', 45.76, 4.86, ['ter']);
    foreach ([999999999, $gare] as $cible) {
      $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
        'nom' => 'PHPUnit - doit échouer',
        'nouveaux_arrets' => [$this->nouvel('PHPUnit Import refus', 4.8605, ['regrouper_avec' => $cible])],
      ]));
      $this->assertContains($res['status'], [400, 409], $res['raw']);
    }
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM lignes_transport WHERE nom = 'PHPUnit - doit échouer'"));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM arrets WHERE nom = 'PHPUnit Import refus'"));
    $this->assertNull($this->arret($gare)['parent_id']);
  }

  // --- groupe (station GTFS ou proximité interne au GTFS) -----------------------------------------------

  public function testArretsDUnMemeGroupeSontRegroupesSousUnParentPorteurDeLaRefStation(): void
  {
    $res = $this->post(['nouveaux_arrets' => [
      $this->nouvel('PHPUnit Longchamp', 5.1932, ['stop_id' => 'Q1', 'groupe' => 'ST1', 'groupe_stop_id' => 'ST1']),
      $this->nouvel('PHPUnit Longchamp', 5.1911, ['stop_id' => 'Q2', 'groupe' => 'ST1', 'groupe_stop_id' => 'ST1']),
    ]]);
    $this->assertSame(200, $res['status'], $res['raw']);
    [$q1, $q2] = $res['body']['arrets_crees'];
    $this->assertCount(1, $res['body']['parents']);
    $p = $res['body']['parents'][0];

    $this->assertSame((string) $p, $this->arret($q1)['parent_id']);
    $this->assertSame((string) $p, $this->arret($q2)['parent_id']);
    $this->assertEqualsWithDelta((5.1932 + 5.1911) / 2, (float) $this->arret($p)['lng'], 1e-6);

    // La ref de la station est sur le parent, celles des quais sur les enfants
    $this->assertSame('ST1', self::dbQueryOne("SELECT ref FROM references_externes WHERE arret_id = $p AND source = 'gtfs'")['ref']);
    $this->assertSame('Q1', self::dbQueryOne("SELECT ref FROM references_externes WHERE arret_id = $q1 AND source = 'gtfs'")['ref']);
    $this->assertSame('Q2', self::dbQueryOne("SELECT ref FROM references_externes WHERE arret_id = $q2 AND source = 'gtfs'")['ref']);

    // La ligne dessert les deux quais
    $liens = array_map('intval', array_column(self::dbQuery("SELECT arret_id FROM arrets_lignes_transport WHERE ligne_id = {$res['body']['ligne_id']}"), 'arret_id'));
    $this->assertEqualsCanonicalizing([$q1, $q2], $liens);
  }

  public function testUnGroupeAUnSeulMembreNeCreeAucunParent(): void
  {
    $res = $this->post(['nouveaux_arrets' => [$this->nouvel('PHPUnit Seul', 5.19, ['groupe' => 'ST2', 'groupe_stop_id' => 'ST2'])]]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame([], $res['body']['parents']);
    $this->assertNull($this->arret($res['body']['arrets_crees'][0])['parent_id']);
  }

  // --- parents non liables ----------------------------------------------------------------------------

  public function testUnParentNePeutPasEtreLieDirectementAUneLigne(): void
  {
    $a = $this->createFixtureArret('PHPUnit Import lp-a', 45.76, 4.8600, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Import lp-b', 45.76, 4.8602, ['bus']);
    $fusion = $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $a, 'cible_id' => $b], ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']]);
    $p = (int) $fusion['body']['parent_id'];
    $this->registerCreated([$p]);

    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload(['nom' => 'PHPUnit - parent lié', 'arret_ids' => [$p]]));
    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM lignes_transport WHERE nom = 'PHPUnit - parent lié'"));

    $ok = $this->post(['arret_ids' => [$a, $b]]); // les enfants, eux, se lient
    $this->assertSame(200, $ok['status'], $ok['raw']);
  }

  // --- mise à jour de position à la réimport ------------------------------------------------------------

  /** Ligne déjà importée : arrêts liés à la ligne, chacun avec sa ref GTFS (`[arret_id => stop_id]`). */
  private function ligneDejaImportee(array $refs): int
  {
    $l = self::dbInsert("INSERT INTO lignes_transport (nom, numero) VALUES ('PHPUnit - Ligne réimport', 'PHR')");
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $l");
    foreach ($refs as $arret => $stop) {
      self::dbExec("INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES ($l, $arret)");
      self::dbExec("INSERT INTO references_externes (arret_id, source, ref) VALUES ($arret, 'gtfs', '$stop')");
    }
    return $l;
  }

  public function testReimportDeplaceUnArretSuiviSaufPositionManuelle(): void
  {
    $libre = $this->createFixtureArret('PHPUnit Import pos libre', 45.7600, 4.8600, ['bus']);
    $manuel = $this->createFixtureArret('PHPUnit Import pos manuel', 45.7600, 4.8700, ['bus']);
    self::dbExec("UPDATE arrets SET position_manuelle = 1 WHERE id = $manuel");
    $ligne = $this->ligneDejaImportee([$libre => 'P1', $manuel => 'P2']);

    $res = $this->post([
      'ligne_id' => $ligne, 'arret_ids' => [$libre, $manuel],
      'gtfs_refs' => [
        ['arret_id' => $libre, 'stop_id' => 'P1', 'lat' => 45.7610, 'lng' => 4.8610],
        ['arret_id' => $manuel, 'stop_id' => 'P2', 'lat' => 45.7620, 'lng' => 4.8720],
      ],
    ]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertEqualsWithDelta(4.8610, (float) $this->arret($libre)['lng'], 1e-6);
    $this->assertEqualsWithDelta(45.7610, (float) $this->arret($libre)['lat'], 1e-6);
    $this->assertEqualsWithDelta(4.8700, (float) $this->arret($manuel)['lng'], 1e-6, 'position manuelle conservée');
  }

  public function testUnArretNonSuiviParLaLigneNEstJamaisDeplace(): void
  {
    $inconnu = $this->createFixtureArret('PHPUnit Import pos inconnu', 45.7600, 4.8600, ['bus']);
    $autreRef = $this->createFixtureArret('PHPUnit Import pos autre ref', 45.7600, 4.8700, ['bus']);
    $ligne = $this->ligneDejaImportee([$autreRef => 'AUTRE']);

    $res = $this->post([
      'ligne_id' => $ligne, 'arret_ids' => [$inconnu, $autreRef],
      'gtfs_refs' => [
        ['arret_id' => $inconnu, 'stop_id' => 'X1', 'lat' => 45.8, 'lng' => 4.9],      // jamais suivi : première ref, pas de déplacement
        ['arret_id' => $autreRef, 'stop_id' => 'X2', 'lat' => 45.8, 'lng' => 4.9],      // suivi sous une autre ref
      ],
    ]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertEqualsWithDelta(4.8600, (float) $this->arret($inconnu)['lng'], 1e-6);
    $this->assertEqualsWithDelta(4.8700, (float) $this->arret($autreRef)['lng'], 1e-6);
  }

  public function testReimportRecalculeLeParentDeLArretDeplace(): void
  {
    $a = $this->createFixtureArret('PHPUnit Import rp-a', 45.76, 4.8600, ['bus']);
    $b = $this->createFixtureArret('PHPUnit Import rp-b', 45.76, 4.8610, ['bus']);
    $fusion = $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $a, 'cible_id' => $b], ['Authorization: Bearer ' . VG_TEST_CONFIG['admin_token']]);
    $p = (int) $fusion['body']['parent_id'];
    $this->registerCreated([$p]);
    $ligne = $this->ligneDejaImportee([$a => 'RPA', $b => 'RP']);

    $res = $this->post(['ligne_id' => $ligne, 'arret_ids' => [$a, $b], 'gtfs_refs' => [['arret_id' => $b, 'stop_id' => 'RP', 'lat' => 45.76, 'lng' => 4.8620]]]);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertEqualsWithDelta(4.8610, (float) $this->arret($p)['lng'], 1e-6); // (4.8600 + 4.8620) / 2
  }

  public function testReimportNeChangeJamaisLeNom(): void
  {
    $a = $this->createFixtureArret('PHPUnit Nom conservé', 45.76, 4.86, ['bus']);
    $ligne = $this->ligneDejaImportee([$a => 'N1']);
    $this->post(['ligne_id' => $ligne, 'arret_ids' => [$a], 'gtfs_refs' => [['arret_id' => $a, 'stop_id' => 'N1', 'nom' => 'Autre nom GTFS', 'lat' => 45.7601, 'lng' => 4.8601]]]);
    $this->assertSame('PHPUnit Nom conservé', $this->arret($a)['nom']);
    $this->assertEqualsWithDelta(4.8601, (float) $this->arret($a)['lng'], 1e-6);
  }
}
