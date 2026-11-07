<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/add_falaise.php, Lot 8 : à la création, le champ `arrets_pietons`
 * (liste JSON d'ids d'arrêts) crée les accès piétons arrêt → falaise
 * (`acces_pieton_falaise`) en même temps que la falaise. Tous les arrêts sont
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

    $rows = self::dbQuery("SELECT arret_id, contrib, contrib_mail FROM acces_pieton_falaise WHERE falaise_id = $falaiseId ORDER BY arret_id");
    $this->assertSame([$a1, $a2], array_map(fn($r) => (int) $r['arret_id'], $rows));
    $this->assertSame('PHPUnit', $rows[0]['contrib']);
    $this->assertSame('phpunit@example.org', $rows[0]['contrib_mail']);

    $log = self::dbQueryOne("SELECT 1 AS x FROM edit_logs WHERE collection = 'acces_pieton_falaise' AND falaise_id = $falaiseId");
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
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_pieton_falaise WHERE arret_id = $a1"));
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
    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_pieton_falaise WHERE falaise_id = $falaiseId"));
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
      self::dbQueryOne("SELECT 1 AS x FROM acces_pieton_falaise WHERE falaise_id = $falaiseId"),
      "en édition, les accès se gèrent depuis l'éditeur de détails, pas ici"
    );
  }
}
