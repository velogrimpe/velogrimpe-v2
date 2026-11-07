<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8bis : un itinéraire train relie une ville à un ARRÊT quelconque
 * (`train.arret_id`), pas seulement à une gare. Couvre les trois points
 * d'écriture/vérification : api/add_train.php (formulaire public),
 * api/private/add_train.php (admin, Bearer) et api/verify_train_dup.php.
 * `gare_id` reste accepté en entrée (anciens liens, scripts d'import).
 */
final class AddTrainTest extends ApiTestCase
{
  private function arretBus(string $nom = 'PHPUnit Car Train'): int
  {
    $arretId = $this->createFixtureArret($nom, 45.2, 5.2, ['bus']);
    $this->cleanupOnTearDown("DELETE FROM train WHERE arret_id = $arretId");
    return $arretId;
  }

  private function champs(array $extra = []): array
  {
    return array_merge([
      'admin' => '0',
      'ville_id' => (string) self::WITNESS_VILLE_ID,
      'train_temps' => '45',
      'train_correspmin' => '0',
      'train_correspmax' => '1',
      'train_public' => '2',
      'train_descr' => 'Car direct, vélos acceptés.',
      'horaires_depart' => 'Lyon Part-Dieu',
      'train_arrivee' => 'PHPUnit arrivée',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ], $extra);
  }

  private function nbTrains(int $arretId): int
  {
    return (int) self::dbQueryOne("SELECT COUNT(*) AS n FROM train WHERE arret_id = $arretId")['n'];
  }

  /** @return string[] */
  private function bearer(): array
  {
    return ['Authorization: Bearer ' . (string) VG_TEST_CONFIG['admin_token']];
  }

  // --- api/add_train.php ----------------------------------------------------

  public function testAjoutDepuisUnArretDeBusEcritArretId(): void
  {
    $arretId = $this->arretBus();

    $res = $this->httpPostMultipart('/api/add_train.php', $this->champs(['arret_id' => (string) $arretId]));

    $this->assertSame(302, $res['status'], $res['raw']);
    $this->assertStringContainsString("arret_id=$arretId", (string) $res['location']);
    $row = self::dbQueryOne("SELECT ville_id, train_temps, train_public FROM train WHERE arret_id = $arretId");
    $this->assertNotNull($row, "l'itinéraire train depuis un arrêt de bus aurait dû être créé");
    $this->assertSame((string) self::WITNESS_VILLE_ID, $row['ville_id']);
    $this->assertSame('45', $row['train_temps']);
  }

  public function testGareIdLegacyResteAccepte(): void
  {
    $arretId = $this->arretBus('PHPUnit Car Train legacy');

    $res = $this->httpPostMultipart('/api/add_train.php', $this->champs(['gare_id' => (string) $arretId]));

    $this->assertSame(302, $res['status'], $res['raw']);
    $this->assertSame(1, $this->nbTrains($arretId));
  }

  public function testArretInconnuEstRefuseSansRienEcrire(): void
  {
    $avant = (int) self::dbQueryOne('SELECT COUNT(*) AS n FROM train')['n'];

    $res = $this->httpPostMultipart('/api/add_train.php', $this->champs(['arret_id' => '99999999']));

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertSame($avant, (int) self::dbQueryOne('SELECT COUNT(*) AS n FROM train')['n']);
  }

  public function testArretSupprimeEstRefuse(): void
  {
    $arretId = $this->arretBus('PHPUnit Car Train supprimé');
    self::dbExec("UPDATE arrets SET deleted = 1 WHERE id = $arretId");

    $res = $this->httpPostMultipart('/api/add_train.php', $this->champs(['arret_id' => (string) $arretId]));

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertSame(0, $this->nbTrains($arretId));
  }

  public function testDoublonVilleArretTypeEstRefuse(): void
  {
    $arretId = $this->arretBus('PHPUnit Car Train doublon');
    $this->httpPostMultipart('/api/add_train.php', $this->champs(['arret_id' => (string) $arretId]));

    $this->httpPostMultipart('/api/add_train.php', $this->champs(['arret_id' => (string) $arretId]));

    $this->assertSame(1, $this->nbTrains($arretId));
  }

  // --- api/private/add_train.php ----------------------------------------------

  private function payloadPrive(array $extra = []): array
  {
    return array_merge([
      'user' => 'PHPUnit',
      'ville_id' => self::WITNESS_VILLE_ID,
      'train_temps' => 50,
      'train_correspmin' => 0,
      'train_correspmax' => 0,
      'train_descr' => 'Import',
      'train_depart' => 'Lyon',
      'train_arrivee' => 'PHPUnit arrivée',
    ], $extra);
  }

  public function testImportAdminAcceptArretIdEtGareIdLegacy(): void
  {
    $a1 = $this->arretBus('PHPUnit Import arret_id');
    $a2 = $this->arretBus('PHPUnit Import gare_id');

    $r1 = $this->httpPostJson('/api/private/add_train.php', $this->payloadPrive(['arret_id' => $a1]), $this->bearer());
    $r2 = $this->httpPostJson('/api/private/add_train.php', $this->payloadPrive(['gare_id' => $a2]), $this->bearer());

    $this->assertTrue($r1['body']['success'] ?? false, $r1['raw']);
    $this->assertTrue($r2['body']['success'] ?? false, $r2['raw']);
    $this->assertSame(1, $this->nbTrains($a1));
    $this->assertSame(1, $this->nbTrains($a2));
  }

  public function testImportAdminRefuseUnArretInconnu(): void
  {
    $res = $this->httpPostJson('/api/private/add_train.php', $this->payloadPrive(['arret_id' => 99999999]), $this->bearer());

    $this->assertSame(400, $res['status'], $res['raw']);
    $this->assertFalse($res['body']['success'] ?? true);
  }

  // --- api/verify_train_dup.php -------------------------------------------------

  public function testVerifyTrainDupAccepteArretIdEtGareId(): void
  {
    $arretId = $this->arretBus('PHPUnit Dup');
    $v = self::WITNESS_VILLE_ID;
    $this->assertFalse($this->httpGet("/api/verify_train_dup.php?ville_id=$v&arret_id=$arretId&train_tgv=0")['body']);

    $this->httpPostMultipart('/api/add_train.php', $this->champs(['arret_id' => (string) $arretId]));

    $this->assertTrue($this->httpGet("/api/verify_train_dup.php?ville_id=$v&arret_id=$arretId&train_tgv=0")['body']);
    $this->assertTrue($this->httpGet("/api/verify_train_dup.php?ville_id=$v&gare_id=$arretId&train_tgv=0")['body'], 'gare_id legacy');
    $this->assertFalse($this->httpGet("/api/verify_train_dup.php?ville_id=$v&arret_id=$arretId&train_tgv=1")['body'], 'TGV ≠ TER');
  }
}
