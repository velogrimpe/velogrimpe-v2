<?php

require_once __DIR__ . '/ApiTestCase.php';

/** api/link_arret_falaise.php : lier / délier un arrêt existant à une falaise. */
final class LinkBusFalaiseTest extends ApiTestCase
{
  public function testMethodNotAllowedOnGet(): void
  {
    $res = $this->httpGet('/api/link_arret_falaise.php');
    $this->assertSame(405, $res['status']);
  }

  public function testLinkThenUnlink(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $link = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'link',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(200, $link['status'], $link['raw']);
    $this->assertTrue($link['body']['success']);
    $this->assertTrue($link['body']['linked']);

    $row = self::dbQueryOne(
      "SELECT 1 AS present FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertNotNull($row, 'la liaison arrêt-falaise doit exister en base après link');

    $unlink = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'unlink',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(200, $unlink['status']);
    $this->assertFalse($unlink['body']['linked']);

    $row = self::dbQueryOne(
      "SELECT 1 AS present FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertNull($row, 'la liaison arrêt-falaise ne doit plus exister après unlink');
  }

  public function testLinkTwiceIsIdempotent(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $payload = [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'link',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ];
    $first = $this->httpPostJson('/api/link_arret_falaise.php', $payload);
    $second = $this->httpPostJson('/api/link_arret_falaise.php', $payload);

    $this->assertSame(200, $first['status']);
    $this->assertSame(200, $second['status']);

    $rows = self::dbQuery(
      "SELECT COUNT(*) AS n FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"
    );
    $this->assertSame('1', $rows[0]['n']);
  }

  public function testInvalidActionIsRejected(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();

    $res = $this->httpPostJson('/api/link_arret_falaise.php', [
      'arret_id' => $arretId,
      'falaise_id' => $falaiseId,
      'action' => 'delete-everything',
      'nom_prenom' => 'Testeur',
      'email' => 'test@example.org',
    ]);
    $this->assertSame(400, $res['status']);
  }
}
