import { test, expect, Page } from '@playwright/test'

/**
 * Liste des falaises liées du formulaire d'arrêt de bus (ajout_bus.php).
 *
 * L'état des liaisons vit dans le script carte de la page (Set + hidden
 * #arret_falaise_ids) et la liste Vue s'y branche par l'événement
 * `velogrimpe:bus-falaises-changed`. Ces tests vérifient que les deux restent
 * d'accord, quel que soit le point d'entrée (carte, liste, URL, édition).
 */

const SECTION = '#vue-falaises-liees'

/** Noms affichés dans la liste des falaises liées. */
async function nomsAffiches(page: Page): Promise<string[]> {
  return page.locator(`${SECTION} li button:not([aria-label])`).allTextContents()
    .then((noms) => noms.map((n) => n.trim()))
}

/** Contenu du champ caché, qui est ce qui part réellement au submit. */
function hidden(page: Page) {
  return page.locator('#arret_falaise_ids')
}

/** Les N premières falaises du catalogue de la page. */
async function premieresFalaises(page: Page, n: number) {
  return page.evaluate(
    (n) => (window as any).busFalaises.slice(0, n) as { id: number; nom: string }[],
    n,
  )
}

test.describe('Falaises liées à un arrêt de bus', () => {
  test('part d\'une liste vide', async ({ page }) => {
    await page.goto('/ajout/ajout_bus.php')
    await expect(page.locator(SECTION)).toContainText('Aucune falaise liée')
    await expect(hidden(page)).toHaveValue('')
  })

  test('une liaison faite sur la carte apparaît dans la liste', async ({ page }) => {
    await page.goto('/ajout/ajout_bus.php')
    await page.waitForFunction(() => !!(window as any).busSetFalaiseLinked)
    const [falaise] = await premieresFalaises(page, 1)

    // Équivalent du bouton « Lier cette falaise » du popup de marqueur.
    await page.evaluate((id) => (window as any).busSetFalaiseLinked(id, true), falaise.id)

    await expect(page.locator(`${SECTION} li`)).toHaveCount(1)
    expect(await nomsAffiches(page)).toEqual([falaise.nom])
    await expect(hidden(page)).toHaveValue(String(falaise.id))
    // Le marqueur correspondant est mis en évidence sur la carte.
    await expect(page.locator('.linked-falaise')).toHaveCount(1)
  })

  test('l\'autocomplete ajoute une falaise, le × la retire', async ({ page }) => {
    await page.goto('/ajout/ajout_bus.php')
    await page.waitForFunction(() => !!(window as any).busFalaises)
    const falaises = await premieresFalaises(page, 1)
    const cible = falaises[0]

    await page.locator(SECTION).getByRole('button', { name: 'Lier une falaise' }).click()
    await page.locator(`${SECTION} input[type=text]`).fill(cible.nom.slice(0, 4))
    await page.locator(`${SECTION} .autocomplete-list li`).filter({ hasText: cible.nom }).first().click()

    expect(await nomsAffiches(page)).toEqual([cible.nom])
    await expect(hidden(page)).toHaveValue(String(cible.id))

    await page.locator(`${SECTION} li button[aria-label^="Délier"]`).first().click()
    await expect(page.locator(`${SECTION} li`)).toHaveCount(0)
    await expect(hidden(page)).toHaveValue('')
    await expect(page.locator('.linked-falaise')).toHaveCount(0)
  })

  test('les falaises pré-liées par l\'URL sont listées', async ({ page }) => {
    await page.goto('/ajout/ajout_bus.php')
    await page.waitForFunction(() => !!(window as any).busFalaises)
    const falaises = await premieresFalaises(page, 2)
    const ids = falaises.map((f) => f.id)

    await page.goto(`/ajout/ajout_bus.php?falaise_ids=${ids.join(',')}`)

    await expect(page.locator(`${SECTION} li`)).toHaveCount(2)
    expect(await nomsAffiches(page)).toEqual(falaises.map((f) => f.nom))
    await expect(hidden(page)).toHaveValue(ids.join(','))
  })

  test('un ajout par l\'autocomplete cadre sur l\'arrêt et les falaises liées', async ({ page }) => {
    await page.goto('/ajout/ajout_bus.php')
    await page.waitForFunction(() => !!(window as any).busFalaises)

    // Deux falaises volontairement éloignées (extrêmes en latitude) : un simple
    // recentrage sur la falaise ajoutée laisserait forcément l'autre hors cadre.
    const [proche, lointaine] = await page.evaluate(() => {
      const lat = (f: any) => Number(String(f.latlng).split(',')[0])
      const avecCoords = (window as any).busFalaises.filter(
        (f: any) => f.latlng && !isNaN(lat(f)),
      )
      const triees = [...avecCoords].sort((a, b) => lat(a) - lat(b))
      return [triees[0], triees[triees.length - 1]]
    })
    const ecartLatitude =
      Number(lointaine.latlng.split(',')[0]) - Number(proche.latlng.split(',')[0])
    expect(ecartLatitude).toBeGreaterThan(1)

    await page.fill('#arret_loc', proche.latlng)
    await page.evaluate((id) => (window as any).busSetFalaiseLinked(id, true), proche.id)

    await page.locator(SECTION).getByRole('button', { name: 'Lier une falaise' }).click()
    await page.locator(`${SECTION} input[type=text]`).fill(lointaine.nom.slice(0, 4))
    await page.locator(`${SECTION} .autocomplete-list li`).filter({ hasText: lointaine.nom }).first().click()
    await expect(page.locator(`${SECTION} li`)).toHaveCount(2)

    // L'instance Leaflet n'est pas exposée : on vérifie le cadrage tel qu'il se voit,
    // c'est-à-dire que les deux marqueurs liés tiennent dans le cadre de la carte.
    const visibles = await page.evaluate(
      () => {
        const markers = Array.from(document.querySelectorAll('.linked-falaise')) as HTMLElement[]
        const box = document.getElementById('map')!.getBoundingClientRect()
        return markers.map((m) => {
          const r = m.getBoundingClientRect()
          return r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1
        })
      },
    )
    expect(visibles).toHaveLength(2)
    expect(visibles.every(Boolean)).toBe(true)
  })

  test('ce qui est affiché est ce qui est posté', async ({ page }) => {
    let payload: { falaise_ids?: number[] } | null = null
    await page.route('**/api/add_bus.php', async (route) => {
      payload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, arret_id: 999 }),
      })
    })

    await page.goto('/ajout/ajout_bus.php')
    await page.waitForFunction(() => !!(window as any).busSetFalaiseLinked)
    const falaises = await premieresFalaises(page, 3)

    await page.evaluate(
      (ids) => ids.forEach((id) => (window as any).busSetFalaiseLinked(id, true)),
      falaises.map((f) => f.id),
    )
    await expect(page.locator(`${SECTION} li`)).toHaveCount(3)
    // On en retire une par la liste : le POST ne doit plus la contenir.
    await page.locator(`${SECTION} li`).nth(1).locator('button[aria-label^="Délier"]').click()
    await expect(page.locator(`${SECTION} li`)).toHaveCount(2)

    await page.fill('#arret_nom', 'Arrêt de test')
    await page.fill('#arret_loc', '45.177197,5.717869')
    await page.fill('#nom_prenom', 'Test E2E')
    await page.fill('#email', 'test@example.org')
    await page.locator('button[type=submit]').click()

    await expect.poll(() => payload?.falaise_ids).toEqual([falaises[0].id, falaises[2].id])
  })
})
