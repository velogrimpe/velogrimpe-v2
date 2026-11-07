<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * Non-régression sur `window.__TABLEAU_DATA__` (tableau.php:252-255) : les
 * variantes groupées par falaise doivent rester cohérentes (même falaise_id
 * dans un groupe, gare/train/vélo bien renseignés). Utilise la ville témoin
 * ApiTestCase::WITNESS_VILLE_ID (Lyon), déjà utilisée par tests/e2e.
 */
final class TableauPageDataTest extends ApiTestCase
{
  public function testFalaisesGroupeesParVarianteSontCoherentes(): void
  {
    $res = $this->httpGet('/tableau.php?ville_id=' . self::WITNESS_VILLE_ID);
    $this->assertSame(200, $res['status']);

    // `window.__TABLEAU_DATA__ = { falaises: [...], villeId: N };` est un objet
    // JS (clés non quotées), pas du JSON strict : on extrait chaque champ
    // séparément plutôt que de parser l'objet englobant. On repart de la
    // position du marqueur englobant pour éviter de matcher un "falaises: "
    // fortuit ailleurs dans la page (texte libre, etc.).
    $blockPos = strpos($res['raw'], 'window.__TABLEAU_DATA__ = ');
    $this->assertNotFalse($blockPos, 'window.__TABLEAU_DATA__ introuvable dans la réponse');

    $tail = substr($res['raw'], $blockPos);
    $this->assertMatchesRegularExpression('/villeId:\s*(\d+)/', $tail);
    preg_match('/villeId:\s*(\d+)/', $tail, $m);
    $this->assertSame(self::WITNESS_VILLE_ID, (int) $m[1]);

    $falaises = self::extractJsValue($res['raw'], 'falaises: ', $blockPos);
    $this->assertNotEmpty($falaises, 'aucune falaise accessible depuis la ville témoin — la BDD locale a-t-elle changé ?');

    foreach ($falaises as $group) {
      $this->assertNotEmpty($group, 'un groupe de variantes ne devrait jamais être vide');
      $falaiseIds = array_unique(array_column($group, 'falaise_id'));
      $this->assertCount(1, $falaiseIds, 'toutes les variantes d\'un groupe doivent référencer la même falaise');

      foreach ($group as $row) {
        $this->assertNotEmpty($row['gare_nom'], "gare_nom manquant pour la falaise #{$row['falaise_id']}");
        $this->assertNotEmpty($row['train_arrivee'], "train_arrivee manquant pour la falaise #{$row['falaise_id']}");
        $this->assertArrayHasKey('velo_km', $row);
        $this->assertArrayNotHasKey('velo_apieduniquement', $row, "le champ « à pied uniquement » est retiré (Lot 8) : ces accès sont dans acces_pieton_falaise");
        $this->assertArrayHasKey('falaise_acces_pieton', $row);
        // Champ jamais construit par calculate_time() sans les deux composantes.
        $this->assertArrayHasKey('temps_total', $row);
        if ((int) $row['acces_pieton'] === 1) {
          $this->assertNull($row['temps_total'], "temps_total vide pour un accès piéton (falaise #{$row['falaise_id']})");
        } else {
          $this->assertIsNumeric($row['temps_total'], "temps_total non numérique pour la falaise #{$row['falaise_id']}");
        }
      }
    }
  }

  // --- Lot 8 : accès piéton depuis un arrêt relié à la ville --------------------

  /** Falaise + arrêt ter relié à Lyon par un train publié, retourne [falaiseId, arretId, nom d'arrêt]. */
  private function falaiseEtArretRelies(): array
  {
    $falaiseId = $this->createFixtureFalaise('PHPUnit Tableau Piéton');
    self::dbExec("UPDATE falaises SET falaise_maa = 12, falaise_mar = 12, falaise_fermee = '' WHERE falaise_id = $falaiseId");
    $nom = 'PHPUnit Gare Tableau';
    $arretId = $this->createFixtureArret($nom, 45.5, 5.5, ['ter']);
    $villeId = self::WITNESS_VILLE_ID;
    $trainId = self::dbInsert(
      "INSERT INTO train (ville_id, arret_id, train_depart, train_arrivee, train_temps, train_correspmin, train_correspmax,
        train_descr, train_public, train_contrib, train_tgv)
       VALUES ($villeId, $arretId, 'lyon-part-dieu', 'phpunit-gare-tableau', 60, 0, 0, '', 1, 'phpunit', 0)"
    );
    $this->cleanupOnTearDown("DELETE FROM train WHERE train_id = $trainId");
    return [$falaiseId, $arretId, $nom];
  }

  private function groupeDeLaFalaise(int $falaiseId): ?array
  {
    $res = $this->httpGet('/tableau.php?ville_id=' . self::WITNESS_VILLE_ID);
    $this->assertSame(200, $res['status']);
    $blockPos = strpos($res['raw'], 'window.__TABLEAU_DATA__ = ');
    $falaises = self::extractJsValue($res['raw'], 'falaises: ', $blockPos);
    foreach ($falaises as $group) {
      if ((int) $group[0]['falaise_id'] === $falaiseId) {
        return $group;
      }
    }
    return null;
  }

  public function testFalaiseAccessibleAPiedDepuisUnArretRelieALaVilleEstListee(): void
  {
    [$falaiseId, $arretId, $nom] = $this->falaiseEtArretRelies();
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail) VALUES ($arretId, $falaiseId, 'phpunit', 'phpunit@example.org')");

    $group = $this->groupeDeLaFalaise($falaiseId);

    $this->assertNotNull($group, "la falaise à accès piéton depuis un arrêt relié à Lyon doit figurer au tableau");
    $this->assertCount(1, $group);
    $row = $group[0];
    $this->assertSame($nom, $row['gare_nom']);
    $this->assertSame(1, (int) $row['acces_pieton']);
    $this->assertSame(1, (int) $row['falaise_acces_pieton']);
    $this->assertSame(0, (int) $row['velo_km']);
    $this->assertNull($row['temps_total'], 'temps total laissé vide : le temps de marche arrêt → falaise est inconnu');
    $this->assertSame(['ter'], $row['acces_pieton_types']);
    $this->assertSame([], $row['acces_pieton_lignes']);
  }

  public function testAccesPietonExposeLesLignesDeLArret(): void
  {
    [$falaiseId, $arretId] = $this->falaiseEtArretRelies();
    self::dbExec("UPDATE arrets SET bus = 1 WHERE id = $arretId");
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail) VALUES ($arretId, $falaiseId, 'phpunit', 'phpunit@example.org')");
    $ligneId = self::dbInsert("INSERT INTO lignes_transport (nom, numero, contrib, contrib_mail) VALUES ('PHPUnit Ligne Tableau', 'L77', 'phpunit', 'phpunit@example.org')");
    $this->cleanupOnTearDown("DELETE FROM lignes_transport WHERE id = $ligneId");
    self::dbExec("INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES ($ligneId, $arretId)");

    $row = $this->groupeDeLaFalaise($falaiseId)[0];

    $this->assertEqualsCanonicalizing(['ter', 'bus'], $row['acces_pieton_types']);
    $this->assertSame(['PHPUnit Ligne Tableau'], $row['acces_pieton_lignes'], 'noms des lignes desservantes (lignes_transport)');
  }

  public function testAccesPietonDepuisUnArretNonRelieALaVilleNEstPasListe(): void
  {
    [$falaiseId] = $this->falaiseEtArretRelies();
    $autre = $this->createFixtureArret('PHPUnit Arrêt non relié', 45.6, 5.6, ['bus']);
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail) VALUES ($autre, $falaiseId, 'phpunit', 'phpunit@example.org')");

    $this->assertNull($this->groupeDeLaFalaise($falaiseId));
  }

  public function testUnItineraireVeloDepuisLeMemeArretEtLAccesPietonSontDeuxLignes(): void
  {
    [$falaiseId, $arretId] = $this->falaiseEtArretRelies();
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail) VALUES ($arretId, $falaiseId, 'phpunit', 'phpunit@example.org')");
    $veloId = self::dbInsert(
      "INSERT INTO velo (arret_id, falaise_id, velo_depart, velo_arrivee, velo_km, velo_dplus, velo_dmoins, velo_descr,
        velo_variante, velo_varianteformate, velo_apieduniquement, velo_public, velo_contrib)
       VALUES ($arretId, $falaiseId, 'a', 'b', 10, 100, 100, '', '', '', 0, 1, 'phpunit')"
    );
    $this->cleanupOnTearDown("DELETE FROM velo WHERE velo_id = $veloId");

    $group = $this->groupeDeLaFalaise($falaiseId);

    $this->assertNotNull($group);
    $this->assertCount(2, $group, "l'accès piéton est montré en plus de l'itinéraire vélo du même arrêt");
    $this->assertSame(0, (int) $group[0]['acces_pieton'], "l'itinéraire vélo passe d'abord");
    $this->assertSame(10.0, (float) $group[0]['velo_km']);
    $this->assertNotNull($group[0]['temps_total']);
    $this->assertSame(1, (int) $group[1]['acces_pieton']);
    $this->assertNull($group[1]['temps_total']);
    $this->assertSame(0, (int) $group[0]['variante'], "la ligne piéton ne compte pas comme variante vélo");
    $this->assertSame(1, (int) $group[0]['falaise_acces_pieton'], 'le drapeau de filtre reste vrai');
  }

  public function testItineraireVeloMasqueNEstPasListe(): void
  {
    [$falaiseId, $arretId] = $this->falaiseEtArretRelies();
    $veloId = self::dbInsert(
      "INSERT INTO velo (arret_id, falaise_id, velo_depart, velo_arrivee, velo_km, velo_dplus, velo_dmoins, velo_descr,
        velo_variante, velo_varianteformate, velo_apieduniquement, velo_public, velo_contrib)
       VALUES ($arretId, $falaiseId, 'a', 'b', 10, 100, 100, '', '', '', 0, -1, 'phpunit')"
    );
    $this->cleanupOnTearDown("DELETE FROM velo WHERE velo_id = $veloId");

    $this->assertNull($this->groupeDeLaFalaise($falaiseId));
  }

  public function testLesFalaisesSansTempsTotalSontListeesEnDernier(): void
  {
    [$falaiseId] = $this->falaiseEtArretRelies();
    $arretId = (int) self::dbQueryOne("SELECT arret_id FROM train WHERE train_arrivee = 'phpunit-gare-tableau'")['arret_id'];
    self::dbExec("INSERT INTO acces_pieton_falaise (arret_id, falaise_id, contrib, contrib_mail) VALUES ($arretId, $falaiseId, 'phpunit', 'phpunit@example.org')");

    $res = $this->httpGet('/tableau.php?ville_id=' . self::WITNESS_VILLE_ID);
    $blockPos = strpos($res['raw'], 'window.__TABLEAU_DATA__ = ');
    $groupes = self::extractJsValue($res['raw'], 'falaises: ', $blockPos);

    $vuSansTotal = false;
    foreach ($groupes as $g) {
      $sansTotal = $g[0]['temps_total'] === null;
      $this->assertFalse($vuSansTotal && !$sansTotal, 'un groupe chronométré apparaît après un groupe sans temps total');
      $vuSansTotal = $vuSansTotal || $sansTotal;
    }
    $this->assertTrue($vuSansTotal, 'le groupe piéton de test doit figurer au tableau');
  }
}
