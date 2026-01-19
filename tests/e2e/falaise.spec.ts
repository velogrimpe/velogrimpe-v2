import { test, expect } from '@playwright/test'

test.describe('Falaise page', () => {
  // Use a known falaise ID for testing
  const testFalaiseId = 39 // Pont de Barret (mentioned in docs)

  test('falaise page loads with content', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Page should have title with falaise name
    await expect(page).toHaveTitle(/falaise/i)

    // Main content should be visible
    await expect(page.locator('main')).toBeVisible()
  })

  test('falaise page shows key information', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Should display falaise details (cotations, exposition, etc.)
    const content = page.locator('main')

    // Look for typical falaise info sections
    await expect(content).toContainText(/cotation|voies|exposition/i)
  })

  test('falaise page has a map', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Map should be present
    const map = page.locator('#map, .leaflet-container')
    await expect(map.first()).toBeVisible()
  })

  test('ville selector works', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Look for ville/city selector
    const villeSelector = page.locator('select[name*="ville"], #ville, [id*="ville"] select')

    if (await villeSelector.isVisible()) {
      // Get initial options count
      const optionsCount = await villeSelector.locator('option').count()
      expect(optionsCount).toBeGreaterThan(0)
    }
  })
})
