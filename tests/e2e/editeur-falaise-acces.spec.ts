import { test, expect } from '@playwright/test'

/**
 * Éditeur de détails d'une falaise : le popup d'un arrêt LISTE les accès déjà décrits (vélo / sans vélo,
 * variante, chiffres) et propose TOUJOURS d'en ajouter un autre, sans vélo ou à vélo, avec un nom de variante.
 *  - « + Ajouter un accès sans vélo / à vélo » déplie un mini-formulaire (un seul ouvert à la fois), validé par
 *    « Envoyer » (api/link_arret_falaise.php) ; à vélo : km, D+, D- et trace GPX obligatoires ;
 *  - dialogue « Ajouter cet arrêt » (arrêt issu de l'import OSM) : mêmes champs, envoyés à api/add_arret.php.
 * Les réponses réseau sont simulées : l'écriture en base est couverte par tests/api.
 */

declare const L: any

const ARRET = {
  id: 9001, nom: 'Arrêt de test', types: ['ter'], lat: 45.1, lng: 5.1, linked: true, description: '', lignes: [],
  acces: [
    { acces_id: 1, type: 'velo', variante: 'Option à vélo depuis la gare', km: 12.2, dplus: 490, dmoins: 80, public: 1 },
    { acces_id: 2, type: 'pied', variante: 'Option à pied depuis la gare', km: 3.3, dplus: 450, dmoins: 90, public: 1 },
  ],
}
const ARRET_SANS_ACCES = { ...ARRET, id: 9002, nom: 'Arrêt sans accès', linked: false, acces: [] }

async function monterEditeur(page: import('@playwright/test').Page, arret = ARRET) {
  await page.goto('/ajout/ajout_velo.php') // une page qui charge le bundle Leaflet (L)
  await page.route('**/api/fetch_arrets.php*', (r) => r.fulfill({ json: { arrets: [arret] } }))
  await page.evaluate(async () => {
    const { initEditorBusStops } = await import('/js/components/map/editor-bus-stops.js')
    const el = document.createElement('div')
    el.id = 'zz-editor-map'
    el.style.height = '400px'
    document.body.prepend(el)
    const map = L.map(el).setView([45.1, 5.1], 14)
    initEditorBusStops(map, { falaiseId: 39, ensureContrib: async () => ({ nom: 'Testeur', email: 'test@example.org' }) })
  })
  await page.locator('#zz-editor-map .vg-arret-icon').first().click()
  await expect(page.locator('.leaflet-popup [data-testid="acces-existants"]')).toBeVisible()
}

test.describe("Éditeur de falaise : accès d'un arrêt", () => {
  test('le popup liste les accès déjà décrits, avec leur variante et leurs chiffres', async ({ page }) => {
    await monterEditeur(page)
    const liste = page.locator('.leaflet-popup [data-testid="acces-existants"]')
    await expect(liste).toContainText('Option à vélo depuis la gare')
    await expect(liste).toContainText('12.2 km, 490 D+, 80 D-')
    await expect(liste).toContainText('Option à pied depuis la gare')
    await expect(liste).toContainText('3.3 km, 450 D+, 90 D-')
  })

  test("sans accès : le dit, et propose quand même les deux ajouts", async ({ page }) => {
    await monterEditeur(page, ARRET_SANS_ACCES)
    await expect(page.locator('.leaflet-popup [data-testid="acces-existants"]')).toContainText('Aucun accès décrit')
    await expect(page.getByTestId('acces-form-pied').locator('summary')).toContainText('Ajouter un accès sans vélo')
    await expect(page.getByTestId('acces-form-velo').locator('summary')).toContainText('Ajouter un accès à vélo')
    await expect(page.locator('.leaflet-popup .supprimer-acces'), 'rien à supprimer').toHaveCount(0)
  })

  test("un arrêt déjà relié propose TOUJOURS d'ajouter un accès", async ({ page }) => {
    await monterEditeur(page)
    await expect(page.getByTestId('acces-form-pied')).toBeVisible()
    await expect(page.getByTestId('acces-form-velo')).toBeVisible()
    await expect(page.locator('.leaflet-popup .unlink-bus-btn'), 'plus de bouton « Délier »').toHaveCount(0)
  })

  test("une corbeille à côté de chaque accès SANS vélo (pas des accès à vélo), avec confirmation", async ({ page }) => {
    const envois: Array<Record<string, unknown>> = []
    await page.route('**/api/link_arret_falaise.php', (r) => {
      envois.push(r.request().postDataJSON())
      return r.fulfill({ json: { success: true, linked: false } })
    })
    await monterEditeur(page)
    const lignes = page.locator('.leaflet-popup [data-testid="acces-existants"] li')
    await expect(lignes.filter({ hasText: 'Option à vélo' }).locator('.supprimer-acces')).toHaveCount(0)
    const corbeille = lignes.filter({ hasText: 'Option à pied' }).locator('.supprimer-acces')
    await expect(corbeille).toHaveCount(1)
    await expect(corbeille.locator('svg use')).toHaveAttribute('href', '#trash')

    // Confirmation refusée : rien n'est envoyé
    let message = ''
    page.once('dialog', (d) => { message = d.message(); void d.dismiss() })
    await corbeille.click()
    await expect.poll(() => message).toMatch(/Supprimer l'accès sans vélo/)
    expect(message).toContain('Option à pied depuis la gare')
    expect(envois).toHaveLength(0)

    // Confirmation acceptée : suppression de CET accès seulement
    page.once('dialog', (d) => void d.accept())
    await corbeille.click()
    await expect.poll(() => envois.length).toBe(1)
    expect(envois[0]).toMatchObject({ arret_id: 9001, falaise_id: 39, action: 'unlink', acces_id: 2 })
  })

  test("un seul mini-formulaire est ouvert à la fois", async ({ page }) => {
    await monterEditeur(page)
    const pied = page.getByTestId('acces-form-pied')
    const velo = page.getByTestId('acces-form-velo')
    await pied.locator('summary').click()
    await expect(pied).toHaveAttribute('open', '')
    await velo.locator('summary').click()
    await expect(velo).toHaveAttribute('open', '')
    await expect(pied).not.toHaveAttribute('open', '')
  })

  test('accès sans vélo : variante et détails envoyés (variante toujours présente, même vide)', async ({ page }) => {
    const envois: Array<Record<string, unknown>> = []
    await page.route('**/api/link_arret_falaise.php', (r) => {
      envois.push(r.request().postDataJSON())
      return r.fulfill({ json: { success: true, linked: true, acces_id: 3 } })
    })
    await monterEditeur(page)

    const form = page.getByTestId('acces-form-pied')
    await form.locator('summary').click()
    await form.locator('.acces-variante').fill('Par le sentier')
    await form.locator('.acces-description').fill('Sentier du lavoir')
    await form.locator('.acces-km').fill('1.4')
    await form.locator('.acces-dplus').fill('90')
    await form.locator('.acces-envoyer').click()
    await expect.poll(() => envois.length).toBe(1)
    expect(envois[0]).toMatchObject({ arret_id: 9001, falaise_id: 39, action: 'link', type: 'pied', variante: 'Par le sentier', description: 'Sentier du lavoir', km: '1.4', dplus: '90' })
  })

  test("accès à vélo : km, D+, D- et trace GPX obligatoires, puis envoi en multipart", async ({ page }) => {
    const envois: Array<{ multipart: boolean; corps: string }> = []
    await page.route('**/api/link_arret_falaise.php', (r) => {
      const req = r.request()
      envois.push({ multipart: (req.headers()['content-type'] || '').startsWith('multipart/form-data'), corps: req.postData() || '' })
      return r.fulfill({ json: { success: true, linked: true, acces_id: 4 } })
    })
    await monterEditeur(page)
    const form = page.getByTestId('acces-form-velo')
    await form.locator('summary').click()

    // Incomplet : refus côté client, rien n'est envoyé
    const messages: string[] = []
    page.on('dialog', (d) => { messages.push(d.message()); void d.accept() })
    await form.locator('.acces-km').fill('6.5')
    await form.locator('.acces-envoyer').click()
    await expect.poll(() => messages.length).toBe(1)
    expect(messages[0]).toMatch(/obligatoires/)
    expect(envois).toHaveLength(0)

    await form.locator('.acces-dplus').fill('220')
    await form.locator('.acces-dmoins').fill('90')
    await form.locator('.acces-variante').fill('Par le Nord')
    await form.locator('.acces-gpx').setInputFiles('tests/fixtures/velo-with-wpt.gpx')
    await form.locator('.acces-envoyer').click()
    await expect.poll(() => envois.length).toBe(1)
    expect(envois[0].multipart).toBe(true)
    expect(envois[0].corps).toContain('name="type"')
    expect(envois[0].corps).toContain('velo')
    expect(envois[0].corps).toContain('Par le Nord')
    expect(envois[0].corps).toContain('name="gpx_file"')
  })
})

test.describe("Dialogue « Ajouter cet arrêt » (import OSM) : accès à pied vers la falaise", () => {
  async function ouvrir(page: import('@playwright/test').Page) {
    await page.goto('/ajout/edit_details_falaise.php?falaise_id=39')
    await page.waitForSelector('.leaflet-container')
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('velogrimpe:bus-dialog:open', {
          detail: { nom: 'Arrêt OSM test', loc: '45.1,5.1', falaise_id: 39, falaise_nom: 'Pont de Barret', types: ['bus'], contrib_nom: 'Testeur', contrib_email: 'test@example.org' },
        }),
      )
    })
  }

  test("propose les détails de l'accès à pied vers la falaise, avec la trace GPS", async ({ page }) => {
    await ouvrir(page)
    const bloc = page.getByTestId('bus-dialog-acces')
    await expect(bloc).toBeVisible()
    await expect(bloc).toContainText('Pont de Barret')
    await expect(bloc.locator('textarea[name="acces_pieton[39][description]"]')).toBeVisible()
    await expect(bloc.locator('input[name="acces_pieton[39][km]"]')).toBeVisible()
    await expect(bloc.locator('input[type=file][name="acces_gpx_39"]')).toBeVisible()
  })

  test("envoie les détails en JSON, ou en multipart avec une trace GPX", async ({ page }) => {
    const envois: Array<{ multipart: boolean; corps: string }> = []
    await page.route('**/api/add_arret.php', (r) => {
      const req = r.request()
      envois.push({ multipart: (req.headers()['content-type'] || '').startsWith('multipart/form-data'), corps: req.postData() || '' })
      return r.fulfill({ json: { success: true, arret_id: 9999 } })
    })
    await ouvrir(page)
    const bloc = page.getByTestId('bus-dialog-acces')
    await bloc.locator('input[name="acces_pieton[39][km]"]').fill('2.2')
    await page.getByRole('button', { name: "Ajouter l'arrêt de bus" }).click()
    await expect.poll(() => envois.length).toBe(1)
    expect(envois[0].multipart).toBe(false)
    expect(JSON.parse(envois[0].corps).falaises_acces).toEqual({ '39': { variante: '', description: '', km: '2.2', dplus: '', dmoins: '' } })

    await ouvrir(page)
    await page.getByTestId('bus-dialog-acces').locator('input[type=file]').setInputFiles('tests/fixtures/velo-with-wpt.gpx')
    await page.getByRole('button', { name: "Ajouter l'arrêt de bus" }).click()
    await expect.poll(() => envois.length).toBe(2)
    expect(envois[1].multipart).toBe(true)
    expect(envois[1].corps).toContain('name="acces_gpx_39"')
    expect(envois[1].corps).toContain('name="payload"')
  })
})
