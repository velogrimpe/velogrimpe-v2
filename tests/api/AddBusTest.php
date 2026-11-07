<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/add_arret.php (création + édition d'un arrêt, avec lignes/liaisons/falaises
 * liées) et api/fetch_arret.php (lecture, utilisée ici pour vérifier ce qui a été
 * persisté). Basculé sur la table `arrets` multimodale au Lot 2 (même
 * contrat JSON qu'avant, cf. docs/plan-implementation-arrets.md).
 */
final class AddBusTest extends ApiTestCase
{
  public function testMethodNotAllowedOnGet(): void
  {
    $res = $this->httpGet('/api/add_arret.php');
    $this->assertSame(405, $res['status']);
  }

  public function testMissingNomIsRejected(): void
  {
    $res = $this->httpPostJson('/api/add_arret.php', [
      'loc' => '43.8270,5.3830',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(400, $res['status']);
    $this->assertArrayHasKey('error', $res['body']);
  }

  public function testCreatesArretWithFalaise(): void
  {
    // lignes/liaisons volontairement absentes du payload : bus_lignes/
    // bus_liaisons sont en cours de décommissionnement (cf.
    // docs/conception-bus.md, Étape 8) — pas d'intérêt à maintenir leur
    // couverture de test jusqu'à la bascule finale.
    $falaiseId = $this->createFixtureFalaise();

    $res = $this->httpPostJson('/api/add_arret.php', [
      'admin' => '0',
      'arret_id' => null,
      'nom' => 'PHPUnit - Arrêt créé',
      'loc' => '43.8270,5.3830',
      'description' => '<p>Description de test</p>',
      'types' => ['bus'],
      'osm_id' => null,
      'osm_data' => null,
      'falaise_ids' => [$falaiseId],
      'lignes' => [],
      'liaisons' => [],
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
      'message' => '',
    ]);

    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertTrue($res['body']['success'] ?? false);
    $arretId = $res['body']['arret_id'];
    $this->assertIsInt($arretId);
    $this->registerFixtureArret($arretId);

    $fetch = $this->httpGet("/api/fetch_arret.php?arret_id=$arretId");
    $this->assertSame(200, $fetch['status']);
    $body = $fetch['body'];

    $this->assertSame('PHPUnit - Arrêt créé', $body['arret']['nom']);
    $this->assertStringContainsString('Description de test', $body['arret']['description']);
    $this->assertSame(['bus'], $body['arret']['types']);
    $this->assertSame([$falaiseId], $body['falaise_ids']);
  }

  public function testMissingTypesIsRejected(): void
  {
    $res = $this->httpPostJson('/api/add_arret.php', [
      'nom' => 'PHPUnit - Sans type',
      'loc' => '43.8270,5.3830',
      'types' => [],
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(400, $res['status']);
    $this->assertArrayHasKey('error', $res['body']);
  }

  public function testCreatesMultimodalArret(): void
  {
    $res = $this->httpPostJson('/api/add_arret.php', [
      'nom' => 'PHPUnit - Arrêt multimodal',
      'loc' => '43.8270,5.3830',
      'types' => ['tram', 'bus'],
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);

    $this->assertSame(200, $res['status'], $res['raw']);
    $arretId = $res['body']['arret_id'];
    $this->registerFixtureArret($arretId);

    $fetch = $this->httpGet("/api/fetch_arret.php?arret_id=$arretId");
    $body = $fetch['body'];
    sort($body['arret']['types']);
    $this->assertSame(['bus', 'tram'], $body['arret']['types']);
    $this->assertSame('tram', $body['arret']['type_dominant']);
  }

  public function testPersistsCommuneFields(): void
  {
    $res = $this->httpPostJson('/api/add_arret.php', [
      'nom' => 'PHPUnit - Arrêt géocodé',
      'loc' => '45.7596,4.8586',
      'types' => ['bus'],
      'commune' => 'Lyon',
      'code_insee' => '69383',
      'cp' => '69003',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);

    $this->assertSame(200, $res['status'], $res['raw']);
    $arretId = $res['body']['arret_id'];
    $this->registerFixtureArret($arretId);

    $fetch = $this->httpGet("/api/fetch_arret.php?arret_id=$arretId");
    $body = $fetch['body'];
    $this->assertSame('Lyon', $body['arret']['commune']);
    $this->assertSame('69383', $body['arret']['code_insee']);
    $this->assertSame('69003', $body['arret']['cp']);
  }

  public function testEditsExistingArretAndReplacesFalaiseLinks(): void
  {
    $falaiseA = $this->createFixtureFalaise('PHPUnit Fixture Falaise A');
    $falaiseB = $this->createFixtureFalaise('PHPUnit Fixture Falaise B');
    $arretId = $this->createFixtureArret();

    // Lien initial vers falaise A
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail)
                  VALUES ($arretId, $falaiseA, 'phpunit', 'phpunit@example.org')");

    $res = $this->httpPostJson('/api/add_arret.php', [
      'admin' => '0',
      'arret_id' => $arretId,
      'nom' => 'PHPUnit - Arrêt modifié',
      'loc' => '43.8300,5.3900',
      'description' => '<p>Nouvelle description</p>',
      'types' => ['bus'],
      'osm_id' => 'node/999',
      'osm_data' => ['highway' => 'bus_stop'],
      'falaise_ids' => [$falaiseB],
      'lignes' => [],
      'liaisons' => [],
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
      'message' => '',
    ]);

    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame($arretId, $res['body']['arret_id']);

    $fetch = $this->httpGet("/api/fetch_arret.php?arret_id=$arretId");
    $body = $fetch['body'];
    $this->assertSame('PHPUnit - Arrêt modifié', $body['arret']['nom']);
    $this->assertSame('node/999', $body['arret']['osm_id']);
    $this->assertSame([$falaiseB], $body['falaise_ids'], 'le set de falaises liées doit être remplacé, pas cumulé');
  }
}
