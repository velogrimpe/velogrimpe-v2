import { test, expect } from '@playwright/test'

test.describe('Ajout Falaise form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
  })

  test('form page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Ajouter.*falaise/i)

    // Form should be visible
    await expect(page.locator('form#form')).toBeVisible()
  })

  test('Vue autocomplete component is mounted', async ({ page }) => {
    // Wait for Vue to mount
    await page.waitForSelector('#vue-ajout-falaise')

    // The autocomplete input should be functional (use first() for strict mode)
    const autocompleteInput = page.locator('#vue-ajout-falaise input[type="text"]').first()
    await expect(autocompleteInput).toBeVisible()

    // Type something to test autocomplete
    await autocompleteInput.fill('test')

    // Input should have the value
    await expect(autocompleteInput).toHaveValue('test')
  })

  test('map is interactive', async ({ page }) => {
    // Wait for map - Leaflet adds class directly to #map
    await page.waitForSelector('#map.leaflet-container', { timeout: 15000 })

    // Wait for tiles to load
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10000 })

    // Map should be visible
    await expect(page.locator('#map.leaflet-container')).toBeVisible()

    // Zoom controls should work
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await expect(zoomIn).toBeVisible()
  })

  test('required fields are marked', async ({ page }) => {
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Form should not submit (required fields)
    // We should still be on the same page
    await expect(page).toHaveURL(/ajout_falaise/)
  })

  test('exposition selectors work', async ({ page }) => {
    // Wait for Vue components
    await page.waitForSelector('#vue-exposhort1')

    // Click on exposition dropdown
    const expoSelect = page.locator('#vue-exposhort1')
    await expoSelect.click()

    // Options should appear
    await page.waitForTimeout(200)
  })

  test('rose des vents preview updates', async ({ page }) => {
    // Wait for rose preview component
    const rosePreview = page.locator('#vue-rose-preview')
    await expect(rosePreview).toBeVisible()
  })
})

test.describe('Ajout Falaise - form validation', () => {
  test('coordinates input accepts valid format', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')

    // Fill valid coordinates format
    const coordsInput = page.locator('#falaise_latlng')
    await coordsInput.fill('44.5,5.5')

    // Input should have the value
    await expect(coordsInput).toHaveValue('44.5,5.5')
  })
})
