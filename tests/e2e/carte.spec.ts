import { test, expect } from '@playwright/test'

test.describe('Carte Leaflet (ancienne version)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carte_leaflet.php')
    // Wait for map to be initialized - Leaflet adds class to #map directly
    await page.waitForSelector('#map.leaflet-container', { timeout: 15000 })
  })

  test('map loads with tiles', async ({ page }) => {
    // Leaflet container should exist
    await expect(page.locator('#map.leaflet-container')).toBeVisible()

    // Tiles should be loaded (wait longer for network)
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 10000 })
  })

  test('map has markers', async ({ page }) => {
    // Wait for markers to load (falaises)
    await page.waitForSelector('.leaflet-marker-icon', { timeout: 15000 })

    // Should have at least one marker
    const markers = page.locator('.leaflet-marker-icon')
    await expect(markers.first()).toBeVisible()
  })

  test('clicking a marker shows info', async ({ page }) => {
    // Wait for markers
    await page.waitForSelector('.leaflet-marker-icon', { timeout: 15000 })

    // Click first marker with force to bypass overlay issues
    await page.locator('.leaflet-marker-icon').first().click({ force: true })

    // Should show some info (popup, tooltip, or info panel)
    await page.waitForTimeout(500)
    const hasInfo = await page.locator('.leaflet-popup, .leaflet-tooltip, .info').first().isVisible()
      .catch(() => false)

    // Info panel might update instead of popup
    expect(hasInfo).toBeTruthy()
  })

  test('map zoom controls work', async ({ page }) => {
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    const zoomOut = page.locator('.leaflet-control-zoom-out')

    await expect(zoomIn).toBeVisible()
    await expect(zoomOut).toBeVisible()

    // Click zoom in
    await zoomIn.click()
    await page.waitForTimeout(300)

    // Click zoom out
    await zoomOut.click()
  })

  test('search component exists', async ({ page }) => {
    // La recherche est repliée dans le contrôle de filtres : le bouton l'ouvre.
    // Ciblé par son title : le libellé texte est masqué en viewport mobile.
    const bouton = page.locator('#vue-map-filters button[title="Rechercher une falaise ou un arrêt"]')
    await expect(bouton).toBeVisible()

    await bouton.click()
    await expect(page.locator('#vue-map-filters input[type="text"]')).toBeVisible()
  })
})

test.describe('Carte Leaflet avec géolocalisation', () => {
  test('can mock user location', async ({ context, page }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation'])

    // Mock geolocation to Lyon
    await context.setGeolocation({ latitude: 45.7640, longitude: 4.8357 })

    await page.goto('/carte_leaflet.php')
    await page.waitForSelector('#map.leaflet-container', { timeout: 15000 })

    // Map should load with mocked location available
    await expect(page.locator('#map.leaflet-container')).toBeVisible()
  })
})

// carte.php est la carte MapLibre (la version Leaflet ci-dessus est l'« ancienne version »).
test.describe('Carte MapLibre', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carte.php')
    await page.waitForSelector('#map.maplibregl-map', { timeout: 15000 })
  })

  test('la carte se charge avec son canvas', async ({ page }) => {
    await expect(page.locator('#map.maplibregl-map')).toBeVisible()
    await expect(page.locator('#map canvas.maplibregl-canvas')).toBeVisible()
  })

  test('des marqueurs de falaises sont affichés', async ({ page }) => {
    await page.waitForSelector('.vg-marker', { timeout: 15000 })
    await expect(page.locator('.vg-marker').first()).toBeVisible()
  })

  test('les contrôles de zoom fonctionnent', async ({ page }) => {
    const zoomIn = page.locator('.maplibregl-ctrl-zoom-in')
    const zoomOut = page.locator('.maplibregl-ctrl-zoom-out')
    await expect(zoomIn).toBeVisible()
    await expect(zoomOut).toBeVisible()
    await zoomIn.click()
    await zoomOut.click()
  })

  test('le composant de recherche existe', async ({ page }) => {
    const bouton = page.locator('#vue-map-filters button[title="Rechercher une falaise ou un arrêt"]')
    await expect(bouton).toBeVisible()
    await bouton.click()
    await expect(page.locator('#vue-map-filters input[type="text"]')).toBeVisible()
  })

  test('la géolocalisation simulée ne casse pas la carte', async ({ context, page }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 45.764, longitude: 4.8357 })
    await page.goto('/carte.php')
    await expect(page.locator('#map.maplibregl-map')).toBeVisible({ timeout: 15000 })
  })
})
