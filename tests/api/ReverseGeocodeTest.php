<?php

require_once __DIR__ . '/ApiTestCase.php';

/**
 * api/reverse_geocode.php : géocodage inverse unitaire (API Adresse / IGN
 * Géoplateforme), pour préremplir commune/code_insee/cp dans le formulaire
 * d'ajout d'arrêt (Lot 3, docs/plan-implementation-arrets.md).
 *
 * Appel réseau réel vers data.geopf.fr (pas de mock, cf. convention du
 * projet) — point témoin choisi pour sa stabilité (voirie du centre de Lyon,
 * proche de la gare Part-Dieu, cf. ApiTestCase::WITNESS_GARE_ID).
 */
final class ReverseGeocodeTest extends ApiTestCase
{
  private const WITNESS_LAT = 45.7596;
  private const WITNESS_LNG = 4.8586;

  public function testKnownPointResolvesCommune(): void
  {
    $res = $this->httpGet('/api/reverse_geocode.php?lat=' . self::WITNESS_LAT . '&lng=' . self::WITNESS_LNG);

    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertSame('69383', $res['body']['code_insee']);
    $this->assertSame('Lyon', $res['body']['commune']);
    $this->assertSame('69003', $res['body']['cp']);
  }

  public function testPointWithoutResultReturnsNulls(): void
  {
    // Plein océan Atlantique : aucune commune à proximité.
    $res = $this->httpGet('/api/reverse_geocode.php?lat=0&lng=-30');

    $this->assertSame(200, $res['status'], $res['raw']);
    $this->assertNull($res['body']['commune']);
    $this->assertNull($res['body']['code_insee']);
    $this->assertNull($res['body']['cp']);
  }

  public function testMissingLatIsRejected(): void
  {
    $res = $this->httpGet('/api/reverse_geocode.php?lng=' . self::WITNESS_LNG);
    $this->assertSame(400, $res['status']);
  }

  public function testMissingLngIsRejected(): void
  {
    $res = $this->httpGet('/api/reverse_geocode.php?lat=' . self::WITNESS_LAT);
    $this->assertSame(400, $res['status']);
  }

  public function testOutOfRangeLatIsRejected(): void
  {
    $res = $this->httpGet('/api/reverse_geocode.php?lat=120&lng=' . self::WITNESS_LNG);
    $this->assertSame(400, $res['status']);
  }

  public function testNonNumericLatIsRejected(): void
  {
    $res = $this->httpGet('/api/reverse_geocode.php?lat=abc&lng=' . self::WITNESS_LNG);
    $this->assertSame(400, $res['status']);
  }
}
