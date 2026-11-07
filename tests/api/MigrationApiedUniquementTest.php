<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8 : sql_migrations/4_apieduniquement_vers_acces_pieton.sql migre les
 * itinéraires `velo` marqués « à pied uniquement » vers `acces_pieton_falaise`
 * (copie), puis les masque dans `velo` (velo_public = -1, valeur exclue par
 * tous les lecteurs `>= 0` / `>= 1`) au lieu de les supprimer.
 * Le script est rejouable : on le lance donc depuis le test, sur une fixture.
 */
final class MigrationApiedUniquementTest extends ApiTestCase
{
  private const MIGRATION = __DIR__ . '/../../sql_migrations/4_apieduniquement_vers_acces_pieton.sql';
  private const PHRASE = 'Attention : itinéraire impossible à vélo, à pied uniquement.';

  private function creerVeloApied(int $arretId, int $falaiseId, string $descr, string $contrib = "'Florent','florent@example.org'", int $public = 1): int
  {
    $id = self::dbInsert(
      "INSERT INTO velo (arret_id, falaise_id, velo_depart, velo_arrivee, velo_km, velo_dplus, velo_dmoins,
        velo_descr, velo_variante, velo_varianteformate, velo_apieduniquement, velo_public, velo_contrib)
       VALUES ($arretId, $falaiseId, 'phpunit-depart', 'phpunit-arrivee', 2, 10, 10,
        '" . self::escape($descr) . "', '', '', 1, $public, '" . self::escape($contrib) . "')"
    );
    $this->cleanupOnTearDown("DELETE FROM velo WHERE velo_id = $id");
    $this->cleanupOnTearDown("DELETE FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    return $id;
  }

  private function migrer(): void
  {
    self::dbExec((string) file_get_contents(self::MIGRATION));
  }

  public function testCopieVersAccesPietonEtMasqueDansVelo(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $veloId = $this->creerVeloApied($arretId, $falaiseId, self::PHRASE . ' Sentier balisé.');

    $this->migrer();

    $acces = self::dbQueryOne("SELECT description, contrib, contrib_mail FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertNotNull($acces, "l'accès piéton aurait dû être créé");
    $this->assertSame('Sentier balisé.', $acces['description'], 'la phrase standard est retirée de la description');
    $this->assertSame('Florent', $acces['contrib']);
    $this->assertSame('florent@example.org', $acces['contrib_mail']);

    $velo = self::dbQueryOne("SELECT velo_public FROM velo WHERE velo_id = $veloId");
    $this->assertSame('-1', $velo['velo_public'], "l'itinéraire est masqué, pas supprimé");
  }

  public function testDescriptionVideApresRetraitDeLaPhraseDevientNull(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $this->creerVeloApied($arretId, $falaiseId, self::PHRASE);

    $this->migrer();

    $acces = self::dbQueryOne("SELECT description FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertNull($acces['description']);
  }

  public function testRejouableSansDoublonNiPerte(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $this->creerVeloApied($arretId, $falaiseId, 'Chemin du bois');

    $this->migrer();
    $this->migrer();

    $n = self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertSame('1', $n['n']);
  }

  public function testAccesPietonDejaPresentEstConserve(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $this->creerVeloApied($arretId, $falaiseId, 'Ancienne description');
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, description, contrib, contrib_mail)
      VALUES ($arretId, $falaiseId, 'Description existante', 'Autre', 'autre@example.org')");

    $this->migrer();

    $acces = self::dbQueryOne("SELECT description, contrib FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertSame('Description existante', $acces['description']);
    $this->assertSame('Autre', $acces['contrib']);
  }

  public function testItineraireVeloNormalNEstPasTouche(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $veloId = $this->creerVeloApied($arretId, $falaiseId, 'Vélo');
    self::dbExec("UPDATE velo SET velo_apieduniquement = 0 WHERE velo_id = $veloId");

    $this->migrer();

    $this->assertNull(self::dbQueryOne("SELECT 1 AS x FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId"));
    $this->assertSame('1', self::dbQueryOne("SELECT velo_public FROM velo WHERE velo_id = $veloId")['velo_public']);
  }

  public function testContributeurNonParsableDonneContributeurAnonymeSansPerdreLAcces(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $this->creerVeloApied($arretId, $falaiseId, 'x', 'Florent');

    $this->migrer();

    $acces = self::dbQueryOne("SELECT contrib, contrib_mail FROM acces_pieton_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->assertNotNull($acces);
    $this->assertNotSame('', $acces['contrib']);
  }
}
