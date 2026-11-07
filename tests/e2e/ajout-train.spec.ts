import { test, expect, Page } from '@playwright/test'

/**
 * Formulaire d'ajout d'itinéraire train (Lot 8bis) : l'arrivée est un ARRÊT de
 * n'importe quel type (champ `arret_id`, catalogue dans `data-arrets`), plus
 * seulement une gare.
 */

type ArretItem = { id: number; nom: string; types: string[] }

async function arrets(page: Page): Promise<ArretItem[]> {
  return page.evaluate(() =>
    JSON.parse(document.getElementById('vue-ajout-train')!.dataset.arrets || '[]'),
  )
}

async function arretBusSeul(page: Page): Promise<ArretItem> {
  const a = (await arrets(page)).find((x) => x.types.includes('bus') && !x.types.includes('ter') && !x.types.includes('tgv'))
  expect(a, 'la base locale doit contenir au moins un arrêt de bus seul').toBeTruthy()
  return a!
}

test.describe("Formulaire d'ajout d'itinéraire train", () => {
  test("l'autocomplete d'arrivée propose les arrêts de bus, pas seulement les gares", async ({ page }) => {
    await page.goto('/ajout/ajout_train.php')
    const arret = await arretBusSeul(page)

    const input = page.locator('#vue-ajout-train input').first()
    await input.click()
    await input.fill(arret.nom)
    await page.locator('.autocomplete-list li').filter({ hasText: arret.nom }).first().click()

    await expect(page.locator('#arret_id')).toHaveValue(String(arret.id))
    await expect(page.locator('#train_arrivee')).toHaveValue(arret.nom)
  })

  test('?arret_id= préremplit l\'arrivée', async ({ page }) => {
    await page.goto('/ajout/ajout_train.php')
    const arret = await arretBusSeul(page)

    await page.goto(`/ajout/ajout_train.php?arret_id=${arret.id}`)

    await expect(page.locator('#vue-ajout-train input').first()).toHaveValue(arret.nom)
    await expect(page.locator('#arret_id')).toHaveValue(String(arret.id))
  })

  test('?gare_id= (ancien lien) reste accepté', async ({ page }) => {
    await page.goto('/ajout/ajout_train.php')
    const arret = await arretBusSeul(page)

    await page.goto(`/ajout/ajout_train.php?gare_id=${arret.id}`)

    await expect(page.locator('#arret_id')).toHaveValue(String(arret.id))
  })

  test('la vérification de doublon interroge verify_train_dup avec arret_id', async ({ page }) => {
    await page.goto('/ajout/ajout_train.php')
    const arret = await arretBusSeul(page)
    const requete = page.waitForRequest((r) => r.url().includes('/api/verify_train_dup.php') && r.url().includes(`arret_id=${arret.id}`))

    await page.goto(`/ajout/ajout_train.php?arret_id=${arret.id}&ville_id=6`)

    await requete
  })
})
