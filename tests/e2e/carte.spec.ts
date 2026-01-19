import { test, expect } from '@playwright/test'

test.describe('Carte (Map)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carte.php')
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
    // Vue search component should be mounted
    await expect(page.locator('#vue-search')).toBeVisible()
  })
})

test.describe('Carte with geolocation', () => {
  test('can mock user location', async ({ context, page }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation'])

    // Mock geolocation to Lyon
    await context.setGeolocation({ latitude: 45.7640, longitude: 4.8357 })

    await page.goto('/carte.php')
    await page.waitForSelector('#map.leaflet-container', { timeout: 15000 })

    // Map should load with mocked location available
    await expect(page.locator('#map.leaflet-container')).toBeVisible()
  })
})
