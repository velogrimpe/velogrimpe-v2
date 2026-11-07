import { test, expect } from '@playwright/test'

/**
 * Page falaise (Lot 8ter) : accès à pied depuis un arrêt, listés et dessinés.
 * Témoins réels (migration du Lot 8, cf. docs/plan-implementation-arrets.md) :
 *  - 260 Niolon        : accès piéton seul depuis la gare 2273 ;
 *  - 247 Sormiou       : accès piétons seuls depuis des arrêts de BUS (6220, 6223) ;
 *  - 25  Hostiaz       : gare 12 avec itinéraire vélo ET accès piéton (les deux listés, pas de fusion) ;
 *  - 39  Pont de Barret : aucun accès piéton.
 * Le rendu des icônes par type et des traits se vérifie aussi à la main.
 */

test.describe('Page falaise : accès à pied', () => {
  test('accès piéton seul depuis une gare : section et bloc listés', async ({ page }) => {
    await page.goto('/falaise.php?falaise_id=260')

    const section = page.locator('#acces-pietons')
    await expect(section).toBeVisible()
    await expect(section.locator('article[data-arret-id="2273"]')).toContainText('Niolon')
  })

  test('accès depuis plusieurs arrêts de bus : un bloc par arrêt', async ({ page }) => {
    await page.goto('/falaise.php?falaise_id=247')

    const section = page.locator('#acces-pietons')
    await expect(section.locator('article[data-arret-id="6220"]')).toBeVisible()
    await expect(section.locator('article[data-arret-id="6223"]')).toBeVisible()
  })

  test("arrêt avec itinéraire vélo ET accès piéton : l'accès piéton est listé quand même", async ({ page }) => {
    await page.goto('/falaise.php?falaise_id=25')

    await expect(page.locator('#acces-pietons article[data-arret-id="12"]')).toContainText('Tenay')
  })

  test("falaise sans accès piéton : pas de section", async ({ page }) => {
    await page.goto('/falaise.php?falaise_id=39')

    await expect(page.locator('#acces-pietons')).toHaveCount(0)
  })

  test("la carte dessine l'arrêt (marqueur) et un trait vers la falaise", async ({ page }) => {
    await page.goto('/falaise.php?falaise_id=260')
    await page.waitForSelector('#map.leaflet-container')

    await expect(page.locator('#map [data-arret-id="2273"]').first()).toBeVisible()
    expect(await page.locator('#map path.vg-acces-pieton-line').count()).toBeGreaterThan(0)
  })

  test("un arrêt non-bus (gare) n'a pas l'icône de bus", async ({ page }) => {
    await page.goto('/falaise.php?falaise_id=260')
    await page.waitForSelector('#map.leaflet-container')

    const marqueur = page.locator('#map [data-arret-id="2273"]').first()
    await expect(marqueur).toBeVisible()
    await expect(marqueur.locator('use')).toHaveAttribute('href', '#train')
  })
})
