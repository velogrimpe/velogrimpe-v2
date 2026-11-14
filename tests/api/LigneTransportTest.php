<?php

require_once __DIR__ . '/ApiTestCase.php';

use PHPUnit\Framework\Attributes\DataProvider;

/**
 * CRUD des lignes BTT (Lot 7, cf. docs/plan-implementation-arrets.md) :
 *  - api/add_ligne.php   : création + édition, arrêts liés (non protégé)
 *  - api/fetch_ligne.php : lecture d'une ligne (géométrie GeoJSON + arrêts liés)
 *  - api/fetch_lignes.php: liste, filtrable par arrêt (bouton « voir la ligne »)
 *  - api/delete_ligne.php: suppression (Bearer admin_token)
 */
final class LigneTransportTest extends ApiTestCase
{
  private const GEOMETRY = [
    'type' => 'MultiLineString',
    'coordinates' => [
      [[5.3830, 43.8270], [5.3900, 43.8300], [5.4000, 43.8350]],
      [[5.4000, 43.8350], [5.4100, 43.8400]],
    ],
  ];

  /** @return string[] */
  private function bearer(?string $token = null): array
  {
    return ['Authorization: Bearer ' . ($token ?? (string) VG_TEST_CONFIG['admin_token'])];
  }

  /** @param array<string, mixed> $override */
  private function payload(array $override = []): array
  {
    return array_merge([
      'ligne_id' => null,
      'nom' => 'PHPUnit - Ligne de test',
      'numero' => 'L21',
      'operateur' => 'Opérateur Test',
      'operateur_url' => 'https://operateur.example.org',
      'horaire_url' => 'https://operateur.example.org/horaires.pdf',
      'ref' => 'REF-123',
      'couleur' => '#123456',
      'geometry' => self::GEOMETRY,
      'arret_ids' => [],
    ], $override);
  }

  /** Crée une ligne via l'API et enregistre son nettoyage. */
  private function createLigne(array $override = []): int
  {
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload($override));
    $this->assertSame(200, $res['status'], $res['raw']);
    $id = $res['body']['ligne_id'];
    $this->assertIsInt($id);
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $id");
    return $id;
  }

  public function testMethodNotAllowedOnGet(): void
  {
    $res = $this->httpGet('/api/add_ligne.php');
    $this->assertSame(405, $res['status']);
  }

  public function testMissingNomIsRejected(): void
  {
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload(['nom' => '']));
    $this->assertSame(400, $res['status']);
    $this->assertArrayHasKey('error', $res['body']);
  }

  public function testInvalidGeometryTypeIsRejected(): void
  {
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'geometry' => ['type' => 'Point', 'coordinates' => [5.38, 43.82]],
    ]));
    $this->assertSame(400, $res['status']);
    $this->assertArrayHasKey('error', $res['body']);
  }

  public function testCreatesLigneAndFetchesItBack(): void
  {
    $ligneId = $this->createLigne();

    $res = $this->httpGet("/api/fetch_ligne.php?ligne_id=$ligneId");
    $this->assertSame(200, $res['status'], $res['raw']);
    $ligne = $res['body']['ligne'];

    $this->assertSame($ligneId, $ligne['id']);
    $this->assertSame('PHPUnit - Ligne de test', $ligne['nom']);
    $this->assertSame('L21', $ligne['numero']);
    $this->assertSame('Opérateur Test', $ligne['operateur']);
    $this->assertSame('https://operateur.example.org', $ligne['operateur_url']);
    $this->assertSame('https://operateur.example.org/horaires.pdf', $ligne['horaire_url']);
    $this->assertSame('REF-123', $ligne['ref']);
    $this->assertSame('#123456', $ligne['couleur']);
    // Aller-retour GeoJSON : ordre lng,lat et deux segments conservés
    $this->assertSame('MultiLineString', $ligne['geometry']['type']);
    $this->assertEqualsWithDelta(5.3830, $ligne['geometry']['coordinates'][0][0][0], 1e-6);
    $this->assertEqualsWithDelta(43.8270, $ligne['geometry']['coordinates'][0][0][1], 1e-6);
    $this->assertCount(2, $ligne['geometry']['coordinates']);
    $this->assertSame([], $res['body']['arret_ids']);
  }

  public function testGeometryAndOptionalFieldsMayBeOmitted(): void
  {
    $ligneId = $this->createLigne([
      'geometry' => null,
      'numero' => '',
      'operateur' => '',
      'couleur' => '',
    ]);
    $ligne = $this->httpGet("/api/fetch_ligne.php?ligne_id=$ligneId")['body']['ligne'];
    $this->assertNull($ligne['geometry']);
    $this->assertNull($ligne['numero']);
    $this->assertNull($ligne['operateur']);
    $this->assertNull($ligne['couleur']);
  }

  public function testCreatesLigneWithLinkedArrets(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt A');
    $b = $this->createFixtureArret('PHPUnit Arrêt B');
    $ligneId = $this->createLigne(['arret_ids' => [$a, $b]]);

    $body = $this->httpGet("/api/fetch_ligne.php?ligne_id=$ligneId")['body'];
    $ids = $body['arret_ids'];
    sort($ids);
    $this->assertSame([$a, $b], $ids);
  }

  public function testEditReplacesFieldsGeometryAndArretSet(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt A');
    $b = $this->createFixtureArret('PHPUnit Arrêt B');
    $ligneId = $this->createLigne(['arret_ids' => [$a]]);

    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'ligne_id' => $ligneId,
      'nom' => 'PHPUnit - Ligne modifiée',
      'couleur' => 'gold',
      'geometry' => [
        'type' => 'MultiLineString',
        'coordinates' => [[[6.0, 44.0], [6.1, 44.1]]],
      ],
      'arret_ids' => [$b],
    ]));
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame($ligneId, $res['body']['ligne_id']);

    $body = $this->httpGet("/api/fetch_ligne.php?ligne_id=$ligneId")['body'];
    $this->assertSame('PHPUnit - Ligne modifiée', $body['ligne']['nom']);
    $this->assertSame('gold', $body['ligne']['couleur']);
    $this->assertCount(1, $body['ligne']['geometry']['coordinates']);
    $this->assertSame([$b], $body['arret_ids'], 'le set d\'arrêts liés doit être remplacé, pas cumulé');
  }

  public function testEditUnknownLigneReturns404(): void
  {
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload(['ligne_id' => 999999999]));
    $this->assertSame(404, $res['status']);
  }

  public function testUnknownArretIdIsRejectedAtomically(): void
  {
    $before = self::dbQueryOne("SELECT COUNT(*) AS n FROM lignes_transport")['n'];
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload(['arret_ids' => [999999999]]));
    $this->assertSame(400, $res['status']);
    $after = self::dbQueryOne("SELECT COUNT(*) AS n FROM lignes_transport")['n'];
    $this->assertSame($before, $after, 'aucune ligne orpheline si un arrêt lié est invalide');
  }

  public function testFetchUnknownLigneReturns404(): void
  {
    $res = $this->httpGet('/api/fetch_ligne.php?ligne_id=999999999');
    $this->assertSame(404, $res['status']);
  }

  public function testListContainsLigneWithoutGeometryPayloadByDefault(): void
  {
    $ligneId = $this->createLigne();
    $res = $this->httpGet('/api/fetch_lignes.php');
    $this->assertSame(200, $res['status'], $res['raw']);
    $found = array_values(array_filter($res['body']['lignes'], fn($l) => $l['id'] === $ligneId));
    $this->assertCount(1, $found);
    $this->assertSame('PHPUnit - Ligne de test', $found[0]['nom']);
    $this->assertSame('L21', $found[0]['numero']);
    $this->assertArrayNotHasKey('geometry', $found[0], 'la liste reste légère : la géométrie se charge via fetch_ligne');
  }

  public function testListFilteredByArretReturnsGeometry(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt A');
    $other = $this->createFixtureArret('PHPUnit Arrêt Autre');
    $linked = $this->createLigne(['nom' => 'PHPUnit - Ligne liée', 'arret_ids' => [$a]]);
    $this->createLigne(['nom' => 'PHPUnit - Ligne non liée', 'arret_ids' => [$other]]);

    $res = $this->httpGet("/api/fetch_lignes.php?arret_id=$a");
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertCount(1, $res['body']['lignes']);
    $ligne = $res['body']['lignes'][0];
    $this->assertSame($linked, $ligne['id']);
    // « voir la ligne » : géométrie, couleur et arrêts à mettre en évidence
    $this->assertSame('MultiLineString', $ligne['geometry']['type']);
    $this->assertSame('#123456', $ligne['couleur']);
    $this->assertSame([$a], $ligne['arret_ids']);
    // Coordonnées des arrêts liés : la page falaise n'a pas le catalogue des arrêts
    $this->assertCount(1, $ligne['arrets']);
    $this->assertSame($a, $ligne['arrets'][0]['id']);
    $this->assertSame('PHPUnit Arrêt A', $ligne['arrets'][0]['nom']);
    $this->assertEqualsWithDelta(43.8270, $ligne['arrets'][0]['lat'], 1e-6);
    $this->assertEqualsWithDelta(5.3830, $ligne['arrets'][0]['lng'], 1e-6);
  }

  public function testDeleteWithoutBearerIsRejected(): void
  {
    $ligneId = $this->createLigne();
    $res = $this->httpPostJson('/api/delete_ligne.php', ['ligne_id' => $ligneId]);
    $this->assertSame(401, $res['status']);
    $this->assertNotNull(self::dbQueryOne("SELECT id FROM lignes_transport WHERE id = $ligneId"));
  }

  public function testDeleteWithWrongBearerIsRejected(): void
  {
    $ligneId = $this->createLigne();
    $res = $this->httpPostJson('/api/delete_ligne.php', ['ligne_id' => $ligneId], $this->bearer('mauvais'));
    $this->assertSame(401, $res['status']);
    $this->assertNotNull(self::dbQueryOne("SELECT id FROM lignes_transport WHERE id = $ligneId"));
  }

  public function testDeleteRemovesLigneAndLinksButKeepsArrets(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt A');
    $ligneId = $this->createLigne(['arret_ids' => [$a]]);

    $res = $this->httpPostJson('/api/delete_ligne.php', ['ligne_id' => $ligneId], $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);

    $this->assertNull(self::dbQueryOne("SELECT id FROM lignes_transport WHERE id = $ligneId"));
    $this->assertNull(self::dbQueryOne("SELECT id FROM arrets_lignes_transport WHERE ligne_id = $ligneId"));
    $this->assertNotNull(self::dbQueryOne("SELECT id FROM arrets WHERE id = $a"), 'l\'arrêt ne doit pas être supprimé');
  }

  // --- Suppression d'une ligne avec ses arrêts (supprimer_arrets) : suppression PHYSIQUE ------------------

  private function deleteLigne(int $ligneId, bool $avecArrets): array
  {
    return $this->httpPostJson('/api/delete_ligne.php', ['ligne_id' => $ligneId, 'supprimer_arrets' => $avecArrets], $this->bearer());
  }

  private function arretExiste(int $arretId): bool
  {
    return self::dbQueryOne("SELECT id FROM arrets WHERE id = $arretId") !== null;
  }

  public function testDeleteAvecArretsSupprimeDefinitivementCeuxSansFalaiseNiAutreLigne(): void
  {
    $falaise = $this->createFixtureFalaise();
    $libre = $this->createFixtureArret('PHPUnit Suppr libre', 43.80, 5.40);
    $avecAcces = $this->createFixtureArret('PHPUnit Suppr accès', 43.81, 5.41);
    $autreLigne = $this->createFixtureArret('PHPUnit Suppr autre ligne', 43.82, 5.42);
    $this->createFixtureAccesPied($avecAcces, $falaise);
    $this->createLigne(['arret_ids' => [$autreLigne]]);
    $ligneId = $this->createLigne(['arret_ids' => [$libre, $avecAcces, $autreLigne]]);
    self::dbExec("INSERT INTO references_externes (arret_id, source, ref) VALUES ($libre, 'gtfs', 'SUPPR1')");

    $res = $this->deleteLigne($ligneId, true);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame(1, $res['body']['arrets_supprimes']);
    $this->assertSame(2, $res['body']['arrets_conserves']);

    $this->assertNull(self::dbQueryOne("SELECT id FROM lignes_transport WHERE id = $ligneId"));
    $this->assertNull(self::dbQueryOne("SELECT id FROM arrets_lignes_transport WHERE ligne_id = $ligneId"), 'liens arrêts-ligne supprimés');
    $this->assertFalse($this->arretExiste($libre), 'sans accès falaise ni autre ligne : supprimé définitivement');
    $this->assertNull(self::dbQueryOne("SELECT id FROM references_externes WHERE ref = 'SUPPR1'"), 'ses références suivent');
    $this->assertTrue($this->arretExiste($avecAcces), 'relié à une falaise : conservé');
    $this->assertTrue($this->arretExiste($autreLigne), 'desservi par une autre ligne : conservé');
  }

  public function testDeleteAvecArretsConserveUnArretPorteurDUnTrajetTrain(): void
  {
    $a = $this->createFixtureArret('PHPUnit Suppr train', 43.80, 5.40, ['ter']);
    $trainId = self::dbInsert("INSERT INTO train (ville_id, arret_id, train_depart, train_arrivee, train_descr, train_public, train_contrib)
      VALUES (" . self::WITNESS_VILLE_ID . ", $a, 'x', 'y', '', 1, 'phpunit')");
    $this->cleanupOnTearDown("DELETE FROM train WHERE train_id = $trainId");
    $ligneId = $this->createLigne(['arret_ids' => [$a]]);

    $res = $this->deleteLigne($ligneId, true);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame(0, $res['body']['arrets_supprimes']);
    $this->assertTrue($this->arretExiste($a), 'un trajet train le référence : conservé');
  }

  public function testDeleteAvecArretsNettoieLesExclusionsDeVilles(): void
  {
    $a = $this->createFixtureArret('PHPUnit Suppr exclusion', 43.80, 5.40, ['ter']);
    $falaise = $this->createFixtureFalaise();
    self::dbExec("INSERT INTO exclusions_villes_gares (ville_id, gare_id) VALUES (" . self::WITNESS_VILLE_ID . ", $a)");
    self::dbExec("INSERT INTO exclusions_villes_gares_falaises (ville_id, gare_id, falaise_id) VALUES (" . self::WITNESS_VILLE_ID . ", $a, $falaise)");
    $this->cleanupOnTearDown("DELETE FROM exclusions_villes_gares WHERE gare_id = $a");
    $this->cleanupOnTearDown("DELETE FROM exclusions_villes_gares_falaises WHERE gare_id = $a");
    $ligneId = $this->createLigne(['arret_ids' => [$a]]);

    $this->assertSame(200, $this->deleteLigne($ligneId, true)['status']);
    $this->assertFalse($this->arretExiste($a));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM exclusions_villes_gares WHERE gare_id = $a"));
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM exclusions_villes_gares_falaises WHERE gare_id = $a"));
  }

  public function testDeleteSansOptionNeSupprimeAucunArret(): void
  {
    $a = $this->createFixtureArret('PHPUnit Suppr sans option');
    $ligneId = $this->createLigne(['arret_ids' => [$a]]);
    $res = $this->deleteLigne($ligneId, false);
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame(0, $res['body']['arrets_supprimes']);
    $this->assertTrue($this->arretExiste($a));
  }

  public function testDeleteAvecArretsRespecteLesParents(): void
  {
    $falaise = $this->createFixtureFalaise();
    $admin = $this->bearer();
    // Parent P1 (accès falaise) : ses enfants sont « reliés à une falaise »
    $a1 = $this->createFixtureArret('PHPUnit Suppr P1-a', 43.80, 5.40);
    $b1 = $this->createFixtureArret('PHPUnit Suppr P1-b', 43.80, 5.4002);
    $p1 = (int) $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $a1, 'cible_id' => $b1], $admin)['body']['parent_id'];
    $this->createFixtureAccesPied($p1, $falaise);
    // Parent P2 (aucun accès) : tous ses enfants sont supprimés, donc lui aussi
    $a2 = $this->createFixtureArret('PHPUnit Suppr P2-a', 43.90, 5.50);
    $b2 = $this->createFixtureArret('PHPUnit Suppr P2-b', 43.90, 5.5002);
    $p2 = (int) $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $a2, 'cible_id' => $b2], $admin)['body']['parent_id'];
    // Parent P3 : un seul de ses deux enfants est sur la ligne, l'autre reste (le parent aussi, recalculé)
    $a3 = $this->createFixtureArret('PHPUnit Suppr P3-a', 43.95, 5.60);
    $b3 = $this->createFixtureArret('PHPUnit Suppr P3-b', 43.95, 5.6002);
    $p3 = (int) $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $a3, 'cible_id' => $b3], $admin)['body']['parent_id'];
    foreach ([$p1, $p2, $p3] as $p) {
      $this->cleanupOnTearDown("DELETE FROM arrets WHERE id = $p");
      $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE arret_id = $p");
      $this->cleanupOnTearDown("UPDATE arrets SET parent_id = NULL WHERE parent_id = $p");
    }
    $ligneId = $this->createLigne(['arret_ids' => [$a1, $b1, $a2, $b2, $a3]]);

    $res = $this->deleteLigne($ligneId, true);
    $this->assertSame(200, $res['status'], $res['raw']);

    $this->assertSame([true, true, true], [$this->arretExiste($a1), $this->arretExiste($b1), $this->arretExiste($p1)]);
    $this->assertSame([false, false, false], [$this->arretExiste($a2), $this->arretExiste($b2), $this->arretExiste($p2)], 'parent laissé sans enfant : supprimé avec eux');
    $this->assertFalse($this->arretExiste($a3));
    $this->assertTrue($this->arretExiste($b3) && $this->arretExiste($p3));
    $this->assertEqualsWithDelta(5.6002, (float) self::dbQueryOne("SELECT ST_X(loc) AS x FROM arrets WHERE id = $p3")['x'], 1e-6, 'parent recalculé sur l\'enfant restant');
    $this->assertSame(4, $res['body']['arrets_supprimes'], 'a2, b2, p2 et a3');
  }

  public function testDeleteAvecArretsInconnuRenvoie404SansRienSupprimer(): void
  {
    $this->assertSame(404, $this->deleteLigne(999999999, true)['status']);
  }

  /** Arrêts créés par add_ligne.php (import GTFS) : suppression en fin de test. */
  private function registerCreated(array $ids): void
  {
    foreach ($ids as $id) {
      $this->registerFixtureArret((int) $id);
    }
  }

  public function testCreatesNouveauxArretsAndLinksThemInTheSameCall(): void
  {
    $existing = $this->createFixtureArret('PHPUnit Arrêt existant');
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'arret_ids' => [$existing],
      'nouveaux_arrets' => [
        ['nom' => 'PHPUnit GTFS - Arrêt Un', 'lat' => 45.5, 'lng' => 6.1, 'types' => ['bus']],
        ['nom' => 'PHPUnit GTFS - Arrêt Deux', 'lat' => 45.6, 'lng' => 6.2, 'types' => ['tram']],
      ],
    ]));
    $this->assertSame(200, $res['status'], $res['raw']);
    $ligneId = $res['body']['ligne_id'];
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $ligneId");
    $crees = $res['body']['arrets_crees'];
    $this->assertCount(2, $crees);
    $this->registerCreated($crees);

    // Liés à la ligne, en plus de l'arrêt existant
    $ids = $this->httpGet("/api/fetch_ligne.php?ligne_id=$ligneId")['body']['arret_ids'];
    sort($ids);
    $attendus = array_merge([$existing], $crees);
    sort($attendus);
    $this->assertSame($attendus, $ids);

    // Arrêts exploitables par le reste du site (fetch_arret, modalités, slug, position)
    $a = $this->httpGet("/api/fetch_arret.php?arret_id={$crees[0]}")['body']['arret'];
    $this->assertSame('PHPUnit GTFS - Arrêt Un', $a['nom']);
    $this->assertSame(['bus'], $a['types']);
    [$lat, $lng] = array_map('floatval', explode(',', $a['loc']));
    $this->assertEqualsWithDelta(45.5, $lat, 1e-6);
    $this->assertEqualsWithDelta(6.1, $lng, 1e-6);
    $this->assertSame(['tram'], $this->httpGet("/api/fetch_arret.php?arret_id={$crees[1]}")['body']['arret']['types']);
    $row = self::dbQueryOne("SELECT slug, contrib, contrib_mail FROM arrets WHERE id = {$crees[0]}");
    $this->assertSame('phpunit-gtfs-arret-un', $row['slug']);
    $this->assertNotEmpty($row['contrib']);
    $this->assertNotEmpty($row['contrib_mail']);
  }

  public function testNouvelArretWithoutTypesDefaultsToBus(): void
  {
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'nouveaux_arrets' => [['nom' => 'PHPUnit GTFS - Sans type', 'lat' => 45.5, 'lng' => 6.1]],
    ]));
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = {$res['body']['ligne_id']}");
    $this->registerCreated($res['body']['arrets_crees']);
    $this->assertSame(['bus'], $this->httpGet("/api/fetch_arret.php?arret_id={$res['body']['arrets_crees'][0]}")['body']['arret']['types']);
  }

  #[DataProvider('invalidNouveauxArrets')]
  public function testInvalidNouvelArretIsRejectedAtomically(array $nouvel): void
  {
    $avantLignes = self::dbQueryOne("SELECT COUNT(*) AS n FROM lignes_transport")['n'];
    $avantArrets = self::dbQueryOne("SELECT COUNT(*) AS n FROM arrets")['n'];
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'nouveaux_arrets' => [
        ['nom' => 'PHPUnit GTFS - Valide', 'lat' => 45.5, 'lng' => 6.1],
        $nouvel,
      ],
    ]));
    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertSame($avantLignes, self::dbQueryOne("SELECT COUNT(*) AS n FROM lignes_transport")['n']);
    $this->assertSame($avantArrets, self::dbQueryOne("SELECT COUNT(*) AS n FROM arrets")['n'], 'aucun arrêt créé si un autre est invalide');
  }

  public static function invalidNouveauxArrets(): array
  {
    return [
      'nom vide' => [['nom' => '', 'lat' => 45.5, 'lng' => 6.1]],
      'lat non numérique' => [['nom' => 'X', 'lat' => 'abc', 'lng' => 6.1]],
      'lat hors bornes' => [['nom' => 'X', 'lat' => 91, 'lng' => 6.1]],
      'lng hors bornes' => [['nom' => 'X', 'lat' => 45.5, 'lng' => 181]],
      'modalité inconnue' => [['nom' => 'X', 'lat' => 45.5, 'lng' => 6.1, 'types' => ['fusée']]],
    ];
  }

  public function testEditWithNouveauxArretsKeepsExistingLinks(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt A');
    $ligneId = $this->createLigne(['arret_ids' => [$a]]);
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'ligne_id' => $ligneId,
      'arret_ids' => [$a],
      'nouveaux_arrets' => [['nom' => 'PHPUnit GTFS - Ajout édition', 'lat' => 45.5, 'lng' => 6.1]],
    ]));
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->registerCreated($res['body']['arrets_crees']);
    $ids = $this->httpGet("/api/fetch_ligne.php?ligne_id=$ligneId")['body']['arret_ids'];
    sort($ids);
    $attendus = array_merge([$a], $res['body']['arrets_crees']);
    sort($attendus);
    $this->assertSame($attendus, $ids);
  }

  /** Commune / INSEE / CP d'un arrêt créé, lus en base (fetch_arret ne les expose qu'après géocodage). */
  private function communeDe(int $arretId): array
  {
    return self::dbQueryOne("SELECT commune, code_insee, cp FROM arrets WHERE id = $arretId");
  }

  public function testNouveauxArretsAreReverseGeocodedAtCreation(): void
  {
    // Moins de 10 arrêts : géocodage unitaire. Lyon (point témoin de ReverseGeocodeTest) + plein océan.
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'nouveaux_arrets' => [
        ['nom' => 'PHPUnit GTFS - Lyon', 'lat' => 45.7596, 'lng' => 4.8586],
        ['nom' => 'PHPUnit GTFS - Océan', 'lat' => 0, 'lng' => -30],
      ],
    ]));
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = {$res['body']['ligne_id']}");
    $this->registerCreated($res['body']['arrets_crees']);
    [$lyon, $ocean] = $res['body']['arrets_crees'];

    $this->assertSame(['commune' => 'Lyon', 'code_insee' => '69383', 'cp' => '69003'], $this->communeDe($lyon));
    $this->assertSame(['commune' => null, 'code_insee' => null, 'cp' => null], $this->communeDe($ocean), 'sans résultat : champs vides, arrêt créé quand même');
  }

  public function testManyNouveauxArretsAreGeocodedPastTheBatchThreshold(): void
  {
    // Plus de 10 arrêts : la lib passe par un seul appel batch (csv) plutôt que N appels
    // unitaires (seuil GEOPLATEFORME_BATCH_THRESHOLD) ; le résultat observable est le même
    // qu'en unitaire, ce test vérifie le rattachement résultat → arrêt dans l'ordre.
    $nouveaux = [];
    for ($i = 1; $i <= 11; $i++) {
      $nouveaux[] = ['nom' => "PHPUnit GTFS - Lot $i", 'lat' => 45.7596, 'lng' => 4.8586];
    }
    $nouveaux[] = ['nom' => 'PHPUnit GTFS - Lot océan', 'lat' => 0, 'lng' => -30];

    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload(['nouveaux_arrets' => $nouveaux]));
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = {$res['body']['ligne_id']}");
    $crees = $res['body']['arrets_crees'];
    $this->registerCreated($crees);
    $this->assertCount(12, $crees);

    // Chaque résultat est rattaché au bon arrêt (ordre conservé), y compris l'échec isolé
    foreach (array_slice($crees, 0, 11) as $id) {
      $this->assertSame(['commune' => 'Lyon', 'code_insee' => '69383', 'cp' => '69003'], $this->communeDe($id));
    }
    $this->assertSame(['commune' => null, 'code_insee' => null, 'cp' => null], $this->communeDe($crees[11]));
  }

  private function gtfsRefs(int $arretId): array
  {
    $rows = self::dbQuery("SELECT ref, libelle FROM references_externes WHERE arret_id = $arretId AND source = 'gtfs' ORDER BY id");
    return array_map(fn($r) => [$r['ref'], $r['libelle']], $rows);
  }

  public function testGtfsStopIdsAreStoredAndReturnedByFetchLigne(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt GTFS A');
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'arret_ids' => [$a],
      'gtfs_refs' => [['arret_id' => $a, 'stop_id' => 'STOP_A', 'nom' => 'Stop A']],
      'nouveaux_arrets' => [['nom' => 'PHPUnit GTFS - Nouveau', 'lat' => 45.7596, 'lng' => 4.8586, 'stop_id' => 'STOP_N']],
    ]));
    $this->assertSame(200, $res['status'], $res['raw']);
    $ligneId = $res['body']['ligne_id'];
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $ligneId");
    $this->registerCreated($res['body']['arrets_crees']);
    $nouveau = $res['body']['arrets_crees'][0];

    $this->assertSame([['STOP_A', 'Stop A']], $this->gtfsRefs($a));
    $this->assertSame([['STOP_N', 'PHPUnit GTFS - Nouveau']], $this->gtfsRefs($nouveau));

    $refs = $this->httpGet("/api/fetch_ligne.php?ligne_id=$ligneId")['body']['gtfs_refs'];
    $this->assertSame(['STOP_A'], $refs[$a]);
    $this->assertSame(['STOP_N'], $refs[$nouveau]);
  }

  public function testGtfsRefsAreIdempotentAndIgnoredForUnlinkedArrets(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt GTFS B');
    $b = $this->createFixtureArret('PHPUnit Arrêt GTFS C');
    $ligneId = $this->createLigne(['arret_ids' => [$a]]);
    $payload = $this->payload([
      'ligne_id' => $ligneId,
      'arret_ids' => [$a],
      'gtfs_refs' => [
        ['arret_id' => $a, 'stop_id' => 'S1'],
        ['arret_id' => $b, 'stop_id' => 'S2'], // non lié à la ligne : ignoré
      ],
    ]);
    // Deux envois identiques : pas d'erreur de doublon, une seule référence
    $this->assertSame(200, $this->httpPostJson('/api/add_ligne.php', $payload)['status']);
    $this->assertSame(200, $this->httpPostJson('/api/add_ligne.php', $payload)['status']);
    $this->assertCount(1, $this->gtfsRefs($a));
    $this->assertSame([], $this->gtfsRefs($b));
  }

  public function testInvalidGtfsRefIsRejected(): void
  {
    $res = $this->httpPostJson('/api/add_ligne.php', $this->payload([
      'gtfs_refs' => [['arret_id' => 0, 'stop_id' => '']],
    ]));
    $this->assertSame(400, $res['status']);
  }

  public function testDeleteArretIsLogicalAndRequiresBearer(): void
  {
    $a = $this->createFixtureArret('PHPUnit Arrêt à supprimer');
    $this->assertSame(401, $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $a])['status']);
    $this->assertSame(404, $this->httpPostJson('/api/delete_arret.php', ['arret_id' => 999999999], $this->bearer())['status']);
    $res = $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $a], $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame(1, (int) self::dbQueryOne("SELECT deleted FROM arrets WHERE id = $a")['deleted']);
  }
}
