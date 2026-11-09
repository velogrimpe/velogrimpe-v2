import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'

/**
 * Éditeur de détails d'une falaise : les accès sont affichés en lecture seule avec leur trace GPX, les
 * itinéraires à vélo en trait plein et les accès sans vélo (type pied) en POINTILLÉ.
 * Témoin : Hostiaz (falaise 25) : itinéraire à vélo (acces 18) + accès sans vélo (acces 19). Les fichiers GPX
 * du jeu local ne sont pas garantis : les requêtes de traces sont servies par une fixture.
 */
test("les accès sans vélo sont tracés en pointillé, les itinéraires à vélo en trait plein", async ({ page }) => {
  const gpx = readFileSync('tests/fixtures/velo-with-wpt.gpx', 'utf-8')
  const demandes: string[] = []
  await page.route('**/public/gpx/*.gpx', (r) => {
    demandes.push(r.request().url())
    return r.fulfill({ contentType: 'application/gpx+xml', body: gpx })
  })
  await page.goto('/ajout/edit_details_falaise.php?falaise_id=25')
  await page.waitForSelector('.leaflet-container')

  // Les deux traces sont demandées : vélo (18) et sans vélo (19)
  await expect.poll(() => demandes.some((u) => /\/18_/.test(u)) && demandes.some((u) => /\/19_/.test(u))).toBe(true)

  const pointille = page.locator('path.vg-acces-pied-trace')
  await expect(pointille).toHaveCount(1)
  await expect(pointille).toHaveAttribute('stroke-dasharray', '6 6')
  // Trait plein : tracé noir sans pointillé (l'itinéraire à vélo), distinct de l'accès sans vélo
  const plein = page.locator('path[stroke="black"]:not(.vg-acces-pied-trace):not([stroke-dasharray])')
  expect(await plein.count()).toBeGreaterThanOrEqual(1)
})
