import { test, expect } from '@playwright/test'

test.describe('Ajout Falaise form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
  })

  test('form page loads', async ({ page }) => {
    await expect(page).toHaveTitle(/Ajouter.*falaise/i)

    // Form should be visible
    await expect(page.locator('form#form')).toBeVisible()
  })

  test('Vue autocomplete component is mounted', async ({ page }) => {
    // Wait for Vue to mount
    await page.waitForSelector('#vue-ajout-falaise')

    // The autocomplete input should be functional (use first() for strict mode)
    const autocompleteInput = page.locator('#vue-ajout-falaise input[type="text"]').first()
    await expect(autocompleteInput).toBeVisible()

    // Le champ est readonly tant qu'il n'a pas le focus (protection anti-autofill,
    // cf. Autocomplete.vue) : on clique avant d'écrire.
    await autocompleteInput.click()
    await autocompleteInput.fill('test')

    // Input should have the value
    await expect(autocompleteInput).toHaveValue('test')
  })

  test('map is interactive', async ({ page }) => {
    // Wait for map - Leaflet adds class directly to #map
    await page.waitForSelector('#map.leaflet-container', { timeout: 15000 })

    // Wait for tiles to load
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 10000 })

    // Map should be visible
    await expect(page.locator('#map.leaflet-container')).toBeVisible()

    // Zoom controls should work
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await expect(zoomIn).toBeVisible()
  })

  test('required fields are marked', async ({ page }) => {
    // Le formulaire vide ne part pas…
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/ajout_falaise/)

    // …et c'est bien la validation qui l'en empêche : au moins un champ
    // obligatoire est en erreur.
    const invalides = page.locator('form#form :invalid')
    expect(await invalides.count()).toBeGreaterThan(0)
  })

  test('exposition selectors work', async ({ page }) => {
    await page.waitForSelector('#vue-exposhort1')
    const expo = page.locator('#vue-exposhort1')

    // Le champ ouvre une liste d'orientations…
    await expo.click()
    const options = expo.locator('.absolute .badge')
    await expect(options.first()).toBeVisible()

    // …et le choix alimente le champ envoyé au serveur (valeurs entre
    // apostrophes, comme les attend l'insertion : 'N', 'N','E'…).
    const choisie = (await options.first().textContent())?.trim() ?? ''
    await options.first().click()
    await expect(expo.locator('input[name="falaise_exposhort1"]')).toHaveValue(
      new RegExp(`'${choisie}'`),
    )
  })

  test('rose des vents preview updates', async ({ page }) => {
    // Wait for rose preview component
    const rosePreview = page.locator('#vue-rose-preview')
    await expect(rosePreview).toBeVisible()
  })
})

test.describe('Ajout Falaise - form validation', () => {
  test('coordinates input accepts valid format', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')

    // Fill valid coordinates format
    const coordsInput = page.locator('#falaise_latlng')
    await coordsInput.fill('44.5,5.5')

    // Input should have the value
    await expect(coordsInput).toHaveValue('44.5,5.5')
  })
})

test.describe('Ajout Falaise : édition d\'une falaise existante', () => {
  // Champs relus par fetchAndPrefillData (ajout/ajout_falaise.php) dans la
  // réponse de /api/fetch_falaise.php, qui ne liste plus ses colonnes par SELECT *
  const CHAMPS_PREREMPLIS = [
    'falaise_id', 'falaise_nom', 'falaise_nomformate', 'falaise_latlng',
    'falaise_zonename', 'falaise_deptname', 'falaise_deptcode',
    'falaise_cottxt', 'falaise_cotmin', 'falaise_cotmax',
    'falaise_expotxt', 'falaise_exposhort1', 'falaise_exposhort2',
    'falaise_voies', 'falaise_nbvoies', 'falaise_topo', 'falaise_matxt', 'falaise_maa', 'falaise_mar',
    'falaise_gvtxt', 'falaise_gvnb', 'falaise_bloc', 'falaise_rq', 'falaise_hebergement', 'falaise_acces_bus',
    'falaise_txt1', 'falaise_txt2', 'falaise_txt3', 'falaise_txt4',
    'falaise_leg1', 'falaise_leg2', 'falaise_leg3', 'falaise_fermee', 'falaise_voletcarto',
  ]
  const falaiseId = 39

  test('fetch_falaise renvoie les champs du formulaire, sans le contributeur', async ({ request }) => {
    const falaise = await (await request.get(`/api/fetch_falaise.php?falaise_id=${falaiseId}`)).json()
    for (const champ of CHAMPS_PREREMPLIS) expect(falaise, champ).toHaveProperty(champ)
    expect(falaise).not.toHaveProperty('falaise_contrib')
  })

  test('le formulaire est prérempli avec la falaise', async ({ page, request }) => {
    const falaise = await (await request.get(`/api/fetch_falaise.php?falaise_id=${falaiseId}`)).json()
    await page.goto(`/ajout/ajout_falaise.php?falaise_id=${falaiseId}`)

    await expect(page.locator('#confirmButton')).toHaveText(/Modifier la falaise/)
    await expect(page.locator('#falaise_latlng')).toHaveValue(falaise.falaise_latlng)
    await expect(page.locator('#falaise_cotmin')).toHaveValue(falaise.falaise_cotmin)
    await expect(page.locator('#falaise_maa')).toHaveValue(String(falaise.falaise_maa))

    // Un champ absent de la réponse se préremplit en "undefined"
    const valeurs = await page.locator('#form input, #form select, #form textarea')
      .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
    expect(valeurs).not.toContain('undefined')
  })
})
