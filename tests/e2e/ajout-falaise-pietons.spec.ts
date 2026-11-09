import { test, expect, Page } from '@playwright/test'

/**
 * Formulaire d'ajout de falaise (Lot 8) : « cette falaise est accessible à pied
 * depuis un arrêt BTT », sélection multiple. L'état part dans le champ caché
 * `arrets_pietons` (liste JSON d'ids) ; l'écriture en base est couverte par
 * tests/api/AddFalaiseAccesPietonTest.php.
 */

type ArretItem = { id: number; nom: string; lat?: number; lng?: number }

async function arrets(page: Page): Promise<ArretItem[]> {
  return page.evaluate(() =>
    JSON.parse(document.getElementById('vue-arrets-pietons')!.dataset.arrets || '[]'),
  )
}

/** Deux arrêts de noms différents, pour que l'autocomplete n'en propose qu'un à la fois. */
async function deuxArrets(page: Page): Promise<[ArretItem, ArretItem]> {
  const liste = await arrets(page)
  expect(liste.length, 'la base locale doit contenir des arrêts').toBeGreaterThan(1)
  const a = liste[0]
  const b = liste.find((x) => !x.nom.toLowerCase().includes(a.nom.toLowerCase()) && !a.nom.toLowerCase().includes(x.nom.toLowerCase()))!
  return [a, b]
}

async function lier(page: Page, arret: ArretItem) {
  await page.getByRole('button', { name: /Lier un arrêt/ }).click()
  const input = page.locator('#vue-arrets-pietons input[type="text"]:not([name$="[variante]"])').first()
  await input.click()
  await input.fill(arret.nom)
  await page.locator('.autocomplete-list li').filter({ hasText: arret.nom }).first().click()
}

const idsSaisis = (page: Page) =>
  page.locator('#arrets_pietons').evaluate((el) => (el as HTMLInputElement).value)

test.describe("Ajout de falaise : section « Accès à la falaise »", () => {
  test("réunit, dans cet ordre : accès à vélo, accès sans vélo, accès en bus", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')

    await expect(page.getByText('Accès à la falaise', { exact: true })).toBeVisible()
    const y = async (loc: ReturnType<Page['locator']>) => (await loc.first().boundingBox())!.y
    const velo = await y(page.getByLabel(/Ajouter un accès à vélo/i))
    const sansVelo = await y(page.getByLabel(/accessible sans vélo/i))
    const bus = await y(page.getByText('Accès en bus', { exact: false }).first())
    expect(velo).toBeLessThan(sansVelo)
    expect(sansVelo).toBeLessThan(bus)
    // Plus l'ancien libellé
    await expect(page.getByText('accessible à pied depuis un arrêt de transport')).toHaveCount(0)
  })

  test("« Ajouter un accès à vélo » : mini-formulaire masqué et désactivé tant que la case n'est pas cochée", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const form = page.getByTestId('acces-velo-form')
    await expect(form).toBeHidden()
    // Désactivés : rien n'est envoyé et rien ne bloque la validation de la falaise
    await expect(page.locator('input[name="acces_velo[km]"]')).toBeDisabled()
    await expect(page.locator('input[name="acces_velo_gpx"]')).toBeDisabled()

    await page.getByLabel(/Ajouter un accès à vélo/i).check()
    await expect(form).toBeVisible()
    for (const nom of ['acces_velo[km]', 'acces_velo[dplus]', 'acces_velo[dmoins]', 'acces_velo_gpx']) {
      const champ = page.locator(`input[name="${nom}"]`)
      await expect(champ).toBeEnabled()
      await expect(champ).toHaveAttribute('required', '') // obligatoires, comme pour l'ajout d'un accès
    }
    await expect(page.locator('input[name="acces_velo[variante]"]')).not.toHaveAttribute('required', /.*/)
    await expect(page.locator('textarea[name="acces_velo[description]"]')).toBeEnabled()

    await page.getByLabel(/Ajouter un accès à vélo/i).uncheck()
    await expect(form).toBeHidden()
    await expect(page.locator('input[name="acces_velo[km]"]')).toBeDisabled()
  })

  test("choisir l'arrêt de départ renseigne le champ envoyé", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const liste = await arrets(page)
    const a = liste[0]
    await page.getByLabel(/Ajouter un accès à vélo/i).check()
    const input = page.getByTestId('acces-velo-form').locator('input[type="text"]').first()
    await input.click()
    await input.fill(a.nom)
    await page.locator('.autocomplete-list li').filter({ hasText: a.nom }).first().click()
    await expect(page.locator('input[name="acces_velo[arret_id]"]')).toHaveValue(String(a.id))
  })

  test("la carte est commune : visible dès que l'accès à vélo OU l'accès sans vélo est coché, et montre le départ du vélo", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const carte = page.locator('#map-arrets-wrap')
    await expect(carte).toBeHidden()

    // Accès à vélo seul : la carte apparaît et l'arrêt de départ choisi y est dessiné (même dézoomé)
    await page.getByLabel(/Ajouter un accès à vélo/i).check()
    await expect(carte).toBeVisible()
    const a = (await arrets(page))[0]
    const input = page.getByTestId('acces-velo-form').locator('input[type="text"]').first()
    await input.click()
    await input.fill(a.nom)
    await page.locator('.autocomplete-list li').filter({ hasText: a.nom }).first().click()
    await expect(page.locator('#map-arrets [data-velo-depart="true"]')).toHaveCount(1)
    await expect(page.locator('#map-arrets [data-velo-depart="true"]')).toHaveAttribute('data-arret-id', String(a.id))

    // Sans vélo coché en plus : la carte reste ; vélo décoché : elle reste pour le sans vélo, sans départ vélo
    await page.getByLabel(/accessible sans vélo/i).check()
    await expect(carte).toBeVisible()
    await page.getByLabel(/Ajouter un accès à vélo/i).uncheck()
    await expect(carte).toBeVisible()
    await expect(page.locator('#map-arrets [data-velo-depart="true"]')).toHaveCount(0)

    // Plus rien de coché : carte masquée
    await page.getByLabel(/accessible sans vélo/i).uncheck()
    await expect(carte).toBeHidden()
  })

  test("l'aperçu de la trace GPX de l'accès à vélo s'affiche sur la carte commune", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    await page.getByLabel(/Ajouter un accès à vélo/i).check()
    await page.locator('input[name="acces_velo_gpx"]').setInputFiles('tests/fixtures/velo-with-wpt.gpx')
    // Le tracé est un <path> Leaflet vert (#2e8b57) dans la carte commune
    await expect(page.locator('#map-arrets path.leaflet-interactive[stroke="#2e8b57"]')).toHaveCount(1, { timeout: 10000 })
  })

  test("en modification d'une falaise, ni l'accès à vélo ni l'accès sans vélo ne sont proposés", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php?falaise_id=39')
    await expect(page.getByLabel(/Ajouter un accès à vélo/i)).toHaveCount(0)
    await expect(page.getByLabel(/accessible sans vélo/i)).toHaveCount(0)
    await expect(page.getByText('Accès en bus', { exact: false }).first()).toBeVisible()
  })
})

test.describe("Ajout de falaise : accès à pied depuis un arrêt", () => {
  test("la sélection d'arrêts est masquée tant que la case n'est pas cochée", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')

    const case_ = page.getByLabel(/accessible sans vélo/i)
    await expect(case_).not.toBeChecked()
    await expect(page.getByRole('button', { name: /Lier un arrêt/ })).toBeHidden()
    expect(await idsSaisis(page)).toBe('')

    await case_.check()
    await expect(page.getByRole('button', { name: /Lier un arrêt/ })).toBeVisible()
  })

  test("chaque arrêt lié propose des détails facultatifs (description, km, D+, D-, GPX), envoyés avec le formulaire", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const [a, b] = await deuxArrets(page)
    await page.getByLabel(/accessible sans vélo/i).check()
    await lier(page, a)

    const details = page.getByTestId(`acces-details-${a.id}`)
    await expect(details).toBeVisible()
    await details.locator('summary').click()
    // Champs natifs du formulaire : lus par api/add_falaise.php
    await expect(details.locator(`textarea[name="acces_pieton[${a.id}][description]"]`)).toBeVisible()
    await expect(details.locator(`input[name="acces_pieton[${a.id}][km]"]`)).toBeVisible()
    await expect(details.locator(`input[name="acces_pieton[${a.id}][dplus]"]`)).toBeVisible()
    await expect(details.locator(`input[name="acces_pieton[${a.id}][dmoins]"]`)).toBeVisible()
    await expect(details.locator(`input[type=file][name="acces_gpx_${a.id}"]`)).toBeVisible()

    // Saisies conservées quand on lie un autre arrêt, et le détail disparaît avec l'arrêt retiré
    await details.locator(`input[name="acces_pieton[${a.id}][km]"]`).fill('1.5')
    await lier(page, b)
    await expect(details.locator(`input[name="acces_pieton[${a.id}][km]"]`)).toHaveValue('1.5')
    await page.getByRole('button', { name: `Retirer ${a.nom}` }).click()
    await expect(page.getByTestId(`acces-details-${a.id}`)).toHaveCount(0)
  })

  test('plusieurs arrêts peuvent être liés, puis retirés', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const [a, b] = await deuxArrets(page)
    await page.getByLabel(/accessible sans vélo/i).check()

    await lier(page, a)
    await lier(page, b)

    expect(JSON.parse(await idsSaisis(page)).sort()).toEqual([a.id, b.id].sort())

    await page.getByRole('button', { name: `Retirer ${a.nom}` }).click()
    expect(JSON.parse(await idsSaisis(page))).toEqual([b.id])
  })

  test('décocher la case vide la sélection envoyée', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const [a] = await deuxArrets(page)
    const case_ = page.getByLabel(/accessible sans vélo/i)
    await case_.check()
    await lier(page, a)
    expect(JSON.parse(await idsSaisis(page))).toEqual([a.id])

    await case_.uncheck()

    expect(await idsSaisis(page)).toBe('')
  })

  test("en modification d'une falaise, la section n'est pas proposée", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php?falaise_id=39')

    await expect(page.getByLabel(/accessible sans vélo/i)).toBeHidden()
  })

  // --- Seconde carte : lier les arrêts en les cliquant -------------------------
  // `#map-arrets` (la carte de placement de la falaise reste `#map`) : visible avec
  // la case cochée, recentrée à zoom 14 sur la falaise dès qu'elle est placée,
  // arrêts cliquables (Lier / Délier) synchronisés avec la liste. Repères :
  // `[data-arret-id]` (+ `data-linked="true"` quand lié) ; `window.arretsLiesMap`
  // expose la carte Leaflet (comme `window.map` sur la page falaise).

  /** Un arrêt sans voisin à moins de ~300 m : son marqueur ne peut pas être masqué par un autre. */
  async function arretIsole(page: Page): Promise<ArretItem & { lat: number; lng: number }> {
    const liste = (await arrets(page)).filter((a) => a.lat != null && a.lng != null) as Array<ArretItem & { lat: number; lng: number }>
    expect(liste.length, 'le catalogue doit porter lat/lng').toBeGreaterThan(1)
    const isole = liste.find((a) => liste.every((b) => b.id === a.id || Math.hypot(a.lat - b.lat, (a.lng - b.lng) * 0.7) > 0.003))
    expect(isole, 'au moins un arrêt isolé').toBeTruthy()
    return isole!
  }
  const placerFalaise = async (page: Page, lat: number, lng: number) => {
    const champ = page.locator('#falaise_latlng')
    await champ.fill(`${lat},${lng}`)
    await champ.dispatchEvent('input')
  }
  const vueCarte = (page: Page) =>
    page.evaluate(() => {
      const m = (window as any).arretsLiesMap
      return { z: m.getZoom(), lat: m.getCenter().lat, lng: m.getCenter().lng }
    })

  test('la seconde carte est masquée tant que la case n\'est pas cochée, puis affichée', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    await expect(page.locator('#map-arrets')).toBeHidden()

    await page.getByLabel(/accessible sans vélo/i).check()

    await expect(page.locator('#map-arrets.leaflet-container')).toBeVisible()
    // La carte de placement de la falaise est inchangée
    await expect(page.locator('#map.leaflet-container')).toHaveCount(1)
  })

  test('avant que la falaise soit placée, la carte invite à la placer', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    await page.getByLabel(/accessible sans vélo/i).check()

    await expect(page.locator('#map-arrets-instructions')).toContainText(/localisez d'abord la falaise/i)
  })

  test('placer la falaise recentre la seconde carte à zoom 14', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const a = await arretIsole(page)
    await page.getByLabel(/accessible sans vélo/i).check()

    await placerFalaise(page, a.lat, a.lng)

    await expect(page.locator('#map-arrets-instructions')).toBeHidden()
    await expect.poll(async () => (await vueCarte(page)).z).toBe(14)
    const v = await vueCarte(page)
    expect(Math.abs(v.lat - a.lat)).toBeLessThan(0.001)
    expect(Math.abs(v.lng - a.lng)).toBeLessThan(0.001)
  })

  test('un clic sur la carte de placement (ou un déplacement) recentre aussi la seconde', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    await page.getByLabel(/accessible sans vélo/i).check()

    // Placement par clic sur la première carte : popup de confirmation puis bouton
    await page.locator('#map').click({ position: { x: 300, y: 250 } })
    await page.getByRole('button', { name: /Placer la falaise ici/ }).click()

    await expect.poll(async () => (await vueCarte(page)).z).toBe(14)
  })

  test('cliquer un arrêt de la carte propose Lier ; la liste et le champ suivent, puis Délier', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const a = await arretIsole(page)
    await page.getByLabel(/accessible sans vélo/i).check()
    await placerFalaise(page, a.lat, a.lng)

    const marqueur = page.locator(`#map-arrets [data-arret-id="${a.id}"]`)
    await expect(marqueur).toBeVisible()
    await expect(marqueur).not.toHaveAttribute('data-linked', 'true')

    await marqueur.click()
    await page.getByRole('button', { name: /Lier cet arrêt/ }).click()

    expect(JSON.parse(await idsSaisis(page))).toEqual([a.id])
    await expect(page.getByRole('button', { name: `Retirer ${a.nom}` })).toBeVisible()
    await expect(marqueur).toHaveAttribute('data-linked', 'true')

    await marqueur.click()
    await page.getByRole('button', { name: /Délier cet arrêt/ }).click()

    expect(await idsSaisis(page)).toBe('')
    await expect(marqueur).not.toHaveAttribute('data-linked', 'true')
  })

  test('lier un arrêt par la liste met à jour son marqueur sur la carte', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const a = await arretIsole(page)
    await page.getByLabel(/accessible sans vélo/i).check()
    await placerFalaise(page, a.lat, a.lng)

    await lier(page, a)

    await expect(page.locator(`#map-arrets [data-arret-id="${a.id}"]`)).toHaveAttribute('data-linked', 'true')
    // Retirer par la liste : le marqueur redevient « non lié »
    await page.getByRole('button', { name: `Retirer ${a.nom}` }).click()
    await expect(page.locator(`#map-arrets [data-arret-id="${a.id}"]`)).not.toHaveAttribute('data-linked', 'true')
  })

  test("en modification d'une falaise, la seconde carte n'est pas proposée", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php?falaise_id=39')

    await expect(page.locator('#map-arrets')).toHaveCount(0)
  })

  test("« Infos supplémentaires » vient entre « Exposition » et « Marche d'approche »", async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    const ordre = await page.evaluate(() => {
      const titres = ['Exposition', 'Infos supplémentaires', "Marche d'approche", 'Accès à la falaise']
      return titres.map((t) => {
        const span = [...document.querySelectorAll('span.px-2.text-primary')].find((s) => s.textContent?.trim() === t)
        return span ? span.getBoundingClientRect().top + window.scrollY : -1
      })
    })
    expect(ordre.every((v) => v >= 0), 'les quatre sections existent').toBe(true)
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre) // déjà dans l'ordre : Exposition < Infos < Marche < Accès
  })
})
