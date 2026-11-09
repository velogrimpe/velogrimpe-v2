import { test, expect } from '@playwright/test'

/**
 * Page d'édition d'un accès (ajout/edit_velo.php) : elle propose aussi les accès sans vélo (type pied).
 * Témoin : Hostiaz (falaise 25) depuis Tenay-Hauteville (arrêt 12) a un itinéraire à vélo (18) et un
 * accès sans vélo (19). Écriture couverte par tests/api/EditVeloTest.php.
 */

const URL = '/ajout/edit_velo.php?falaise_id=25&gare_id=12'

test.describe('Édition : accès sans vélo', () => {
  test("la liste des accès propose l'itinéraire à vélo et l'accès sans vélo", async ({ page }) => {
    await page.goto(URL)
    const options = page.locator('#vue-edit-velo select').nth(1).locator('option')
    await expect(options.filter({ hasText: 'Accès sans vélo' })).toHaveCount(1)
    expect(await options.count()).toBeGreaterThanOrEqual(3) // placeholder + vélo + sans vélo
  })

  test("sélectionné, un accès sans vélo a des indicateurs facultatifs et pas d'Openrunner", async ({ page }) => {
    await page.goto(URL + '&velo_id=19')
    const champs = page.locator('#velo-edit-fields')
    await expect(champs).toBeVisible()
    await expect(champs).toHaveAttribute('data-type', 'pied')
    for (const id of ['#velo_km', '#velo_dplus', '#velo_dmoins']) {
      await expect(page.locator(id)).not.toHaveAttribute('required', /.*/)
    }
    await expect(page.locator('#velo_km')).toHaveValue('3.3') // valeurs migrées depuis l'ancien itinéraire « à pied uniquement »
    await expect(page.locator('#velo_dplus')).toHaveValue('450')
    await expect(page.locator('label[for=velo_openrunner]')).toBeHidden()
    await expect(page.getByText('(optionnel)').first()).toBeVisible()
    // Validé + contributeur : suggestion, avec un texte propre aux accès
    await expect(page.locator('#velo-edit-validated')).toContainText('Cet accès est déjà validé')
  })

  test("un itinéraire à vélo garde ses indicateurs obligatoires", async ({ page }) => {
    await page.goto(URL + '&velo_id=18')
    await expect(page.locator('#velo-edit-fields')).toHaveAttribute('data-type', 'velo')
    await expect(page.locator('#velo_km')).toHaveAttribute('required', '')
    await expect(page.locator('#velo-edit-validated')).toContainText('Cet itinéraire est déjà validé')
  })

  test("la carte dessine l'arrêt avec l'icône de son type", async ({ page }) => {
    await page.goto(URL + '&velo_id=19')
    await expect(page.locator('#velo-map .vg-arret-icon')).toHaveCount(1)
  })
})
