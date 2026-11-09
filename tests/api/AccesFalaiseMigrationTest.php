<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8quater : sql_migrations/6_acces_falaise.sql renomme `velo` en
 * `acces_falaise`, y verse les accès de `acces_pieton_falaise` et supprime
 * `velo_apiedpossible` / `velo_apieduniquement`. Migration ponctuelle non
 * rejouable : on vérifie l'état du schéma et des données, pas le script.
 *
 * Témoins (jeu de dev) : les 6 itinéraires « à pied uniquement » (velo_id 19,
 * 125, 203, 204, 273, 374) étaient masqués par la migration 4 ; ils deviennent
 * `type = 'pied'`, `public = 1`.
 */
final class AccesFalaiseMigrationTest extends ApiTestCase
{
  private const ID_PIED_VENUS_DE_VELO = [19, 125, 203, 204, 273, 374];

  private static function colonnes(): array
  {
    return array_column(
      self::dbQuery("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acces_falaise'"),
      null,
      'COLUMN_NAME'
    );
  }

  public function testLaTableVeloAEteRenommee(): void
  {
    $n = self::dbQueryOne("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'velo'");
    $this->assertSame('0', $n['n'], '`velo` doit être renommée en `acces_falaise`');
    $this->assertNotEmpty(self::colonnes(), '`acces_falaise` doit exister');
  }

  public function testColonnesDuSchemaCible(): void
  {
    $cols = self::colonnes();
    foreach ([
      'acces_id', 'type', 'arret_id', 'depart_slug', 'falaise_id', 'arrivee_slug', 'description',
      'date_creation', 'date_modification', 'contrib', 'contrib_mail', 'km', 'dplus', 'dmoins',
      'lien_openrunner', 'variante', 'variante_formate', 'public',
    ] as $c) {
      $this->assertArrayHasKey($c, $cols, "colonne `$c` manquante");
    }
    foreach ([
      'velo_id', 'velo_depart', 'velo_arrivee', 'velo_km', 'velo_dplus', 'velo_dmoins', 'velo_descr', 'velo_openrunner',
      'velo_variante', 'velo_varianteformate', 'velo_public', 'velo_contrib', 'velo_apiedpossible', 'velo_apieduniquement', 'gare_id',
    ] as $c) {
      $this->assertArrayNotHasKey($c, $cols, "colonne `$c` aurait dû disparaître");
    }
    $this->assertStringStartsWith('int(11)', $cols['acces_id']['COLUMN_TYPE']);
    $this->assertStringStartsWith("enum('velo','pied')", $cols['type']['COLUMN_TYPE'], 'pas de type `autre`');
    foreach (['km', 'dplus', 'dmoins', 'lien_openrunner'] as $c) {
      $this->assertSame('YES', $cols[$c]['IS_NULLABLE'], "`$c` est optionnelle");
    }
    foreach (['variante', 'variante_formate', 'description', 'contrib', 'contrib_mail', 'public'] as $c) {
      $this->assertSame('NO', $cols[$c]['IS_NULLABLE'], "`$c` est NOT NULL");
    }
  }

  public function testCleEtrangereVersArretsEtFalaisesSansCascade(): void
  {
    $fks = self::dbQuery(
      "SELECT k.COLUMN_NAME AS col, k.REFERENCED_TABLE_NAME AS t, k.REFERENCED_COLUMN_NAME AS c, r.DELETE_RULE AS del
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
       WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'acces_falaise' AND k.REFERENCED_TABLE_NAME IS NOT NULL"
    );
    $parCol = array_column($fks, null, 'col');
    $this->assertSame('arrets', $parCol['arret_id']['t'] ?? null);
    $this->assertSame('id', $parCol['arret_id']['c'] ?? null);
    $this->assertSame('falaises', $parCol['falaise_id']['t'] ?? null);
    $this->assertSame('falaise_id', $parCol['falaise_id']['c'] ?? null);
    foreach ($fks as $fk) {
      $this->assertNotSame('CASCADE', $fk['del'], "FK {$fk['col']} : pas de cascade");
    }
  }

  public function testUnicitePrimaireArretFalaiseTypeVariante(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $insert = fn(string $variante) => self::dbExec(
      "INSERT INTO acces_falaise (type, arret_id, falaise_id, depart_slug, arrivee_slug, description, contrib, public, variante, variante_formate)
       VALUES ('pied', $arretId, $falaiseId, 'phpunit-depart', 'phpunit-arrivee', '', 'phpunit', 1, '$variante', '')"
    );
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $insert('');
    $insert('autre variante'); // une variante différente est acceptée
    $this->expectException(\RuntimeException::class);
    $insert(''); // même (arret, falaise, type, variante) : refusé
  }

  public function testLesFkRefusentUnArretOuUneFalaiseInexistants(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    $refuse = function (int $a, int $f): bool {
      try {
        self::dbExec(
          "INSERT INTO acces_falaise (type, arret_id, falaise_id, depart_slug, arrivee_slug, description, contrib, public, variante, variante_formate)
           VALUES ('pied', $a, $f, 'x', 'y', '', 'phpunit', 1, 'fk', '')"
        );
        self::dbExec("DELETE FROM acces_falaise WHERE variante = 'fk' AND contrib = 'phpunit'");
        return false;
      } catch (\RuntimeException $e) {
        return true;
      }
    };
    $this->assertTrue($refuse(99999999, $falaiseId), 'arrêt inexistant refusé');
    $this->assertTrue($refuse($arretId, 32000), 'falaise inexistante refusée');
  }

  public function testSupprimerUnArretAvecAccesEstRefuse(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret();
    self::dbExec(
      "INSERT INTO acces_falaise (type, arret_id, falaise_id, depart_slug, arrivee_slug, description, contrib, public, variante, variante_formate)
       VALUES ('velo', $arretId, $falaiseId, 'a', 'b', '', 'phpunit', 1, '', '')"
    );
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE arret_id = $arretId AND falaise_id = $falaiseId");
    $this->expectException(\RuntimeException::class);
    self::dbExec("DELETE FROM arrets WHERE id = $arretId");
  }

  public function testAucunIdPerduEtLesAccesPietonsSontVerses(): void
  {
    $n = self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE acces_id <= 581");
    $this->assertGreaterThanOrEqual(486, (int) $n['n'], 'les 486 lignes velo du jeu de dev gardent leur id');
    $pied = self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE type = 'pied'");
    // 6 « à pied uniquement » venus de velo + 47 accès piétons d'origine non doublonnés
    $this->assertGreaterThanOrEqual(6 + 47, (int) $pied['n']);
    $ids = self::dbQueryOne("SELECT MAX(acces_id) AS m FROM acces_falaise WHERE type = 'pied' AND acces_id > 581");
    $this->assertNotNull($ids['m'], 'les accès piétons repris reçoivent un id au-delà du max historique');
  }

  public function testItinerairesAPiedUniquementDeviennentPiedEtPublics(): void
  {
    $liste = implode(',', self::ID_PIED_VENUS_DE_VELO);
    $rows = self::dbQuery("SELECT acces_id, type, public, km, dplus, description FROM acces_falaise WHERE acces_id IN ($liste)");
    $this->assertCount(6, $rows);
    foreach ($rows as $r) {
      $this->assertSame('pied', $r['type']);
      $this->assertSame('1', $r['public'], 'la valeur d\'origine (1) est restaurée, plus de -1');
      $this->assertNotNull($r['km'], 'km conservé sur un accès pied');
      $this->assertStringNotContainsString('à pied uniquement', $r['description'], 'phrase standard retirée');
    }
    $hostiaz = self::dbQueryOne("SELECT km, dplus FROM acces_falaise WHERE acces_id = 19");
    $this->assertEquals(3.3, (float) $hostiaz['km']);
    $this->assertSame('450', $hostiaz['dplus']);
  }

  public function testConflitArretFalaiseLaVersionVeloPrime(): void
  {
    // Les 6 couples « à pied uniquement » existaient aussi dans acces_pieton_falaise
    // (copie de la migration 4) : une seule ligne pied par couple, celle venue de velo.
    $liste = implode(',', self::ID_PIED_VENUS_DE_VELO);
    $doublons = self::dbQueryOne(
      "SELECT COUNT(*) AS n FROM acces_falaise a
       JOIN acces_falaise b ON b.arret_id = a.arret_id AND b.falaise_id = a.falaise_id AND b.type = 'pied' AND b.acces_id <> a.acces_id
       WHERE a.acces_id IN ($liste)"
    );
    $this->assertSame('0', $doublons['n']);
  }

  public function testContributeurDecoupeEnNomEtMail(): void
  {
    $r = self::dbQueryOne("SELECT contrib, contrib_mail FROM acces_falaise WHERE acces_id = 19");
    $this->assertSame('Florent', $r['contrib']);
    $this->assertSame('contact@velogrimpe.fr', $r['contrib_mail']);
    $quotes = self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE contrib LIKE '''%' OR contrib_mail LIKE '''%' OR contrib LIKE '%,%'");
    $this->assertSame('0', $quotes['n'], 'plus aucune apostrophe/virgule résiduelle du format \'nom\',\'mail\'');
  }

  public function testSlugsDesAccesPietonsRenseignes(): void
  {
    $vides = self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE depart_slug = '' OR arrivee_slug = ''");
    $this->assertSame('0', $vides['n']);
    $incoh = self::dbQueryOne(
      "SELECT COUNT(*) AS n FROM acces_falaise x
       JOIN arrets a ON a.id = x.arret_id JOIN falaises f ON f.falaise_id = x.falaise_id
       WHERE x.type = 'pied' AND x.acces_id > 581 AND (x.depart_slug <> a.slug OR x.arrivee_slug <> f.falaise_nomformate)"
    );
    $this->assertSame('0', $incoh['n'], 'slugs des accès piétons = slug de l\'arrêt / nom formaté de la falaise');
  }

  public function testLeDoublonDeVarianteDuJeuDeDevEstCorrige(): void
  {
    // (arrêt 990, falaise 294) avait deux lignes « Accès par le Sud » dont l'une
    // avait en réalité le slug « acces-par-le-nord » : corrigé pour l'unicité.
    $r = self::dbQuery("SELECT acces_id, variante, variante_formate FROM acces_falaise WHERE arret_id = 990 AND falaise_id = 294 ORDER BY acces_id");
    $this->assertCount(2, $r);
    $this->assertSame('Accès par le Sud', $r[0]['variante']);
    $this->assertSame('Accès par le Nord', $r[1]['variante']);
  }

  /** Migration 7 (Lot 9) : les anciennes tables bus / accès piéton sont supprimées. */
  public function testLesAnciennesTablesBusSontSupprimees(): void
  {
    foreach (['bus_liaisons', 'bus_lignes', 'bus_arrets_falaise', 'bus_arrets', 'acces_pieton_falaise', 'gares'] as $t) {
      $n = self::dbQueryOne("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$t'");
      $this->assertSame('0', $n['n'], "`$t` doit être supprimée");
    }
  }
}
