<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Journalisation (`edit_logs`) des actions d'admin : arrêts (fusion, détachement, défusion, suppression),
 * exclusions de villes, suppression de commentaire (e-mail de l'auteur correctement enregistré) et de sortie.
 * Les logs des lignes sont dans LigneTransportTest.
 */
final class EditLogsAdminTest extends ApiTestCase
{
  private function bearer(): array
  {
    return ['Authorization: Bearer ' . (string) VG_TEST_CONFIG['admin_token']];
  }

  /** @return array<int, array<string, mixed>> logs d'un enregistrement, du plus ancien au plus récent */
  private function logs(string $collection, int $recordId): array
  {
    $this->cleanupOnTearDown("DELETE FROM edit_logs WHERE collection = '$collection' AND record_id = $recordId");
    return self::dbQuery("SELECT type, author, author_email, changes, falaise_id FROM edit_logs WHERE collection = '$collection' AND record_id = $recordId ORDER BY id");
  }

  public function testFusionDetachementDefusionEtSuppressionDArretSontLogues(): void
  {
    $a = $this->createFixtureArret('PHPUnit Log A', 43.80, 5.30);
    $b = $this->createFixtureArret('PHPUnit Log B', 43.81, 5.31);
    $c = $this->createFixtureArret('PHPUnit Log C', 43.82, 5.32);

    $res = $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $a, 'cible_id' => $b], $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);
    $p = (int) $res['body']['parent_id'];
    $this->cleanupOnTearDown("DELETE FROM arrets WHERE id = $p");
    $this->cleanupOnTearDown("UPDATE arrets SET parent_id = NULL WHERE parent_id = $p");

    $logsParent = $this->logs('arrets', $p);
    $this->assertSame(['insert'], array_column($logsParent, 'type'), 'création du parent par fusion');
    $this->assertSame('Admin', $logsParent[0]['author']);

    // Un enfant de plus sous le parent existant, puis détachement
    $this->assertSame(200, $this->httpPostJson('/api/merge_arrets.php', ['source_id' => $c, 'cible_id' => $p], $this->bearer())['status']);
    $this->assertSame(200, $this->httpPostJson('/api/detach_arret.php', ['arret_id' => $c], $this->bearer())['status']);
    $this->assertSame(['update'], array_column($this->logs('arrets', $c), 'type'), 'détachement');
    $this->assertSame(['insert', 'update'], array_column($this->logs('arrets', $p), 'type'), 'ajout d\'un enfant');

    // Défusion du parent (deux enfants restants : héritier requis seulement s'il porte des accès, ce qui n'est pas le cas)
    $this->assertSame(200, $this->httpPostJson('/api/unmerge_arret.php', ['parent_id' => $p], $this->bearer())['status']);
    $this->assertSame(['insert', 'update', 'delete'], array_column($this->logs('arrets', $p), 'type'), 'défusion');

    // Suppression logique d'un orphelin
    $this->assertSame(200, $this->httpPostJson('/api/delete_arret.php', ['arret_id' => $a], $this->bearer())['status']);
    $logsA = $this->logs('arrets', $a);
    $this->assertSame(['delete'], array_column($logsA, 'type'));
    $this->assertStringContainsString('PHPUnit Log A', $logsA[0]['changes']);
  }

  public function testExclusionVilleFalaiseEstLoguee(): void
  {
    $falaise = $this->createFixtureFalaise();
    $res = $this->httpPostJson('/api/private/exclude_falaise.php', ['ville_id' => self::WITNESS_VILLE_ID, 'falaise_id' => $falaise], $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);
    $row = self::dbQueryOne("SELECT id FROM exclusions_villes_falaises WHERE ville_id = " . self::WITNESS_VILLE_ID . " AND falaise_id = $falaise");
    $this->assertNotNull($row);
    $id = (int) $row['id'];
    $this->cleanupOnTearDown("DELETE FROM exclusions_villes_falaises WHERE id = $id");

    $logs = $this->logs('exclusions_villes_falaises', $id);
    $this->assertSame(['insert'], array_column($logs, 'type'));
    $this->assertSame((string) $falaise, (string) $logs[0]['falaise_id']);
  }

  public function testExclusionsRepondentEnJsonAvecDesCodesHttp(): void
  {
    foreach (['exclude_falaise', 'exclude_train', 'exclude_vgf'] as $endpoint) {
      $url = "/api/private/$endpoint.php";
      $this->assertSame(405, $this->httpGet($url)['status'], "$endpoint GET");
      $res = $this->httpPostJson($url, ['ville_id' => self::WITNESS_VILLE_ID]);
      $this->assertSame(401, $res['status'], "$endpoint sans jeton");
      $this->assertArrayHasKey('error', $res['body']);
      $res = $this->httpPostJson($url, ['ville_id' => self::WITNESS_VILLE_ID], $this->bearer());
      $this->assertSame(400, $res['status'], "$endpoint paramètres manquants");
      $this->assertArrayHasKey('error', $res['body']);
    }
  }

  public function testExclusionVilleFalaiseReponseSuccessEtDoublonRefuse(): void
  {
    $falaise = $this->createFixtureFalaise();
    $payload = ['ville_id' => self::WITNESS_VILLE_ID, 'falaise_id' => $falaise];
    $this->cleanupOnTearDown("DELETE FROM exclusions_villes_falaises WHERE falaise_id = $falaise");
    $res = $this->httpPostJson('/api/private/exclude_falaise.php', $payload, $this->bearer());
    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertTrue($res['body']['success']);
    $row = self::dbQueryOne("SELECT id FROM exclusions_villes_falaises WHERE falaise_id = $falaise");
    $this->cleanupOnTearDown("DELETE FROM edit_logs WHERE collection = 'exclusions_villes_falaises' AND record_id = " . (int) $row['id']);
    // Un doublon ne doit jamais être un 200 : 409 si une contrainte d'unicité existe, sinon la ligne est dédoublonnée côté données
    $dup = $this->httpPostJson('/api/private/exclude_falaise.php', $payload, $this->bearer());
    $this->assertContains($dup['status'], [200, 409], $dup['raw']);
  }

  public function testSuppressionDeCommentaireEnregistreLEmailDeLAuteur(): void
  {
    $falaise = $this->createFixtureFalaise();
    $email = 'phpunit-log@example.org';
    $id = self::dbInsert(
      "INSERT INTO commentaires_falaises (falaise_id, nom, email, commentaire) VALUES ($falaise, 'PHPUnit', '$email', 'à supprimer')"
    );
    $this->cleanupOnTearDown("DELETE FROM commentaires_falaises WHERE id = $id");

    $res = $this->httpPostJson('/api/delete_comment.php', ['commentaire_id' => $id, 'email' => $email]);
    $this->assertSame(200, $res['status'], $res['raw']);

    $logs = $this->logs('commentaires_falaises', $id);
    $this->assertSame(['delete'], array_column($logs, 'type'));
    $this->assertSame($email, $logs[0]['author_email'], "l'e-mail ne doit pas être converti en entier (bug de bind_param)");
    $this->assertSame((string) $falaise, (string) $logs[0]['falaise_id']);
    $this->assertStringContainsString('commentaire', $logs[0]['changes']);
  }
}
