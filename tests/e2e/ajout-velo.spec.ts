import { test, expect, Page } from '@playwright/test'

/**
 * Formulaire d'ajout d'accès (ajout_velo.php, Lot 5) : départ = arrêt de
 * n'importe quel type, deux modes (vélo / à pied uniquement).
 */

type ArretItem = { id: number; nom: string; types: string[] }

/** Catalogue d'arrêts embarqué par la page (attribut data-arrets du point de montage Vue). */
async function arrets(page: Page): Promise<ArretItem[]> {
  return page.evaluate(() =>
    JSON.parse(document.getElementById('vue-ajout-velo')!.dataset.arrets || '[]'),
  )
}

/** Premier arrêt qui ne dessert QUE le bus : prouve que la liste n'est plus limitée aux gares. */
async function arretBusSeul(page: Page): Promise<ArretItem> {
  const a = (await arrets(page)).find((x) => x.types.includes('bus') && !x.types.includes('ter') && !x.types.includes('tgv'))
  expect(a, 'la base locale doit contenir au moins un arrêt de bus seul').toBeTruthy()
  return a!
}

test.describe("Formulaire d'ajout d'accès", () => {
  test("l'autocomplete de départ propose les arrêts de bus, pas seulement les gares", async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php')
    const arret = await arretBusSeul(page)

    const input = page.locator('#vue-ajout-velo input').first()
    await input.click()
    await input.fill(arret.nom)
    await page.locator('.autocomplete-list li').filter({ hasText: arret.nom }).first().click()

    await expect(page.locator('#arret_id')).toHaveValue(String(arret.id))
  })

  test("?arret_id= préremplit et verrouille le départ", async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php')
    const arret = await arretBusSeul(page)

    await page.goto(`/ajout/ajout_velo.php?arret_id=${arret.id}`)

    await expect(page.locator('#vue-ajout-velo input').first()).toHaveValue(arret.nom)
    await expect(page.locator('#vue-ajout-velo input').first()).toBeDisabled()
    await expect(page.locator('#arret_id')).toHaveValue(String(arret.id))
  })

  test("un arrêt introuvable renvoie vers l'ajout d'arrêt", async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php')
    const lien = page.getByRole('link', { name: /arrêt n'existe pas/i })
    await expect(lien).toHaveAttribute('href', /\/ajout\/ajout_arret\.php/)
  })

  test("le mode « à pied » masque le GPX et les indicateurs, et demande une description", async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php')
    // Mode vélo par défaut : GPX et indicateurs visibles.
    await expect(page.locator('input[name=mode][value=velo]')).toBeChecked()
    await expect(page.locator('#gpx_file')).toBeVisible()
    await expect(page.locator('#velo_km')).toBeVisible()

    await page.locator('input[name=mode][value=pied]').check()

    await expect(page.locator('#gpx_file')).toBeHidden()
    await expect(page.locator('#velo_km')).toBeHidden()
    await expect(page.locator('#velo-map')).toBeHidden()
    await expect(page.locator('#description')).toBeVisible()
    // Les champs masqués ne doivent plus bloquer la soumission (required).
    await expect(page.locator('#gpx_file')).toBeDisabled()
    await expect(page.locator('#velo_km')).toBeDisabled()

    await page.locator('input[name=mode][value=velo]').check()
    await expect(page.locator('#gpx_file')).toBeVisible()
    await expect(page.locator('#gpx_file')).toBeEnabled()
  })
})
