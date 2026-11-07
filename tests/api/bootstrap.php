<?php
// Bootstrap PHPUnit : autoload composer + config partagée avec l'app (mêmes
// identifiants DB que public_html/database/velogrimpe.php, lus une seule fois).

require dirname(__DIR__, 2) . '/vendor/autoload.php';

define('VG_TEST_CONFIG', require dirname(__DIR__, 2) . '/config.php');
define('VG_TEST_DB_CONTAINER', 'velogrimpe');
define('VG_TEST_BASE_URL', 'http://localhost:4000');

// Coupe l'envoi de mail (lib/sendmail.php) le temps de la suite : `public/`
// est monté en lecture/écriture dans le conteneur (cf. CLAUDE.md), donc ce
// fichier posé côté hôte est immédiatement visible par l'appli. Nettoyé même
// si la suite plante (register_shutdown_function s'exécute toujours) — un
// fichier orphelin après un `kill -9` resterait sans effet ailleurs qu'en
// coupant le mail en local, à supprimer à la main si ça arrive.
$vgDisableMailFlag = dirname(__DIR__, 2) . '/public/tmp/phpunit-disable-mail.flag';
if (!is_dir(dirname($vgDisableMailFlag))) {
  mkdir(dirname($vgDisableMailFlag), 0755, true);
}
file_put_contents($vgDisableMailFlag, 'posé par tests/api/bootstrap.php le ' . date('c') . "\n");
register_shutdown_function(function () use ($vgDisableMailFlag) {
  @unlink($vgDisableMailFlag);
});
