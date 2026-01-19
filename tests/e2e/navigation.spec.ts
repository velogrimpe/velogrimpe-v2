import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/Vélogrimpe/)

    // Header should be visible
    await expect(page.locator('header')).toBeVisible()

    // Footer should be visible
    await expect(page.locator('footer')).toBeVisible()
  })

  test('can navigate to carte page', async ({ page }) => {
    await page.goto('/')

    // Click on map link in navigation
    await page.click('a[href*="carte"]')

    // Should be on carte page
    await expect(page).toHaveURL(/carte/)

    // Map container should exist
    await expect(page.locator('#map')).toBeVisible()
  })

  test('can navigate to tableau page', async ({ page }) => {
    // tableau.php requires a ville_id parameter
    await page.goto('/tableau.php?ville_id=6')

    // Page should load - title is "Escalade au départ de [ville] - Vélogrimpe.fr"
    await expect(page).toHaveTitle(/Escalade|Vélogrimpe/i)
  })

  test('can navigate to contribuer page', async ({ page }) => {
    await page.goto('/contribuer.php')

    // Page should have contribution content (no <main> tag, use body)
    await expect(page.locator('body')).toContainText(/contribuer|ajouter/i)
  })
})
