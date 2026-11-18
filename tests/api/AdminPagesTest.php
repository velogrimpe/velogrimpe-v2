<?php

require_once __DIR__ . '/ApiTestCase.php';

use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Non-régression sur les pages /admin/ (volet latéral et listes de données).
 *
 * Pas de rendu : on vérifie que chaque page répond, qu'elle embarque le volet
 * de navigation (avec l'entrée courante marquée), et que les listes (#page-data)
 * portent autant de lignes que la base — donc qu'aucune jointure ne perd ni
 * ne duplique de ligne — avec des références valides vers les entités liées
 * (de quoi construire les liens « voir la falaise » / « modifier »).
 */
final class AdminPagesTest extends ApiTestCase
{
  private const NAV_LABELS = [
    'Tableau de bord', 'Falaises', 'Accès falaises', 'Transports en commun', '(Train)', '(Villes)',
    'Newsletters', 'Pages CMS', 'QR et liens trackés', 'Historique des modifications', 'Liens Oblyk', '(Récap train)', 'Actions',
  ];

  /** @return array<string, array{0:string, 1:string}> page => [chemin, libellé de l'entrée active] */
  public static function pagesProvider(): array
  {
    return [
      'dashboard' => ['/admin/', 'Tableau de bord'],
      'falaises' => ['/admin/falaises.php', 'Falaises'],
      'acces' => ['/admin/acces.php', 'Accès falaises'],
      'transports' => ['/admin/arrets_lignes.php', 'Transports en commun'],
      'trains' => ['/admin/trains.php', '(Train)'],
      'villes' => ['/admin/villes.php', '(Villes)'],
      'newsletters' => ['/admin/newsletter.php', 'Newsletters'],
      'pages' => ['/admin/pages.php', 'Pages CMS'],
      'logs' => ['/admin/edit_logs.php', 'Historique des modifications'],
      'actions' => ['/admin/actions.php', 'Actions'],
    ];
  }

  #[DataProvider('pagesProvider')]
  public function testPageAdminEmbarqueLeVoletAvecSonEntreeActive(string $path, string $active): void
  {
    $res = $this->httpGetAdmin($path);
    $this->assertSame(200, $res['status']);
    $this->assertStringNotContainsString('Fatal error', $res['raw']);

    // Le volet latéral (écran large) : toutes les entrées, dans l'ordre de la maquette.
    $this->assertSame(1, preg_match('#<aside class="vg-admin-sidebar.*?</aside>#s', $res['raw'], $m), 'volet absent');
    $labels = array_map(fn($l) => trim(html_entity_decode(strip_tags($l))), preg_split('#</li>#', $m[0], -1, PREG_SPLIT_NO_EMPTY));
    $labels = array_values(array_filter($labels, fn($l) => $l !== '' && !str_starts_with($l, '<')));
    foreach (self::NAV_LABELS as $label) {
      $this->assertContains($label, $labels, "entrée « $label » absente du volet");
    }
    $this->assertSame(1, preg_match_all('#class="menu-active"#', $m[0]), 'une seule entrée active attendue');
    $this->assertMatchesRegularExpression('#class="menu-active" aria-current="page" href="[^"]+">' . preg_quote(htmlspecialchars($active, ENT_QUOTES), '#') . '</a>#', $m[0]);

    // Mobile : le même menu est intégré au tiroir du site (qui garde la navigation du site, repliée).
    $drawer = substr($res['raw'], strpos($res['raw'], 'drawer-side'));
    $this->assertStringContainsString('Navigation du site', $drawer);
    $this->assertStringContainsString('Historique des modifications', $drawer);
  }

  public function testPagePubliqueSansVoletAdmin(): void
  {
    $res = $this->httpGet('/infos.php');
    $this->assertSame(200, $res['status']);
    $this->assertStringNotContainsString('vg-admin-sidebar', $res['raw']);
    $this->assertStringNotContainsString('Navigation du site', $res['raw']);
  }

  /** @return array<int, array<string, mixed>> */
  private function pageRows(string $path, string $kind): array
  {
    $res = $this->httpGetAdmin($path);
    $this->assertSame(200, $res['status']);
    $this->assertSame(1, preg_match('#<script type="application/json" id="page-data">(.*?)</script>#s', $res['raw'], $m));
    $data = json_decode($m[1], true);
    $this->assertSame($kind, $data['kind']);
    return $data['rows'];
  }

  public function testListeFalaisesCouvreToutesLesFalaises(): void
  {
    $rows = $this->pageRows('/admin/falaises.php', 'falaises');
    $this->assertCount((int) self::dbQueryOne('SELECT COUNT(*) AS n FROM falaises')['n'], $rows);
    $this->assertCount(count($rows), array_unique(array_column($rows, 'id')), 'une falaise ne doit apparaître qu\'une fois');
    $aVerifier = (int) self::dbQueryOne('SELECT COUNT(*) AS n FROM falaises WHERE falaise_public = 2')['n'];
    $this->assertSame($aVerifier, count(array_filter($rows, fn($r) => $r['public'] === 2)), 'filtre « à vérifier »');
    $horsTopo = (int) self::dbQueryOne('SELECT COUNT(*) AS n FROM falaises WHERE falaise_public = 3')['n'];
    $this->assertSame($horsTopo, count(array_filter($rows, fn($r) => $r['public'] === 3)), 'filtre « hors topo »');
    $this->assertArrayHasKey('mtime', $rows[0], 'filtre « détails » : date du GeoJSON de barres');
  }

  public function testListeAccesCouvreTousLesTypesEtReferenceDesEntitesExistantes(): void
  {
    $rows = $this->pageRows('/admin/acces.php', 'acces');
    $this->assertCount((int) self::dbQueryOne('SELECT COUNT(*) AS n FROM acces_falaise')['n'], $rows);
    $this->assertSame(
      (int) self::dbQueryOne("SELECT COUNT(*) AS n FROM acces_falaise WHERE public = 2")['n'],
      count(array_filter($rows, fn($r) => $r['public'] === 2)),
      'filtre « à vérifier »'
    );
    $types = array_unique(array_column($rows, 'type'));
    $this->assertEqualsCanonicalizing(
      array_column(self::dbQuery('SELECT DISTINCT type FROM acces_falaise'), 'type'),
      $types,
      'vélo et à pied doivent tous deux figurer'
    );
    foreach ($rows as $r) {
      $this->assertNotSame('', $r['falaise'], "accès #{$r['id']} sans falaise liée");
      $this->assertNotSame('', $r['arret'], "accès #{$r['id']} sans arrêt lié");
    }
  }

  public function testListeTrainsEtVilles(): void
  {
    $trains = $this->pageRows('/admin/trains.php', 'trains');
    $this->assertCount((int) self::dbQueryOne('SELECT COUNT(*) AS n FROM train')['n'], $trains);
    foreach ($trains as $t) {
      $this->assertNotSame('', $t['ville'], "train #{$t['id']} sans ville");
      $this->assertNotSame('', $t['arret'], "train #{$t['id']} sans arrêt");
    }
    $villes = $this->pageRows('/admin/villes.php', 'villes');
    $this->assertCount((int) self::dbQueryOne('SELECT COUNT(*) AS n FROM villes')['n'], $villes);
    $this->assertSame(count($trains), array_sum(array_column($villes, 'nb_trains')), 'chaque trajet est compté dans exactement une ville');
  }
}
