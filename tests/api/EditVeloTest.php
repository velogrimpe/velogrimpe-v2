<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/edit_velo.php : modification d'un itinéraire existant. Trois
 * comportements distincts selon le contexte (cf. l'en-tête du fichier testé,
 * DECISIONS D010) : admin (tout s'applique + validation), contributeur sur un
 * itinéraire non validé (les champs s'appliquent), contributeur sur un
 * itinéraire déjà validé (rien n'est écrit, juste une suggestion par mail).
 */
final class EditVeloTest extends ApiTestCase
{
  public function testContribModifieUnItineraireNonValide(): void
  {
    $veloId = $this->createRawVeloFixture(['velo_public' => 0, 'velo_km' => 10.0]);

    $res = $this->httpPostMultipart('/api/edit_velo.php', [
      'admin' => '0',
      'velo_id' => (string) $veloId,
      'velo_km' => '15.5',
      'velo_dplus' => '200',
      'velo_dmoins' => '50',
      'velo_descr' => 'Description modifiée par le contributeur.',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ]);

    $this->assertSame(302, $res['status'], "réponse inattendue : {$res['raw']}");
    $this->assertStringContainsString('type=update', $res['location']);

    $row = self::dbQueryOne("SELECT km, description, public FROM acces_falaise WHERE acces_id = $veloId");
    $this->assertSame('15.5', $row['km']);
    $this->assertSame('Description modifiée par le contributeur.', $row['description']);
    $this->assertSame('0', $row['public'], 'un contributeur ne doit pas pouvoir valider lui-même un itinéraire');
  }

  public function testAdminModifieEtValideLItineraire(): void
  {
    $veloId = $this->createRawVeloFixture(['velo_public' => 0, 'velo_km' => 10.0]);

    $res = $this->httpPostMultipart('/api/edit_velo.php', [
      'admin' => (string) VG_TEST_CONFIG['admin_token'],
      'velo_id' => (string) $veloId,
      'velo_km' => '20',
      'velo_dplus' => '300',
      'velo_dmoins' => '80',
      'velo_descr' => 'Description modifiée par l\'admin.',
      'nom_prenom' => 'PHPUnit Admin',
      'email' => 'phpunit@example.org',
    ]);

    $this->assertSame(302, $res['status'], "réponse inattendue : {$res['raw']}");

    $row = self::dbQueryOne("SELECT km, public FROM acces_falaise WHERE acces_id = $veloId");
    $this->assertSame('20', $row['km']);
    $this->assertSame('1', $row['public'], 'une édition admin doit valider l\'itinéraire');
  }

  public function testSuggestionSurItineraireValideNeModifieRien(): void
  {
    $veloId = $this->createRawVeloFixture(['velo_public' => 1, 'velo_descr' => 'Description originale.']);

    $res = $this->httpPostMultipart('/api/edit_velo.php', [
      'admin' => '0',
      'velo_id' => (string) $veloId,
      'velo_km' => '999', // ignoré : pas écrit pour un itinéraire déjà validé
      'velo_dplus' => '999',
      'velo_dmoins' => '999',
      'velo_descr' => 'Description suggérée par un contributeur.',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ]);

    $this->assertSame(302, $res['status'], "réponse inattendue : {$res['raw']}");
    $this->assertStringContainsString('type=suggestion', $res['location']);

    $row = self::dbQueryOne("SELECT description, km FROM acces_falaise WHERE acces_id = $veloId");
    $this->assertSame('Description originale.', $row['description'], 'une suggestion ne doit rien écrire en base');
  }

  public function testSuggestionSansChangementEstRefusee(): void
  {
    $veloId = $this->createRawVeloFixture(['velo_public' => 1, 'velo_descr' => 'Description originale.']);

    $res = $this->httpPostMultipart('/api/edit_velo.php', [
      'admin' => '0',
      'velo_id' => (string) $veloId,
      'velo_descr' => 'Description originale.', // identique : rien à transmettre
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ]);

    $this->assertStringContainsString('Aucune modification à transmettre', $res['raw']);
  }

  public function testItineraireInconnuRetourne404(): void
  {
    $res = $this->httpPostMultipart('/api/edit_velo.php', [
      'admin' => '0',
      'velo_id' => '999999999',
      'nom_prenom' => 'PHPUnit',
      'email' => 'phpunit@example.org',
    ]);

    $this->assertSame(404, $res['status']);
  }

  private function createRawVeloFixture(array $overrides = []): int
  {
    $defaults = [
      'velo_descr' => 'Description de test.',
      'velo_variante' => 'Test PHPUnit ' . bin2hex(random_bytes(3)),
      'velo_varianteformate' => 'phpunit-test-' . bin2hex(random_bytes(4)),
      'velo_km' => 5.0,
      'velo_dplus' => 100,
      'velo_dmoins' => 20,
      'velo_public' => 0,
    ];
    $v = array_merge($defaults, $overrides);

    return $this->createFixtureAcces(self::WITNESS_GARE_ID, self::WITNESS_FALAISE_ID, [
      'type' => 'velo',
      'km' => $v['velo_km'],
      'dplus' => $v['velo_dplus'],
      'dmoins' => $v['velo_dmoins'],
      'description' => $v['velo_descr'],
      'variante' => $v['velo_variante'],
      'variante_formate' => $v['velo_varianteformate'],
      'public' => $v['velo_public'],
    ]);
  }
}
