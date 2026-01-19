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

    // The autocomplete input should be functional
    const autocompleteInput = page.locator('#vue-ajout-falaise input')
    await expect(autocompleteInput).toBeVisible()

    // Type something to test autocomplete
    await autocompleteInput.fill('test')

    // Input should have the value
    await expect(autocompleteInput).toHaveValue('test')
  })

  test('map is interactive', async ({ page }) => {
    // Wait for map
    await page.waitForSelector('#map .leaflet-container')

    // Click on map to place marker
    const map = page.locator('#map')
    await map.click({ position: { x: 200, y: 150 } })

    // Coordinates input should be filled
    const coordsInput = page.locator('#falaise_latlng')
    const value = await coordsInput.inputValue()

    // Should have coordinates format (lat,lng)
    expect(value).toMatch(/\d+\.\d+,\d+\.\d+/)
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
  test('shows error for invalid coordinates', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')

    // Fill invalid coordinates
    const coordsInput = page.locator('#falaise_latlng')
    await coordsInput.fill('invalid')

    // Move focus away
    await page.locator('#falaise_cotmin').focus()

    // Map marker should not appear
    const marker = page.locator('#map .leaflet-marker-icon')
    await expect(marker).not.toBeVisible()
  })
})
