import { test, expect } from '@playwright/test'

test.describe('Falaise page', () => {
  // Use a known falaise ID for testing
  const testFalaiseId = 39 // Pont de Barret (mentioned in docs)

  test('falaise page loads with content', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Page should have title with falaise name or site name
    await expect(page).toHaveTitle(/Escalade|Velogrimpe/i)

    // Body content should be visible
    await expect(page.locator('body')).toBeVisible()
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

    // Le choix d'une ville de départ recharge la page sur cette ville.
    const villeSelector = page.locator('select[name="ville_id"]')
    await expect(villeSelector).toBeVisible()

    const villes = villeSelector.locator('option[value]:not([value=""])')
    expect(await villes.count()).toBeGreaterThan(0)

    const villeId = await villes.first().getAttribute('value')
    await villeSelector.selectOption(villeId!)
    await expect(page).toHaveURL(new RegExp(`ville_id=${villeId}`))
  })
})
