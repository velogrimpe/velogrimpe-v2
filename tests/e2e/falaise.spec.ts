import { test, expect } from '@playwright/test'

test.describe('Falaise page', () => {
  // Use a known falaise ID for testing
  const testFalaiseId = 39 // Pont de Barret (mentioned in docs)

  test('falaise page loads with content', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Page should have title with falaise name or site name
    await expect(page).toHaveTitle(/Escalade|Velogrimpe/i)

    // Body content should be visible
    await expect(page.locator('body')).toBeVisible()
  })

  test('falaise page shows key information', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Should display falaise details (cotations, exposition, etc.)
    const content = page.locator('main')

    // Look for typical falaise info sections
    await expect(content).toContainText(/cotation|voies|exposition/i)
  })

  test('falaise page has a map', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Map should be present
    const map = page.locator('#map, .leaflet-container')
    await expect(map.first()).toBeVisible()
  })

  test('la source ne publie pas les emails des contributeurs', async ({ request }) => {
    const html = await (await request.get(`/falaise.php?falaise_id=${testFalaiseId}`)).text()

    // Ni falaise_contrib ni velo_contrib ("'Nom','email'") dans le JSON injecté
    expect(html).not.toMatch(/_contrib"/)
    const data = html.match(/const (falaise|itineraires) = .*;$/gm) ?? []
    expect(data).toHaveLength(2)
    for (const line of data) {
      expect(line).not.toContain('@')
    }

    // Le nom du contributeur reste affiché
    expect(html).toMatch(/Falaise ajoutée par\s+\S/)
  })

  test('la carte affiche les itinéraires vélo et leurs gares', async ({ page }) => {
    // falaise / itineraires ne portent plus que les champs lus par la carte :
    // un champ manquant se traduit par une exception JS ou un tracé absent.
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Tracé GPX chargé (chemin issu de gpx_path) + étiquette de temps (calculate_time)
    await expect(page.locator('.vg-velo-tooltip').first()).toBeVisible()
    await expect(page.locator('.vg-velo-tooltip').first()).toHaveText(/\d/)
    await expect(page.locator('.leaflet-marker-icon.train-icon').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('ville selector works', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Le choix d'une ville de départ recharge la page sur cette ville.
    const villeSelector = page.locator('select[name="ville_id"]')
    await expect(villeSelector).toBeVisible()

    const villes = villeSelector.locator('option[value]:not([value=""])')
    expect(await villes.count()).toBeGreaterThan(0)

    const villeId = await villes.first().getAttribute('value')
    await villeSelector.selectOption(villeId!)
    await expect(page).toHaveURL(new RegExp(`ville_id=${villeId}`))
  })

  test('le formulaire de récit reprend nom/email mémorisés', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${testFalaiseId}`)

    // Infos contributeur déjà mémorisées par un précédent formulaire de contribution
    await page.evaluate(() => {
      localStorage.setItem('velogrimpe_contrib_nom', 'Jeanne Grimpe')
      localStorage.setItem('velogrimpe_contrib_email', 'jeanne@example.com')
    })
    await page.reload()

    await page.getByRole('button', { name: /Raconter ma sortie/i }).click()

    await expect(page.locator('#nom')).toHaveValue('Jeanne Grimpe')
    await expect(page.locator('#email')).toHaveValue('jeanne@example.com')

    // Le dialogue de vérification d'email est lui aussi pré-rempli
    await page.locator('#commentFormModal .btn.btn-outline').click()
    const editButton = page.locator('#comments button[onclick^="editComment"]').first()
    if (await editButton.count()) {
      await editButton.click()
      await expect(page.locator('#emailPromptEmail')).toHaveValue('jeanne@example.com')
    }
  })
})
