<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Lot 8ter : falaise.php liste les accès à pied depuis un arrêt
 * (`acces_pieton_falaise`) avec leurs caractéristiques. Données embarquées :
 * `const accesPietons = [...]`, une entrée par accès, avec
 *   arret_id, nom, commune, types[], type_dominant, lat, lng, description,
 *   lignes[{id, nom, couleur}].
 * Rendu HTML : section `#acces-pietons`, un `<article data-arret-id>` par
 * accès, SANS fusion avec les itinéraires vélo (un arrêt qui a aussi un
 * itinéraire vélo vers la falaise garde son accès piéton). La mention « aussi
 * accessible à pied » des itinéraires vélo (`velo_apiedpossible`) est inchangée.
 * Un arrêt supprimé n'est jamais listé.
 */
final class FalaiseAccesPietonsTest extends ApiTestCase
{
  private function lier(int $arretId, int $falaiseId, ?string $description = null): void
  {
    $d = $description === null ? 'NULL' : "'" . self::escape($description) . "'";
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, description, contrib, contrib_mail)
      VALUES ($arretId, $falaiseId, $d, 'phpunit', 'phpunit@example.org')");
  }

  private function velo(int $arretId, int $falaiseId, int $public = 1): void
  {
    $id = self::dbInsert(
      "INSERT INTO velo (arret_id, falaise_id, velo_depart, velo_arrivee, velo_km, velo_dplus, velo_dmoins, velo_descr,
        velo_variante, velo_varianteformate, velo_public, velo_contrib)
       VALUES ($arretId, $falaiseId, 'a', 'b', 5, 40, 40, '', '', '', $public, 'phpunit')"
    );
    $this->cleanupOnTearDown("DELETE FROM velo WHERE velo_id = $id");
  }

  /** @return array<int, array<string, mixed>> accès indexés par arret_id */
  private function acces(int $falaiseId): array
  {
    $res = $this->httpGet("/falaise.php?falaise_id=$falaiseId");
    $this->assertSame(200, $res['status']);
    $liste = self::extractJsValue($res['raw'], 'const accesPietons = ');
    $parArret = [];
    foreach ($liste as $a) {
      $parArret[(int) $a['arret_id']] = $a;
    }
    return $parArret;
  }

  public function testAccesDepuisUneGareEstListeAvecSesCaracteristiques(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Gare Piéton', 45.11, 5.12, ['ter']);
    self::dbExec("UPDATE arrets SET commune = 'Testville' WHERE id = $arretId");
    $this->lier($arretId, $falaiseId, 'Sentier balisé, 20 min.');

    $acces = $this->acces($falaiseId);

    $this->assertArrayHasKey($arretId, $acces);
    $a = $acces[$arretId];
    $this->assertSame('PHPUnit Gare Piéton', $a['nom']);
    $this->assertSame('Testville', $a['commune']);
    $this->assertSame(['ter'], $a['types']);
    $this->assertSame('ter', $a['type_dominant']);
    $this->assertEqualsWithDelta(45.11, $a['lat'], 0.0001);
    $this->assertEqualsWithDelta(5.12, $a['lng'], 0.0001);
    $this->assertSame('Sentier balisé, 20 min.', $a['description']);
    $this->assertSame([], $a['lignes']);
  }

  public function testAccesDepuisUnArretNonBusEstListe(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $tram = $this->createFixtureArret('PHPUnit Tram Piéton', 45.12, 5.13, ['tram']);
    $teleph = $this->createFixtureArret('PHPUnit Téléphérique Piéton', 45.13, 5.14, ['teleph']);
    $this->lier($tram, $falaiseId);
    $this->lier($teleph, $falaiseId);

    $acces = $this->acces($falaiseId);

    $this->assertSame('tram', $acces[$tram]['type_dominant']);
    $this->assertSame('telepherique', $acces[$teleph]['type_dominant']);
  }

  public function testLignesDeLArretSontExposees(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Car Lignes', 45.14, 5.15, ['bus']);
    $ligneId = self::dbInsert("INSERT INTO lignes_transport (nom, couleur, contrib, contrib_mail) VALUES ('PHPUnit L42', '#3366cc', 'phpunit', 'phpunit@example.org')");
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $ligneId");
    self::dbExec("INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES ($ligneId, $arretId)");
    $this->lier($arretId, $falaiseId);

    $acces = $this->acces($falaiseId);

    $this->assertCount(1, $acces[$arretId]['lignes']);
    $this->assertSame($ligneId, (int) $acces[$arretId]['lignes'][0]['id']);
    $this->assertSame('PHPUnit L42', $acces[$arretId]['lignes'][0]['nom']);
    $this->assertSame('#3366cc', $acces[$arretId]['lignes'][0]['couleur']);
  }

  public function testArretSupprimeNEstPasListe(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $arretId = $this->createFixtureArret('PHPUnit Arrêt supprimé piéton');
    $this->lier($arretId, $falaiseId);
    self::dbExec("UPDATE arrets SET deleted = 1 WHERE id = $arretId");

    $this->assertArrayNotHasKey($arretId, $this->acces($falaiseId));
  }

  public function testUneSectionParAccesMemeQuandLArretAUnItineraireVelo(): void
  {
    $falaiseId = $this->createFixtureFalaise();
    $pied = $this->createFixtureArret('PHPUnit Arrêt pied seul', 45.17, 5.18, ['bus']);
    $mixte = $this->createFixtureArret('PHPUnit Gare mixte', 45.18, 5.19, ['ter']);
    $this->lier($pied, $falaiseId, 'Description pied seul');
    $this->lier($mixte, $falaiseId, 'Description mixte');
    $this->velo($mixte, $falaiseId, 1);

    $raw = $this->httpGet("/falaise.php?falaise_id=$falaiseId")['raw'];

    $this->assertStringContainsString('id="acces-pietons"', $raw);
    $this->assertStringContainsString("data-arret-id=\"$pied\"", $raw);
    $this->assertStringContainsString('Description pied seul', $raw);
    $this->assertStringContainsString("data-arret-id=\"$mixte\"", $raw, "pas de fusion : l'accès piéton de l'arrêt qui a aussi un itinéraire vélo est listé");
    $this->assertStringContainsString('Description mixte', $raw);
  }

  public function testSansAccesPietonPasDeSection(): void
  {
    $falaiseId = $this->createFixtureFalaise();

    $raw = $this->httpGet("/falaise.php?falaise_id=$falaiseId")['raw'];

    $this->assertStringNotContainsString('id="acces-pietons"', $raw);
    $this->assertSame([], self::extractJsValue($raw, 'const accesPietons = '));
  }

  public function testWitnessNiolonAccesPietonSeulDepuisLaGare(): void
  {
    // Donnée réelle migrée au Lot 8 : Niolon (gare 2273) → falaise 260.
    $acces = $this->acces(260);

    $this->assertArrayHasKey(2273, $acces);
    $this->assertSame('ter', $acces[2273]['type_dominant']);
  }
}
