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

  test("le mode « à pied » masque le GPX et les indicateurs du mode vélo, et demande une description", async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php')
    // Mode vélo par défaut : GPX et indicateurs visibles.
    await expect(page.locator('input[name=mode][value=velo]')).toBeChecked()
    await expect(page.locator('#gpx_file')).toBeVisible()
    await expect(page.locator('#velo_km')).toBeVisible()

    await page.locator('input[name=mode][value=pied]').check()

    await expect(page.locator('#gpx_file')).toBeHidden() // GPX obligatoire du mode vélo
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

  test("le mode « à pied » propose km, D+, D-, un GPX facultatif et sa carte", async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php')
    // Mode vélo : les champs de la section à pied sont masqués et désactivés (rien d'envoyé en double)
    await expect(page.locator('#pied_km')).toBeDisabled()
    await expect(page.locator('#pied_gpx_file')).toBeDisabled()

    await page.locator('input[name=mode][value=pied]').check()

    for (const id of ['#pied_km', '#pied_dplus', '#pied_dmoins', '#pied_gpx_file']) {
      await expect(page.locator(id)).toBeVisible()
      await expect(page.locator(id)).toBeEnabled()
    }
    // Facultatifs : pas de `required` (le GPX vélo, lui, reste obligatoire)
    await expect(page.locator('#pied_gpx_file')).not.toHaveAttribute('required', /.*/)
    await expect(page.locator('#pied-map')).toBeVisible()
    // Mêmes noms de champs que la section vélo : le serveur lit velo_km / velo_dplus / velo_dmoins / gpx_file
    await expect(page.locator('#pied_km')).toHaveAttribute('name', 'velo_km')
    await expect(page.locator('#pied_gpx_file')).toHaveAttribute('name', 'gpx_file')
  })

  test("?mode=pied ouvre le formulaire directement sur l'accès à pied", async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php?mode=pied')
    await expect(page.locator('input[name=mode][value=pied]')).toBeChecked()
    await expect(page.locator('#section-pied')).toBeVisible()
    await expect(page.locator('#section-velo')).toBeHidden()
    await expect(page.locator('#pied_km')).toBeEnabled()
    await expect(page.locator('#gpx_file')).toBeDisabled()
  })

  test("l'avertissement de doublon ne concerne que le type d'accès choisi, avec un texte adapté", async ({ page }) => {
    // Hostiaz (falaise 25) depuis Tenay-Hauteville (arrêt 12) : un itinéraire à vélo (« Option à vélo depuis la gare »)
    // ET un accès sans vélo (« Option à pied depuis la gare »)
    await page.goto('/ajout/ajout_velo.php?arret_id=12&falaise_id=25')
    const alerte = page.locator('#itineraireExistsAlert')
    const variante = page.locator('#velo_variante')

    await variante.fill('Option à vélo depuis la gare')
    await expect(alerte).toBeVisible()
    await expect(alerte.locator('[data-alert-type=velo]')).toBeVisible()
    await expect(alerte.locator('[data-alert-type=velo]')).toContainText(/itinéraire à vélo existe déjà/)
    await expect(alerte.locator('[data-alert-type=pied]')).toBeHidden()

    // Même nom en mode sans vélo : pas de doublon (l'accès sans vélo porte un autre nom)
    await page.locator('input[name=mode][value=pied]').check()
    await expect(alerte).toBeHidden()

    await variante.fill('Option à pied depuis la gare')
    await expect(alerte).toBeVisible()
    await expect(alerte.locator('[data-alert-type=pied]')).toContainText(/accès sans vélo existe déjà/)
    await expect(alerte.locator('[data-alert-type=pied]')).toContainText(/compléter/)
    await expect(alerte.locator('[data-alert-type=velo]')).toBeHidden()
  })

  test("un accès d'un autre type n'est pas signalé comme doublon", async ({ page }) => {
    // Virieu le Grand (falaise 26) depuis l'arrêt 7 : un itinéraire à vélo seulement
    await page.goto('/ajout/ajout_velo.php?arret_id=7&falaise_id=26')
    await expect(page.locator('#itineraireExistsAlert')).toBeVisible()
    await page.locator('input[name=mode][value=pied]').check()
    await expect(page.locator('#itineraireExistsAlert')).toBeHidden()
  })

  test("la carte du mode sans vélo dessine l'arrêt avec l'icône de son type (bus, pas une gare)", async ({ page }) => {
    // 6214 « La Balme - Pont du Rhône » : arrêt de bus
    await page.goto('/ajout/ajout_velo.php?mode=pied&arret_id=6214')
    const marqueur = page.locator('#pied-map .vg-arret-icon')
    await expect(marqueur).toHaveCount(1)
    // Fond de l'icône du type dominant (pas l'ancienne icône de gare)
    await expect(page.locator('#pied-map .vg-arret-icon svg use')).toHaveAttribute('href', '#bus-stop')
  })

  test("la variante se renseigne dans les deux modes, sous la ligne arrêt / falaise, et lève l'avertissement de doublon", async ({ page }) => {
    // Falaise 27 depuis l'arrêt 6 : un itinéraire à vélo sans variante
    await page.goto('/ajout/ajout_velo.php?arret_id=6&falaise_id=27')
    const alerte = page.locator('#itineraireExistsAlert')
    const variante = page.locator('#velo_variante')
    await expect(alerte).toBeVisible()

    // Sous la ligne arrêt / falaise et son avertissement, pour pouvoir la saisir une fois l'alerte affichée
    const y = async (l: ReturnType<typeof page.locator>) => (await l.boundingBox())!.y
    expect(await y(variante)).toBeGreaterThan(await y(alerte))
    await expect(variante).toBeVisible()
    await expect(variante).toBeEnabled()

    // Nommer la variante : ce n'est plus un doublon
    await variante.fill('Option par le Nord')
    await expect(alerte).toBeHidden()
    await expect(page.locator('#velo_varianteformate')).toHaveValue('option-par-le-nord')
    // Effacée : le doublon réapparaît
    await variante.fill('')
    await expect(alerte).toBeVisible()

    // Même champ, toujours là, en mode sans vélo (pas de doublon : aucun accès sans vélo ici)
    await page.locator('input[name=mode][value=pied]').check()
    await expect(variante).toBeVisible()
    await expect(variante).toBeEnabled()
    await expect(variante).toHaveAttribute('name', 'velo_variante')
    await expect(alerte).toBeHidden()
  })
})
