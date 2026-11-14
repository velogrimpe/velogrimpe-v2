<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot P1 (docs/plan-arrets-parents.md) : `arrets.parent_id` (parent → enfants, deux niveaux) et
 * `arrets.position_manuelle`, ajoutés par sql_migrations/2_arrets_parents.sql.
 */
final class ArretsParentsSchemaTest extends ApiTestCase
{
  public function testColonnesParentIdEtPositionManuelle(): void
  {
    $cols = [];
    foreach (self::dbQuery("SHOW COLUMNS FROM arrets") as $c) $cols[$c['Field']] = $c;

    $this->assertArrayHasKey('parent_id', $cols);
    $this->assertSame('YES', $cols['parent_id']['Null']);
    $this->assertNull($cols['parent_id']['Default']);

    $this->assertArrayHasKey('position_manuelle', $cols);
    $this->assertSame('NO', $cols['position_manuelle']['Null']);
    $this->assertSame('0', $cols['position_manuelle']['Default']);
  }

  public function testArretsExistantsSontOrphelinsEtSansPositionManuelle(): void
  {
    $a = $this->createFixtureArret('PHPUnit Schéma orphelin');
    $row = self::dbQueryOne("SELECT parent_id, position_manuelle FROM arrets WHERE id = $a");
    $this->assertNull($row['parent_id']);
    $this->assertSame('0', $row['position_manuelle']);
  }

  public function testParentIdPointeVersUnArretExistant(): void
  {
    $parent = $this->createFixtureArret('PHPUnit Schéma parent');
    $enfant = $this->createFixtureArret('PHPUnit Schéma enfant');
    self::dbExec("UPDATE arrets SET parent_id = $parent WHERE id = $enfant");
    $this->assertSame((string) $parent, self::dbQueryOne("SELECT parent_id FROM arrets WHERE id = $enfant")['parent_id']);

    $this->expectException(\RuntimeException::class); // FK : parent inexistant
    self::dbExec("UPDATE arrets SET parent_id = 999999999 WHERE id = $enfant");
  }

  public function testUnParentNePeutPasEtreSupprimeTantQueDesEnfantsLeReferencent(): void
  {
    $parent = $this->createFixtureArret('PHPUnit Schéma parent FK');
    $enfant = $this->createFixtureArret('PHPUnit Schéma enfant FK');
    self::dbExec("UPDATE arrets SET parent_id = $parent WHERE id = $enfant");
    // tearDown supprime dans l'ordre inverse de création : l'enfant d'abord, le parent ensuite.
    $this->expectException(\RuntimeException::class);
    self::dbExec("DELETE FROM arrets WHERE id = $parent");
  }
}
