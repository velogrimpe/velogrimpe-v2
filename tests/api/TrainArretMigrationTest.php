<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8bis : l'étape 2 de sql_migrations/1_unification_arrets.sql renomme `train.gare_id` en
 * `train.arret_id` (int(11), comme `arrets.id`) et pose une FK vers `arrets.id`,
 * sur le modèle de `velo`. Migration ponctuelle non rejouable :
 * on vérifie l'état du schéma et des données, pas le script.
 */
final class TrainArretMigrationTest extends ApiTestCase
{
  public function testColonneRenommeeEtElargie(): void
  {
    $cols = array_column(
      self::dbQuery("SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'train'"),
      'COLUMN_TYPE',
      'COLUMN_NAME'
    );
    $this->assertArrayNotHasKey('gare_id', $cols, 'train.gare_id doit être renommée');
    $this->assertArrayHasKey('arret_id', $cols);
    $this->assertStringStartsWith('int(11)', $cols['arret_id'], 'même type que arrets.id (prérequis de la FK)');
  }

  public function testCleEtrangereVersArrets(): void
  {
    $fk = self::dbQueryOne(
      "SELECT REFERENCED_TABLE_NAME AS t, REFERENCED_COLUMN_NAME AS c FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'train' AND COLUMN_NAME = 'arret_id' AND REFERENCED_TABLE_NAME IS NOT NULL"
    );
    $this->assertNotNull($fk, 'train.arret_id doit porter une FK');
    $this->assertSame('arrets', $fk['t']);
    $this->assertSame('id', $fk['c']);
  }

  public function testAucunTrainOrphelinEtAucuneDonneePerdue(): void
  {
    $orphelins = self::dbQueryOne('SELECT COUNT(*) AS n FROM train t LEFT JOIN arrets a ON a.id = t.arret_id WHERE a.id IS NULL');
    $this->assertSame('0', $orphelins['n']);
    $n = self::dbQueryOne('SELECT COUNT(*) AS n FROM train');
    $this->assertGreaterThanOrEqual(211, (int) $n['n'], 'les 211 itinéraires train de la base de dev doivent être conservés');
  }

  public function testLaFkRefuseUnArretInexistant(): void
  {
    $this->expectException(\RuntimeException::class);
    self::dbExec(
      "INSERT INTO train (ville_id, arret_id, train_depart, train_arrivee, train_descr, train_public, train_contrib)
       VALUES (" . self::WITNESS_VILLE_ID . ", 99999999, 'x', 'y', '', 1, 'phpunit')"
    );
  }
}
