import { test, expect } from '@playwright/test'

/**
 * Tableau : une falaise avec un accès sans vélo (arrêt de bus…) non relié en train à la ville affichée reçoit une
 * ligne « Également accessible sans vélo via les TC, plus de détails sur la fiche falaise ».
 * Témoins (Lyon, ville 6) : Dentelles de Montmirail (358), accès à pied depuis des arrêts de bus.
 * Contre-témoin : falaise 260 (Marseille, 15), son accès à pied est déjà listé.
 */
const TEXTE = 'Également accessible sans vélo via les TC, plus de détails sur la fiche falaise'

test.describe('Tableau : accès sans vélo via les TC', () => {
  test('desktop : ligne supplémentaire sous les itinéraires', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/tableau.php?ville_id=6')
    const row = page.getByTestId('falaise-row-358')
    await expect(row.getByTestId('acces-tc-ailleurs-358')).toHaveText(TEXTE)
    await expect(row.getByTestId('cellule-velo')).toHaveCount(3) // les 3 itinéraires vélo restent affichés
  })

  test('mobile : mention dans la carte', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/tableau.php?ville_id=6')
    await expect(page.getByTestId('falaise-card-358').getByTestId('acces-tc-ailleurs-358')).toHaveText(TEXTE)
  })

  test("pas de mention quand l'accès à pied est déjà listé", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/tableau.php?ville_id=15')
    await expect(page.getByTestId('falaise-row-260')).toBeVisible()
    await expect(page.getByTestId('acces-tc-ailleurs-260')).toHaveCount(0)
  })
})
