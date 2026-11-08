<?php

use PHPUnit\Framework\TestCase;

/**
 * Base des tests d'intégration API : requêtes HTTP réelles contre le conteneur
 * Docker `velogrimpe` (cf. CLAUDE.md) + accès DB via `docker exec ... mysql`
 * (le port MySQL du conteneur n'est pas exposé à l'hôte, seuls 80 et 22 le sont).
 *
 * Convention fixtures : toute ligne créée par un test porte contrib = 'phpunit'
 * (ou un nom préfixé 'PHPUnit ') pour rester identifiable et non polluer le jeu
 * de données de dev. Chaque test nettoie ses propres fixtures dans tearDown().
 */
abstract class ApiTestCase extends TestCase
{
  /**
   * Entités connues du jeu de données de dev (`db_backup.sql`), utilisées
   * comme témoins par les tests de non-régression (falaise.php, tableau.php,
   * carte.php) plutôt que des fixtures synthétiques — cf. tests/e2e qui
   * utilisent déjà ces mêmes ids ("Pont de Barret", ville de Lyon).
   * Si `db_backup.sql` est régénéré et que ces ids changent, ces constantes
   * sont le seul endroit à mettre à jour.
   */
  const WITNESS_FALAISE_ID = 39; // "Pont de Barret - Eson"
  const WITNESS_GARE_ID = 22; // "Crest", reliée à la falaise témoin ci-dessus
  const WITNESS_VILLE_ID = 6; // Lyon

  /**
   * Falaises témoins supplémentaires pour FalaisePageDataTest, chacune
   * couvrant une configuration d'accès particulière non exercée par
   * WITNESS_FALAISE_ID (accès piéton + vélo depuis la même gare, accès vélo
   * faisable à pied, accès vélo depuis plusieurs gares).
   */
  const WITNESS_FALAISE_HOSTIAZ_ID = 25; // "Hostiaz - La guinguette" : accès piéton uniquement (acces_id 19) + accès vélo (acces_id 18), tous deux depuis la gare 12 (Tenay-Hauteville)
  const WITNESS_FALAISE_VIRIEU_ID = 26; // "Virieu le Grand" : accès vélo (acces_id 20) faisable aussi à pied (≤ 5 km)
  const WITNESS_FALAISE_CONTREVOZ_ID = 27; // "Essieu - Contrevoz" : deux accès vélo depuis 2 gares différentes (acces_id 21 → gare 7 Virieu-le-Grand-Belley, acces_id 73 → gare 6 Culoz)

  /** @var string[] Requêtes SQL de nettoyage, exécutées en ordre inverse dans tearDown(). */
  private array $cleanupSql = [];

  /** @var callable[] Nettoyages non-SQL (fichiers...), exécutés avant le nettoyage SQL dans tearDown(). */
  private array $cleanupCallbacks = [];

  /**
   * @var int[] Ids d'arrêts de test (fixtures ou créés via l'API), dans
   * l'espace d'ids `arrets` (Lot 2). bus_liaisons référence `arrets` sans
   * ON DELETE CASCADE (cf. migration 2) : on purge toutes leurs liaisons en
   * un seul bloc avant les DELETE individuels, pour rester indifférent à
   * l'ordre d'enregistrement des nettoyages entre plusieurs arrêts liés entre eux.
   */
  private array $fixtureArretIds = [];

  protected function tearDown(): void
  {
    foreach (array_reverse($this->cleanupCallbacks) as $fn) {
      try {
        $fn();
      } catch (\Throwable $e) {
        fwrite(STDERR, "[tearDown] callback cleanup failed: {$e->getMessage()}\n");
      }
    }
    $this->cleanupCallbacks = [];
    if (!empty($this->fixtureArretIds)) {
      $ids = implode(',', array_map('intval', $this->fixtureArretIds));
      try {
        self::dbExec("DELETE FROM bus_liaisons WHERE arret_1_id IN ($ids) OR arret_2_id IN ($ids)");
      } catch (\Throwable $e) {
        fwrite(STDERR, "[tearDown] purge liaisons failed: {$e->getMessage()}\n");
      }
    }
    foreach (array_reverse($this->cleanupSql) as $sql) {
      try {
        self::dbExec($sql);
      } catch (\Throwable $e) {
        fwrite(STDERR, "[tearDown] cleanup failed ($sql): {$e->getMessage()}\n");
      }
    }
    $this->cleanupSql = [];
    $this->fixtureArretIds = [];
  }

  protected function cleanupOnTearDown(string $sql): void
  {
    $this->cleanupSql[] = $sql;
  }

  /** Nettoyage non-SQL (ex. suppression d'un fichier GPX écrit par un endpoint testé). */
  protected function cleanupCallbackOnTearDown(callable $fn): void
  {
    $this->cleanupCallbacks[] = $fn;
  }

  /** Enregistre un arrêt (fixture ou créé via l'API) pour purge de ses liaisons + suppression en tearDown(). */
  protected function registerFixtureArret(int $id): void
  {
    $this->fixtureArretIds[] = $id;
    $this->cleanupOnTearDown("DELETE FROM arrets WHERE id = $id");
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE arret_id = $id"); // pas de cascade (Lot 8quater)
  }

  /**
   * Exécute une ou plusieurs requêtes SQL (sans lire de résultat), via le
   * client mysql du conteneur (root, pas de mot de passe — cf. db_init.sql).
   */
  protected static function dbExec(string $sql): void
  {
    self::runMysql($sql);
  }

  /**
   * Exécute une requête SELECT et retourne les lignes sous forme de tableaux
   * associatifs (types PHP natifs non déduits : tout est string, sauf NULL).
   *
   * @return array<int, array<string, ?string>>
   */
  protected static function dbQuery(string $sql): array
  {
    $out = self::runMysql($sql);
    $lines = preg_split('/\r?\n/', rtrim($out, "\n"));
    if (count($lines) < 1 || $lines[0] === '') {
      return [];
    }
    $headers = explode("\t", array_shift($lines));
    $rows = [];
    foreach ($lines as $line) {
      if ($line === '') {
        continue;
      }
      $values = explode("\t", $line);
      $row = [];
      foreach ($headers as $i => $h) {
        $v = $values[$i] ?? null;
        $row[$h] = ($v === 'NULL') ? null : $v;
      }
      $rows[] = $row;
    }
    return $rows;
  }

  /** Exécute une requête SQL et retourne la première ligne (ou null). */
  protected static function dbQueryOne(string $sql): ?array
  {
    $rows = self::dbQuery($sql);
    return $rows[0] ?? null;
  }

  /** Exécute un INSERT et retourne son id auto-incrémenté. */
  protected static function dbInsert(string $sql): int
  {
    $row = self::dbQueryOne($sql . '; SELECT LAST_INSERT_ID() AS id');
    return (int) ($row['id'] ?? 0);
  }

  private static function runMysql(string $sql): string
  {
    $dbName = VG_TEST_CONFIG['db_name'];
    $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $process = proc_open(
      ['docker', 'exec', '-i', VG_TEST_DB_CONTAINER, '/opt/lampp/bin/mysql', '-uroot', '-B', $dbName],
      $descriptors,
      $pipes
    );
    if (!is_resource($process)) {
      throw new \RuntimeException('Impossible de lancer docker exec (conteneur velogrimpe démarré ?)');
    }
    fwrite($pipes[0], $sql);
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($process);
    if ($code !== 0) {
      throw new \RuntimeException("mysql a échoué (code $code) : $err\nSQL: $sql");
    }
    return $out;
  }

  /** @return array{status:int, body:mixed, raw:string} */
  protected function httpGet(string $path): array
  {
    return $this->httpRequest('GET', $path, null);
  }

  /** @return array{status:int, body:mixed, raw:string} */
  protected function httpPostJson(string $path, array $payload, array $extraHeaders = []): array
  {
    return $this->httpRequest('POST', $path, $payload, $extraHeaders);
  }

  /** @return array{status:int, body:mixed, raw:string} */
  private function httpRequest(string $method, string $path, ?array $jsonPayload, array $extraHeaders = []): array
  {
    $ch = curl_init(VG_TEST_BASE_URL . $path);
    $headers = $extraHeaders;
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    if ($jsonPayload !== null) {
      curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($jsonPayload));
      $headers[] = 'Content-Type: application/json';
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $raw = curl_exec($ch);
    if ($raw === false) {
      $err = curl_error($ch);
      curl_close($ch);
      throw new \RuntimeException("Requête HTTP échouée ($method $path) : $err — le conteneur velogrimpe est-il démarré (docker ps) ?");
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $body = json_decode($raw, true);
    return ['status' => $status, 'body' => $body, 'raw' => $raw];
  }

  /**
   * POST multipart/form-data (formulaires historiques type add_velo.php, qui
   * répondent par une redirection plutôt qu'un JSON). Ne suit pas la
   * redirection : `location` porte l'URL cible si le serveur en a émis une.
   *
   * @param array<string, string> $fields
   * @param array<string, string> $files Nom de champ => chemin absolu du fichier à téléverser.
   * @return array{status:int, location:?string, raw:string}
   */
  protected function httpPostMultipart(string $path, array $fields, array $files = []): array
  {
    $payload = $fields;
    foreach ($files as $field => $filePath) {
      $payload[$field] = new \CURLFile($filePath);
    }
    $ch = curl_init(VG_TEST_BASE_URL . $path);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
    $raw = curl_exec($ch);
    if ($raw === false) {
      $err = curl_error($ch);
      curl_close($ch);
      throw new \RuntimeException("Requête HTTP échouée (POST $path) : $err");
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $location = curl_getinfo($ch, CURLINFO_REDIRECT_URL) ?: null;
    curl_close($ch);
    return ['status' => $status, 'location' => $location, 'raw' => $raw];
  }

  /**
   * Extrait et décode un objet/tableau JSON embarqué dans une réponse HTML,
   * juste après un marqueur donné (ex. `'const falaisesBase = '`,
   * `'window.__TABLEAU_DATA__ = '`). Fait un appariement de profondeur des
   * accolades/crochets (en ignorant le contenu des chaînes JSON) plutôt qu'une
   * regex gourmande/paresseuse, pour rester correct même si une valeur de
   * texte contient elle-même des séquences comme "];" ou "};".
   */
  protected static function extractJsValue(string $html, string $marker, int $searchFrom = 0): mixed
  {
    $pos = strpos($html, $marker, $searchFrom);
    if ($pos === false) {
      throw new \RuntimeException("Marqueur introuvable dans la réponse HTML : $marker");
    }
    $start = $pos + strlen($marker);
    $len = strlen($html);
    while ($start < $len && ctype_space($html[$start])) {
      $start++;
    }
    if ($start >= $len || !in_array($html[$start], ['[', '{'], true)) {
      throw new \RuntimeException("Pas de JSON après le marqueur : $marker");
    }
    $openChar = $html[$start];
    $closeChar = $openChar === '[' ? ']' : '}';
    $depth = 0;
    $inString = false;
    $escape = false;
    $end = null;
    for ($i = $start; $i < $len; $i++) {
      $ch = $html[$i];
      if ($inString) {
        if ($escape) {
          $escape = false;
        } elseif ($ch === '\\') {
          $escape = true;
        } elseif ($ch === '"') {
          $inString = false;
        }
        continue;
      }
      if ($ch === '"') {
        $inString = true;
      } elseif ($ch === $openChar) {
        $depth++;
      } elseif ($ch === $closeChar) {
        $depth--;
        if ($depth === 0) {
          $end = $i;
          break;
        }
      }
    }
    if ($end === null) {
      throw new \RuntimeException("JSON non terminé après le marqueur : $marker");
    }
    $json = substr($html, $start, $end - $start + 1);
    $decoded = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
      throw new \RuntimeException("JSON invalide après le marqueur '$marker' : " . json_last_error_msg());
    }
    return $decoded;
  }

  /** Crée une falaise minimale de test (falaise_public = 1) et enregistre son nettoyage. */
  protected function createFixtureFalaise(string $nom = 'PHPUnit Fixture Falaise'): int
  {
    $nomEsc = self::escape($nom);
    $id = self::dbInsert(
      "INSERT INTO falaises (
        falaise_nom, falaise_nomformate, falaise_latlng, falaise_cottxt,
        falaise_exposhort1, falaise_exposhort2, falaise_expotxt, falaise_voies,
        falaise_topo, falaise_matxt, falaise_gvtxt, falaise_gvnb, falaise_rq,
        falaise_voletcarto, falaise_leg1, falaise_txt3, falaise_leg2, falaise_txt4,
        falaise_leg3, falaise_public, falaise_contrib
      ) VALUES (
        '$nomEsc', 'phpunit-fixture', '43.8270,5.3830', '',
        '', '', '', '',
        '', '', '', '', '',
        '', '', '', '', '',
        '', 1, 'phpunit'
      )"
    );
    $this->cleanupOnTearDown("DELETE FROM falaises WHERE falaise_id = $id");
    // acces_falaise n'a pas de ON DELETE CASCADE (Lot 8quater) : les accès créés
    // pendant le test (fixtures ou via l'API) partent avant la falaise.
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE falaise_id = $id");
    return $id;
  }

  /**
   * Crée un arrêt minimal de test (table `arrets`) et enregistre son nettoyage.
   *
   * @param string[] $types Sous-ensemble de ter/tgv/bus/tram/teleph à activer (bus par défaut).
   */
  protected function createFixtureArret(string $nom = 'PHPUnit Fixture Arrêt', float $lat = 43.8270, float $lng = 5.3830, array $types = ['bus']): int
  {
    $nomEsc = self::escape($nom);
    $slugEsc = self::escape(trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($nom)), '-'));
    $columns = ['ter', 'tgv', 'bus', 'tram', 'teleph'];
    $values = array_map(fn($col) => in_array($col, $types, true) ? 1 : 0, $columns);
    $assignments = implode(', ', array_map(fn($col, $val) => "$col = $val", $columns, $values));
    $id = self::dbInsert(
      "INSERT INTO arrets (loc, nom, slug, contrib, contrib_mail)
       VALUES (ST_GeomFromText('POINT($lng $lat)', 4326), '$nomEsc', '$slugEsc', 'phpunit', 'phpunit@example.org')"
    );
    self::dbExec("UPDATE arrets SET $assignments WHERE id = $id");
    $this->registerFixtureArret($id);
    return $id;
  }

  /** Crée une gare minimale de test (sans commune géocodée) et enregistre son nettoyage. */
  protected function createFixtureGare(string $nom, float $lat, float $lng): int
  {
    $nomEsc = self::escape($nom);
    $slugEsc = self::escape(strtolower(str_replace(' ', '-', $nom)));
    $latlng = "$lat,$lng";
    $id = self::dbInsert(
      "INSERT INTO gares (gare_nom, gare_nomformate, gare_latlng, gare_tgv)
       VALUES ('$nomEsc', '$slugEsc', '$latlng', 0)"
    );
    $this->cleanupOnTearDown("DELETE FROM gares WHERE gare_id = $id");
    return $id;
  }

  /**
   * Accès arrêt → falaise (`acces_falaise`, Lot 8quater), supprimé en tearDown.
   * Options : type ('velo'|'pied'), km, dplus, dmoins, description, variante,
   * variante_formate, public, contrib, contrib_mail, depart_slug, arrivee_slug.
   */
  protected function createFixtureAcces(int $arretId, int $falaiseId, array $options = []): int
  {
    $o = $options + [
      'type' => 'velo', 'km' => null, 'dplus' => null, 'dmoins' => null, 'description' => '',
      'variante' => '', 'variante_formate' => '', 'public' => 1,
      'contrib' => 'phpunit', 'contrib_mail' => 'phpunit@example.org',
      'depart_slug' => 'phpunit-depart', 'arrivee_slug' => 'phpunit-arrivee',
    ];
    $num = fn($v) => $v === null ? 'NULL' : (string) (0 + $v);
    $txt = fn($v) => "'" . self::escape((string) $v) . "'";
    $id = self::dbInsert(
      "INSERT INTO acces_falaise (type, arret_id, falaise_id, depart_slug, arrivee_slug, km, dplus, dmoins,
         description, public, variante, variante_formate, contrib, contrib_mail)
       VALUES ({$txt($o['type'])}, $arretId, $falaiseId, {$txt($o['depart_slug'])}, {$txt($o['arrivee_slug'])},
         {$num($o['km'])}, {$num($o['dplus'])}, {$num($o['dmoins'])}, {$txt($o['description'])}, " . (int) $o['public'] . ",
         {$txt($o['variante'])}, {$txt($o['variante_formate'])}, {$txt($o['contrib'])}, {$txt($o['contrib_mail'])})"
    );
    $this->cleanupOnTearDown("DELETE FROM acces_falaise WHERE acces_id = $id");
    return $id;
  }

  /** Accès à pied simple (variante ''), cf. createFixtureAcces(). */
  protected function createFixtureAccesPied(int $arretId, int $falaiseId, string $description = ''): int
  {
    return $this->createFixtureAcces($arretId, $falaiseId, ['type' => 'pied', 'description' => $description]);
  }

  protected static function escape(string $value): string
  {
    return str_replace(["\\", "'"], ["\\\\", "\\'"], $value);
  }
}
