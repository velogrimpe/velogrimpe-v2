import { test, expect } from '@playwright/test'

test.describe('Carte (Map)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carte.php')
    // Wait for map to be initialized
    await page.waitForSelector('#map .leaflet-container', { timeout: 10000 })
  })

  test('map loads with tiles', async ({ page }) => {
    // Leaflet container should exist
    await expect(page.locator('.leaflet-container')).toBeVisible()

    // Tiles should be loaded
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible()
  })

  test('map has markers', async ({ page }) => {
    // Wait for markers to load
    await page.waitForSelector('.leaflet-marker-icon', { timeout: 10000 })

    // Should have at least one marker
    const markers = page.locator('.leaflet-marker-icon')
    await expect(markers.first()).toBeVisible()
  })

  test('clicking a marker shows popup or info panel', async ({ page }) => {
    // Wait for markers
    await page.waitForSelector('.leaflet-marker-icon', { timeout: 10000 })

    // Click first marker
    await page.locator('.leaflet-marker-icon').first().click()

    // Should show some info (popup or side panel)
    const infoVisible = await page.locator('.leaflet-popup, .info, [class*="panel"]').first().isVisible()
      .catch(() => false)

    // At least something should happen on click
    expect(infoVisible).toBeTruthy()
  })

  test('map zoom controls work', async ({ page }) => {
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    const zoomOut = page.locator('.leaflet-control-zoom-out')

    await expect(zoomIn).toBeVisible()
    await expect(zoomOut).toBeVisible()

    // Click zoom in
    await zoomIn.click()
    await page.waitForTimeout(300) // Wait for zoom animation

    // Click zoom out
    await zoomOut.click()
  })

  test('filters panel exists', async ({ page }) => {
    // Vue filters component should be mounted
    const filtersContainer = page.locator('#vue-carte-filters, [class*="filter"]')
    await expect(filtersContainer.first()).toBeVisible()
  })
})

test.describe('Carte with geolocation', () => {
  test('can mock user location', async ({ context, page }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation'])

    // Mock geolocation to Lyon
    await context.setGeolocation({ latitude: 45.7640, longitude: 4.8357 })

    await page.goto('/carte.php')
    await page.waitForSelector('.leaflet-container')

    // If there's a locate button, it should work with mocked location
    const locateButton = page.locator('.leaflet-control-locate, [class*="locate"]')
    if (await locateButton.isVisible()) {
      await locateButton.click()
      // Map should center on mocked location
      await page.waitForTimeout(1000)
    }
  })
})
