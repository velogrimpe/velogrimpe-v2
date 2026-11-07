import { test, expect, Page } from '@playwright/test'
import { closeSync, openSync, readFileSync, rmSync, ftruncateSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Formulaire admin de ligne BTT (ajout_ligne.php, Lot 7) : import GTFS, tracé
 * à la main, arrêts liés, création / édition / suppression.
 *
 * Le rendu visuel (couleur, halo, snapping geoman) reste vérifié à la main
 * (checklist du plan) ; ici : contrat des champs, flux d'import, persistance.
 */

const ROOT = resolve(__dirname, '../..')
const ADMIN_TOKEN = /['"]admin_token['"]\s*=>\s*['"]([^'"]+)['"]/.exec(readFileSync(resolve(ROOT, 'config.php'), 'utf8'))![1]
const GTFS_ZIP = resolve(ROOT, 'assets/gtfs_savoie.zip')
const URL_ADMIN = `/ajout/ajout_ligne.php?admin=${encodeURIComponent(ADMIN_TOKEN)}`
const BEARER = { Authorization: `Bearer ${ADMIN_TOKEN}` }

const GEOMETRY = {
  type: 'MultiLineString',
  coordinates: [[[5.38, 43.82], [5.39, 43.83], [5.4, 43.835]]],
}

/** Lignes créées pendant un test, supprimées en fin de test. */
const created: number[] = []
test.afterEach(async ({ request }) => {
  while (created.length) {
    const id = created.pop()!
    await request.post('/api/delete_ligne.php', { headers: BEARER, data: { ligne_id: id } })
  }
})

async function createViaApi(request: any, data: Record<string, unknown> = {}): Promise<number> {
  const res = await request.post('/api/add_ligne.php', {
    data: { nom: 'PHPUnit e2e - Ligne', numero: 'E2E', couleur: '#123456', geometry: GEOMETRY, arret_ids: [], ...data },
  })
  const id = (await res.json()).ligne_id as number
  created.push(id)
  return id
}

async function firstArrets(page: Page, n: number) {
  await page.waitForFunction(() => !!(window as any).ligneArrets)
  return page.evaluate((n) => (window as any).ligneArrets.slice(0, n) as { id: number; nom: string }[], n)
}

test.describe('ajout_ligne.php — accès', () => {
  test('sans jeton admin : formulaire accessible, pas de bouton Supprimer', async ({ page, request }) => {
    const res = await page.goto('/ajout/ajout_ligne.php')
    expect(res!.status()).toBe(200)
    await expect(page.locator('form#form')).toBeVisible()

    const id = await createViaApi(request, { nom: 'PHPUnit e2e - Sans admin' })
    await page.goto(`/ajout/ajout_ligne.php?ligne_id=${id}`)
    await expect(page.locator('#ligne_nom')).toHaveValue('PHPUnit e2e - Sans admin')
    await expect(page.locator('#btn-delete')).toHaveCount(0)
  })

  test('avec jeton admin : formulaire, carte et arrêts affichés', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await expect(page.locator('form#form')).toBeVisible()
    await expect(page.locator('#ligne-map')).toBeVisible()
    await expect(page.locator('.vg-ligne-arret').first()).toBeAttached()
  })
})

test.describe('ajout_ligne.php — rendu de la carte selon le zoom', () => {
  const zoomer = async (page: Page, z: number) => {
    await page.evaluate((z) => (window as any).ligneMap.setView([45.2, 5.7], z, { animate: false }), z)
    await page.waitForTimeout(300)
  }
  const classeArret = (page: Page, id: number) =>
    page.locator(`.vg-ligne-arret[data-arret-id="${id}"]`).first().getAttribute('class')

  test('gares ter/tgv : point jusqu\'au zoom 12, icône au-delà ; les autres arrêts gardent l\'icône', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.waitForFunction(() => !!(window as any).ligneArrets)
    const { gare, bus } = await page.evaluate(() => {
      const a = (window as any).ligneArrets as { id: number; types: string[] }[]
      return {
        gare: a.find((x) => x.types.includes('ter') || x.types.includes('tgv'))!.id,
        bus: a.find((x) => x.types.length === 1 && x.types[0] === 'bus')!.id,
      }
    })
    await zoomer(page, 12)
    expect(await classeArret(page, gare)).toContain('vg-arret-dot')
    expect(await classeArret(page, bus)).toContain('vg-arret-icon')
    await zoomer(page, 13)
    expect(await classeArret(page, gare)).toContain('vg-arret-icon')
    await zoomer(page, 8)
    expect(await classeArret(page, gare)).toContain('vg-arret-dot')
  })

  test('un point de gare reste cliquable et peut être lié à la ligne', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.waitForFunction(() => !!(window as any).ligneArrets)
    const gare = await page.evaluate(() => (window as any).ligneArrets.find((x: any) => x.types.includes('ter')))
    await page.evaluate((g) => (window as any).ligneMap.setView([g.lat, g.lng], 11, { animate: false }), gare)
    await page.waitForTimeout(300)
    await page.locator(`.vg-ligne-arret[data-arret-id="${gare.id}"]`).click()
    await page.getByRole('button', { name: 'Lier à la ligne' }).click()
    await expect(page.locator('#ligne_arret_ids')).toHaveValue(String(gare.id))
  })

  test('falaises : point vert jusqu\'au zoom 12, icône de falaise au-delà', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.waitForFunction(() => !!(window as any).ligneFalaises)
    const n = await page.evaluate(() => (window as any).ligneFalaises.length)
    expect(n).toBeGreaterThan(10)

    await zoomer(page, 12)
    await expect(page.locator('.vg-ligne-falaise-dot')).toHaveCount(n)
    await expect(page.locator('.vg-ligne-falaise-icon')).toHaveCount(0)
    const fond = await page.locator('.vg-ligne-falaise-dot div').first().evaluate((e) => getComputedStyle(e).backgroundColor)
    expect(fond).toMatch(/^rgb\((\d+), (\d+), (\d+)\)$/)
    const [, r, g, b] = fond.match(/^rgb\((\d+), (\d+), (\d+)\)$/)!.map(Number)
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)

    await zoomer(page, 13)
    await expect(page.locator('.vg-ligne-falaise-icon')).toHaveCount(n)
    await expect(page.locator('.vg-ligne-falaise-dot')).toHaveCount(0)
  })

  test('les falaises ne gênent pas le tracé : non cliquables pour le tracé geoman', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.waitForFunction(() => !!(window as any).ligneFalaises)
    await zoomer(page, 13)
    const sansIgnore = await page.evaluate(() =>
      Object.values((window as any).ligneMap._layers).filter((l: any) => l.options?.icon?.options?.className?.includes('vg-ligne-falaise') && !l.options.pmIgnore).length,
    )
    expect(sansIgnore).toBe(0)
  })
})

test.describe('ajout_ligne.php — contrôles de la carte, halo et édition du tracé', () => {
  const SHAPES_3PTS =
    'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nZ,45.00,5.00,0\nZ,45.02,5.02,1\nZ,45.00,5.04,2\nZ,45.02,5.06,3\n'
  const importerShapes = async (page: Page) => {
    await page.locator('#shapes-file').setInputFiles({ name: 'shapes.txt', mimeType: 'text/plain', buffer: Buffer.from(SHAPES_3PTS) })
    await expect.poll(async () => (await page.locator('#ligne_geometry').inputValue()) !== '').toBe(true)
  }
  const geometrie = async (page: Page) => JSON.parse(await page.locator('#ligne_geometry').inputValue())
  const sommets = (page: Page) => page.locator('.leaflet-marker-icon.marker-icon:not(.marker-icon-middle)')

  test('les contrôles Leaflet (+/-, attribution) ne prennent pas le vert des liens du site', async ({ page }) => {
    await page.goto(URL_ADMIN)
    const couleurs = await page.evaluate(() =>
      ['.leaflet-control-zoom-in', '.leaflet-control-attribution a', '.leaflet-control-layers-toggle'].map((s) => getComputedStyle(document.querySelector(s)!).color),
    )
    for (const c of couleurs) expect(c).not.toBe('rgb(46, 139, 87)')
  })

  test('« Montrer / Importer les arrêts » sont dans le cadre de la carte, actifs une fois une ligne GTFS choisie', async ({ page }) => {
    await page.goto(URL_ADMIN)
    for (const id of ['gtfs-show-stops', 'gtfs-import-stops']) {
      await expect(page.locator(`div:has(> #btn-draw) #${id}`)).toHaveCount(1)
      await expect(page.locator(`#${id}`)).toBeDisabled()
    }
    await choisirLigneGtfs(page, 'S01')
    for (const id of ['gtfs-show-stops', 'gtfs-import-stops']) await expect(page.locator(`#${id}`)).toBeEnabled()
    await page.locator('#gtfs-routes').selectOption('')
    await expect(page.locator('#gtfs-show-stops')).toBeDisabled()
  })

  test('le tracé a un halo blanc sous la ligne colorée', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.locator('#ligne_couleur').fill('#ff0000')
    await importerShapes(page)
    const halo = page.locator('#ligne-map path.vg-ligne-halo')
    const trait = page.locator('#ligne-map path.vg-ligne-geometry')
    await expect(halo).toHaveCount(1)
    await expect(trait).toHaveCount(1)
    expect(await halo.evaluate((e) => getComputedStyle(e).stroke)).toBe('rgb(255, 255, 255)')
    const [wHalo, wTrait] = await Promise.all([
      halo.evaluate((e) => parseFloat(getComputedStyle(e).strokeWidth)),
      trait.evaluate((e) => parseFloat(getComputedStyle(e).strokeWidth)),
    ])
    expect(wHalo).toBeGreaterThan(wTrait)
    // Le halo est dessiné avant (donc sous) le trait
    expect(await halo.evaluate((e, t) => !!(e.compareDocumentPosition(t as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await trait.elementHandle())).toBe(true)
  })

  test('« Modifier le tracé » : on reprend un sommet en le déplaçant, la géométrie est mise à jour', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await expect(page.locator('#btn-edit-geometry')).toBeDisabled() // pas de tracé à modifier
    await importerShapes(page)
    await expect(page.locator('#btn-edit-geometry')).toBeEnabled()
    const avant = await geometrie(page)

    await page.locator('#btn-edit-geometry').click()
    await expect(page.locator('#btn-edit-geometry')).toHaveAttribute('aria-pressed', 'true')
    await expect(sommets(page)).toHaveCount(4)

    const box = (await sommets(page).nth(1).boundingBox())!
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 25, y + 40, { steps: 8 })
    await page.mouse.up()

    await expect.poll(async () => JSON.stringify((await geometrie(page)).coordinates[0][1])).not.toBe(JSON.stringify(avant.coordinates[0][1]))
    const apres = await geometrie(page)
    expect(apres.coordinates[0]).toHaveLength(4)
    expect(apres.coordinates[0][0]).toEqual(avant.coordinates[0][0]) // les autres sommets ne bougent pas
    // Le halo suit le trait modifié
    const haloD = await page.locator('#ligne-map path.vg-ligne-halo').getAttribute('d')
    const traitD = await page.locator('#ligne-map path.vg-ligne-geometry').getAttribute('d')
    expect(haloD).toBe(traitD)
  })

  test('« Modifier le tracé » : clic droit sur un sommet le supprime', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await importerShapes(page)
    await page.locator('#btn-edit-geometry').click()
    await expect(sommets(page)).toHaveCount(4)
    await sommets(page).nth(1).click({ button: 'right' })
    await expect.poll(async () => (await geometrie(page)).coordinates[0].length).toBe(3)
  })

  test('quitter le mode édition fige le tracé ; tracer ou importer désactive le mode édition', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await importerShapes(page)
    await page.locator('#btn-edit-geometry').click()
    await expect(sommets(page)).toHaveCount(4)
    await page.locator('#btn-edit-geometry').click()
    await expect(page.locator('#btn-edit-geometry')).toHaveAttribute('aria-pressed', 'false')
    await expect(sommets(page)).toHaveCount(0)

    await page.locator('#btn-edit-geometry').click()
    await page.locator('#btn-draw').click()
    await expect(page.locator('#btn-edit-geometry')).toHaveAttribute('aria-pressed', 'false')
  })

  test('un sommet déplacé sur un arrêt s\'y accroche et lie l\'arrêt à la ligne', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.waitForFunction(() => !!(window as any).ligneArrets)
    const arret = await page.evaluate(() => (window as any).ligneArrets.find((a: any) => a.types.length === 1 && a.types[0] === 'bus'))
    // Tracé de 3 sommets autour de l'arrêt (≈ 150 m), dont aucun n'est sur l'arrêt
    const d = 0.0015
    const shapes = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nZ,${arret.lat - d},${arret.lng - d},0\nZ,${arret.lat + d},${arret.lng - d},1\nZ,${arret.lat + d},${arret.lng + d},2\n`
    await page.locator('#shapes-file').setInputFiles({ name: 'shapes.txt', mimeType: 'text/plain', buffer: Buffer.from(shapes) })
    await expect.poll(async () => (await page.locator('#ligne_geometry').inputValue()) !== '').toBe(true)
    await page.evaluate((a) => (window as any).ligneMap.setView([a.lat, a.lng], 17, { animate: false }), arret)
    await page.waitForTimeout(400)

    await page.locator('#btn-edit-geometry').click()
    const cible = (await page.locator(`.vg-ligne-arret[data-arret-id="${arret.id}"]`).boundingBox())!
    const sommet = (await sommets(page).nth(1).boundingBox())!
    const sx = sommet.x + sommet.width / 2, sy = sommet.y + sommet.height / 2
    // Arrivée à quelques pixels de l'arrêt : l'accrochage doit finir le travail
    const tx = cible.x + cible.width / 2 + 6, ty = cible.y + cible.height / 2 + 6
    await page.mouse.move(sx, sy)
    await page.mouse.down()
    await page.mouse.move(tx, ty, { steps: 12 })
    await page.mouse.up()

    await expect(page.locator('#ligne_arret_ids')).toHaveValue(String(arret.id))
    const g = await geometrie(page)
    expect(g.coordinates[0][1][1]).toBeCloseTo(arret.lat, 5) // accroché exactement à l'arrêt
    expect(g.coordinates[0][1][0]).toBeCloseTo(arret.lng, 5)
  })

  test('tracé à la main : un clic près d\'un arrêt s\'accroche à lui et le lie ; les arrêts ne sont pas déplaçables', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.waitForFunction(() => !!(window as any).ligneArrets)
    const arret = await page.evaluate(() => (window as any).ligneArrets.find((a: any) => a.types.length === 1 && a.types[0] === 'bus'))
    await page.evaluate((a) => (window as any).ligneMap.setView([a.lat, a.lng], 17, { animate: false }), arret)
    await page.waitForTimeout(400)
    await page.locator('#btn-draw').click()
    await page.locator('#ligne-map').scrollIntoViewIfNeeded()

    const cible = (await page.locator(`.vg-ligne-arret[data-arret-id="${arret.id}"]`).boundingBox())!
    const cx = cible.x + cible.width / 2, cy = cible.y + cible.height / 2
    // Clics hors de tout autre marqueur : à gauche, près de l'arrêt (6 px), puis à droite
    await page.mouse.click(cx - 120, cy + 60)
    await page.mouse.click(cx + 6, cy + 6)
    await page.mouse.click(cx + 120, cy + 60)
    await page.mouse.click(cx + 120, cy + 60) // fin du tracé

    await expect.poll(async () => (await page.locator('#ligne_geometry').inputValue()) !== '').toBe(true)
    const g = await geometrie(page)
    expect(g.coordinates[0]).toHaveLength(3)
    expect(g.coordinates[0][1][1]).toBeCloseTo(arret.lat, 5)
    expect(g.coordinates[0][1][0]).toBeCloseTo(arret.lng, 5)
    await expect(page.locator('#ligne_arret_ids')).toHaveValue(String(arret.id))

    // Mode édition du tracé actif : les marqueurs d'arrêts restent fixes
    await page.locator('#btn-edit-geometry').click()
    const deplacables = await page.evaluate(() =>
      Object.values((window as any).ligneMap._layers).filter((l: any) => l.getLatLng && l.options?.draggable && l.options?.icon?.options?.className?.includes('vg-ligne-arret')).length,
    )
    expect(deplacables).toBe(0)
  })

  test('« Effacer le tracé » désactive le mode édition', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await importerShapes(page)
    await page.locator('#btn-edit-geometry').click()
    await page.locator('#btn-clear-geometry').click()
    await expect(page.locator('#btn-edit-geometry')).toBeDisabled()
    await expect(page.locator('#btn-edit-geometry')).toHaveAttribute('aria-pressed', 'false')
    expect(await page.locator('#ligne_geometry').inputValue()).toBe('')
  })
})

test.describe('ajout_ligne.php — import GTFS', () => {
  test('liste les lignes de routes.txt et remplit le formulaire + la carte', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.locator('#gtfs-file').setInputFiles(GTFS_ZIP)

    const options = page.locator('#gtfs-routes option:not([value=""])')
    await expect(options).toHaveCount(20)

    await page.locator('#gtfs-routes').selectOption({ label: 'S01 — ST-ALBAN DE MONTBEL < > CHAMBÉRY' })
    await page.locator('#gtfs-import').click()

    await expect(page.locator('#ligne_numero')).toHaveValue('S01')
    await expect(page.locator('#ligne_nom')).toHaveValue(/CHAMBÉRY/)
    await expect(page.locator('#ligne_couleur')).toHaveValue('#DE5202')
    await expect(page.locator('#ligne_operateur')).toHaveValue(/cars Région Savoie/)
    await expect(page.locator('#ligne_operateur_url')).toHaveValue(/^https?:\/\//)
    await expect(page.locator('#ligne_ref')).toHaveValue('SAVOIE:Line:1007045:LOC')

    const geometry = JSON.parse(await page.locator('#ligne_geometry').inputValue())
    expect(geometry.type).toBe('MultiLineString')
    expect(geometry.coordinates.length).toBeGreaterThan(0)
    await expect(page.locator('.vg-ligne-geometry').first()).toBeAttached()
  })

  test('un zip de plus de 200 Mo est refusé, avec un conseil pour réduire le GTFS', async ({ page }) => {
    // Fichier creux de 201 Mo (un buffer Playwright est limité à 50 Mo) : seule sa taille compte
    const gros = resolve(tmpdir(), `gros-gtfs-${process.pid}.zip`)
    const fd = openSync(gros, 'w')
    ftruncateSync(fd, 201 * 1024 * 1024)
    closeSync(fd)
    try {
      await page.goto(URL_ADMIN)
      await page.locator('#gtfs-file').setInputFiles(gros)
    } finally {
      rmSync(gros, { force: true })
    }
    const erreur = page.locator('#gtfs-error')
    await expect(erreur).toBeVisible()
    await expect(erreur).toContainText('200 Mo')
    await expect(erreur.locator('a[href*="transport.data.gouv.fr"]')).toHaveCount(1)
    await expect(page.locator('#gtfs-choose')).toBeHidden()
  })

  test('un fichier qui n\'est pas un GTFS affiche une erreur sans casser le formulaire', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.locator('#gtfs-file').setInputFiles({ name: 'x.zip', mimeType: 'application/zip', buffer: Buffer.from('pas un zip') })
    await expect(page.locator('#gtfs-error')).toBeVisible()
    await expect(page.locator('form#form')).toBeVisible()
  })

  test('« Importer shapes.txt » remplace la géométrie', async ({ page }) => {
    await page.goto(URL_ADMIN)
    const shapes = 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nZ,45.0,5.0,0\nZ,45.1,5.1,1\n'
    await page.locator('#shapes-file').setInputFiles({ name: 'shapes.txt', mimeType: 'text/plain', buffer: Buffer.from(shapes) })
    await expect.poll(async () => (await page.locator('#ligne_geometry').inputValue()) !== '').toBe(true)
    const geometry = JSON.parse(await page.locator('#ligne_geometry').inputValue())
    expect(geometry).toEqual({ type: 'MultiLineString', coordinates: [[[5.0, 45.0], [5.1, 45.1]]] })
  })
})

test.describe('ajout_ligne.php — tracé à la main', () => {
  test('« Tracer à la main » enregistre un trait posé au clic', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await page.waitForFunction(() => !!(window as any).ligneMap)
    await page.evaluate(() => (window as any).ligneMap.setView([46.0, 2.0], 6))
    await page.locator('#btn-draw').click()

    await page.locator('#ligne-map').scrollIntoViewIfNeeded()
    const box = (await page.locator('#ligne-map').boundingBox())!
    const pts = [
      [box.x + box.width * 0.4, box.y + box.height * 0.5],
      [box.x + box.width * 0.5, box.y + box.height * 0.55],
      [box.x + box.width * 0.6, box.y + box.height * 0.5],
    ]
    for (const [x, y] of pts) await page.mouse.click(x, y)
    // geoman termine le tracé par un nouveau clic sur le dernier sommet
    await page.mouse.click(pts[2][0], pts[2][1])

    await expect.poll(async () => (await page.locator('#ligne_geometry').inputValue()) !== '').toBe(true)
    const geometry = JSON.parse(await page.locator('#ligne_geometry').inputValue())
    expect(geometry.type).toBe('MultiLineString')
    expect(geometry.coordinates[0].length).toBeGreaterThanOrEqual(3)
  })
})

test.describe('ajout_ligne.php — arrêts liés', () => {
  test('l\'autocomplete lie un arrêt, le × le retire', async ({ page }) => {
    await page.goto(URL_ADMIN)
    const [arret] = await firstArrets(page, 1)
    const section = '#vue-arrets-lies'

    await page.locator(section).getByRole('button', { name: 'Lier un arrêt' }).click()
    await page.locator(`${section} input[type=text]`).fill(arret.nom.slice(0, 4))
    await page.locator(`${section} .autocomplete-list li`).filter({ hasText: arret.nom }).first().click()

    await expect(page.locator(`${section} li`)).toHaveCount(1)
    await expect(page.locator('#ligne_arret_ids')).toHaveValue(String(arret.id))

    await page.locator(`${section} li button[aria-label^="Retirer"]`).first().click()
    await expect(page.locator(`${section} li`)).toHaveCount(0)
    await expect(page.locator('#ligne_arret_ids')).toHaveValue('')
  })

  test('le popup d\'un arrêt sur la carte permet de le lier à la ligne', async ({ page }) => {
    await page.goto(URL_ADMIN)
    const [arret] = await firstArrets(page, 1)
    await page.evaluate((id) => (window as any).ligneFocusArret(id), arret.id)
    await page.locator('.vg-ligne-arret').first().click()
    await page.getByRole('button', { name: 'Lier à la ligne' }).click()
    await expect(page.locator('#ligne_arret_ids')).toHaveValue(String(arret.id))
  })
})

test.describe('ajout_ligne.php — enregistrement', () => {
  test('création : la ligne est persistée avec ses arrêts, puis la page passe en édition', async ({ page, request }) => {
    await page.goto(URL_ADMIN)
    const [arret] = await firstArrets(page, 1)

    await page.locator('#ligne_nom').fill('PHPUnit e2e - Création')
    await page.locator('#ligne_numero').fill('E2E1')
    await page.locator('#ligne_couleur').fill('gold')
    await page.evaluate((id) => (window as any).ligneSetArretLinked(id, true), arret.id)
    await page.locator('#shapes-file').setInputFiles({
      name: 'shapes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nZ,45.0,5.0,0\nZ,45.1,5.1,1\n'),
    })
    await expect.poll(async () => (await page.locator('#ligne_geometry').inputValue()) !== '').toBe(true)

    await page.locator('button[type=submit]').click()
    await page.waitForURL(/ligne_id=\d+/)
    const id = Number(new URL(page.url()).searchParams.get('ligne_id'))
    created.push(id)

    const body = await (await request.get(`/api/fetch_ligne.php?ligne_id=${id}`)).json()
    expect(body.ligne.nom).toBe('PHPUnit e2e - Création')
    expect(body.ligne.numero).toBe('E2E1')
    expect(body.ligne.couleur).toBe('gold')
    expect(body.arret_ids).toEqual([arret.id])
    expect(body.ligne.geometry.type).toBe('MultiLineString')
    await expect(page.locator('#saved-alert')).toBeVisible()
  })

  test('nom manquant : rien n\'est envoyé', async ({ page }) => {
    await page.goto(URL_ADMIN)
    let posted = false
    page.on('request', (r) => { if (r.url().includes('add_ligne.php')) posted = true })
    await page.locator('button[type=submit]').click()
    await page.waitForTimeout(300)
    expect(posted).toBe(false)
  })

  test('édition : formulaire, carte et arrêts liés préremplis, modification persistée', async ({ page, request }) => {
    await page.goto(URL_ADMIN)
    const [arret] = await firstArrets(page, 1)
    const id = await createViaApi(request, { nom: 'PHPUnit e2e - Édition', arret_ids: [arret.id] })

    await page.goto(`${URL_ADMIN}&ligne_id=${id}`)
    await expect(page.locator('#ligne_nom')).toHaveValue('PHPUnit e2e - Édition')
    await expect(page.locator('#ligne_numero')).toHaveValue('E2E')
    await expect(page.locator('#ligne_couleur')).toHaveValue('#123456')
    await expect(page.locator('#ligne_arret_ids')).toHaveValue(String(arret.id))
    await expect(page.locator('.vg-ligne-geometry').first()).toBeAttached()

    await page.locator('#ligne_nom').fill('PHPUnit e2e - Édition modifiée')
    await page.locator('button[type=submit]').click()
    await expect(page.locator('#saved-alert')).toBeVisible()

    const body = await (await request.get(`/api/fetch_ligne.php?ligne_id=${id}`)).json()
    expect(body.ligne.nom).toBe('PHPUnit e2e - Édition modifiée')
    expect(body.arret_ids).toEqual([arret.id])
  })

  test('suppression : confirmée, la ligne disparaît', async ({ page, request }) => {
    const id = await createViaApi(request, { nom: 'PHPUnit e2e - À supprimer' })
    await page.goto(`${URL_ADMIN}&ligne_id=${id}`)
    page.once('dialog', (d) => d.accept())
    await page.locator('#btn-delete').click()
    await page.waitForURL((u) => !u.searchParams.has('ligne_id'))
    expect((await request.get(`/api/fetch_ligne.php?ligne_id=${id}`)).status()).toBe(404)
  })

  test('le sélecteur liste les lignes existantes pour édition', async ({ page, request }) => {
    const id = await createViaApi(request, { nom: 'PHPUnit e2e - Sélecteur' })
    await page.goto(URL_ADMIN)
    await expect(page.locator(`#select-ligne option[value="${id}"]`)).toHaveText(/Sélecteur/)
  })
})

// --- Arrêts de la ligne depuis le GTFS (montrer / importer) ---------------------

/** Arrêts créés en base pendant un test (vrai envoi du formulaire) : supprimés en fin de test. */
const arretsCrees: number[] = []
test.afterEach(() => {
  if (!arretsCrees.length) return
  const ids = arretsCrees.splice(0).join(',')
  execSync(`docker exec velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd -e "DELETE FROM arrets WHERE id IN (${ids})"`)
})

async function choisirLigneGtfs(page: Page, numero: string) {
  await page.locator('#gtfs-file').setInputFiles(GTFS_ZIP)
  await expect(page.locator('#gtfs-routes option:not([value=""])')).toHaveCount(20)
  const value = await page.locator('#gtfs-routes option').evaluateAll(
    (opts, n) => (opts as HTMLOptionElement[]).find((o) => o.textContent!.startsWith(n + ' —'))!.value,
    numero,
  )
  await page.locator('#gtfs-routes').selectOption(value)
}

const etat = (page: Page) =>
  page.evaluate(() => ({
    ids: (document.getElementById('ligne_arret_ids') as HTMLInputElement).value.split(',').filter(Boolean).map(Number),
    nouveaux: JSON.parse((document.getElementById('ligne_nouveaux_arrets') as HTMLInputElement).value || '[]') as { nom: string; lat: number; lng: number; types: string[] }[],
    stops: ((window as any).ligneGtfsStops ?? []) as { id: string; nom: string; lat: number; lng: number }[],
  }))
const nbListe = (page: Page) => page.locator('#vue-arrets-lies li').count()

test.describe('ajout_ligne.php — arrêts depuis le GTFS', () => {
  // Ces tests créent / suppriment des arrêts en base et comparent le catalogue d'arrêts : en série.
  test.describe.configure({ mode: 'serial' })

  test('« Montrer les arrêts » : suggestions sur la carte, rien n\'est ajouté à la ligne', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await choisirLigneGtfs(page, 'S01')
    await page.locator('#gtfs-show-stops').click()

    const { stops, ids, nouveaux } = await etat(page)
    expect(stops.length).toBeGreaterThan(5)
    await expect(page.locator('.vg-gtfs-stop')).toHaveCount(stops.length)
    expect(ids).toEqual([])
    expect(nouveaux).toEqual([])
    expect(await nbListe(page)).toBe(0)
  })

  test('une suggestion s\'ajoute à la main depuis son popup', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await choisirLigneGtfs(page, 'S01')
    await page.locator('#gtfs-show-stops').click()
    await expect(page.locator('.vg-gtfs-stop').first()).toBeAttached()

    await page.locator('.vg-gtfs-stop').first().dispatchEvent('click')
    await page.getByRole('button', { name: 'Ajouter à la ligne' }).click()

    const { ids, nouveaux } = await etat(page)
    expect(ids.length + nouveaux.length).toBe(1)
    expect(await nbListe(page)).toBe(1)
  })

  test('« Importer les arrêts » : tous les arrêts de la ligne sont ajoutés, retirables, rien n\'est écrit en base', async ({ page }) => {
    await page.goto(URL_ADMIN)
    const avant = (await etat(page)) && (await page.evaluate(() => (window as any).ligneArrets.length))
    await choisirLigneGtfs(page, 'S01')
    await page.locator('#gtfs-import-stops').click()

    const { stops, ids, nouveaux } = await etat(page)
    expect(stops.length).toBeGreaterThan(5)
    expect(ids.length + nouveaux.length).toBe(stops.length)
    expect(nouveaux.every((n) => n.types.includes('bus'))).toBe(true)
    expect(await nbListe(page)).toBe(stops.length)
    await expect(page.locator('#vue-arrets-lies')).toContainText('nouvel arrêt')

    // Retrait d'un arrêt de la sélection
    await page.locator('#vue-arrets-lies li button[aria-label^="Retirer"]').first().click()
    expect(await nbListe(page)).toBe(stops.length - 1)
    const apres = await etat(page)
    expect(apres.ids.length + apres.nouveaux.length).toBe(stops.length - 1)

    // Rien en base : un rechargement retrouve le même catalogue d'arrêts
    await page.reload()
    expect(await page.evaluate(() => (window as any).ligneArrets.length)).toBe(avant)
  })

  test('un arrêt GTFS à moins de 50 m d\'un arrêt existant est lié à celui-ci, pas recréé', async ({ page, request }) => {
    await page.goto(URL_ADMIN)
    await choisirLigneGtfs(page, 'S01')
    await page.locator('#gtfs-show-stops').click()
    const premier = (await etat(page)).stops[0]

    const res = await request.post('/api/add_arret.php', {
      data: {
        nom: 'PHPUnit e2e - Arrêt existant', loc: `${premier.lat},${premier.lng}`, types: ['bus'],
        nom_prenom: 'Testeur', email: 'test@example.org',
      },
    })
    const existantId = (await res.json()).arret_id as number
    arretsCrees.push(existantId)

    await page.goto(URL_ADMIN)
    const catalogueAvant = await page.evaluate(() => (window as any).ligneArrets.map((a: any) => a.id) as number[])
    await choisirLigneGtfs(page, 'S01')
    await page.locator('#gtfs-import-stops').click()
    const { ids, nouveaux, stops } = await etat(page)
    expect(ids).toContain(existantId)
    expect(nouveaux.find((n) => Math.abs(n.lat - premier.lat) < 1e-6 && Math.abs(n.lng - premier.lng) < 1e-6)).toBeUndefined()
    expect(ids.length + nouveaux.length).toBe(stops.length)

    // À l'envoi : l'arrêt existant est bien lié à la ligne créée (et pas dupliqué)
    await page.locator('#ligne_nom').fill('PHPUnit e2e - Rapprochement')
    await page.locator('button[type=submit]').click()
    await page.waitForURL(/ligne_id=\d+/)
    const ligneId = Number(new URL(page.url()).searchParams.get('ligne_id'))
    created.push(ligneId)
    const body = await (await request.get(`/api/fetch_ligne.php?ligne_id=${ligneId}`)).json()
    arretsCrees.push(...(body.arret_ids as number[]).filter((id) => !catalogueAvant.includes(id) && id !== existantId))
    expect(body.arret_ids).toContain(existantId)
    expect(body.arret_ids).toHaveLength(stops.length)
    expect(new Set(body.arret_ids).size).toBe(body.arret_ids.length)
  })

  test('à l\'envoi, la ligne est créée avec ses arrêts importés (existants liés, nouveaux créés)', async ({ page, request }) => {
    await page.goto(URL_ADMIN)
    const catalogueAvant = await page.evaluate(() => (window as any).ligneArrets.map((a: any) => a.id) as number[])
    await choisirLigneGtfs(page, 'S07')
    await page.locator('#gtfs-import').click() // champs + tracé
    await page.locator('#gtfs-import-stops').click()
    const { stops, ids, nouveaux } = await etat(page)
    expect(ids.length + nouveaux.length).toBe(stops.length)

    await page.locator('button[type=submit]').click()
    await page.waitForURL(/ligne_id=\d+/)
    const ligneId = Number(new URL(page.url()).searchParams.get('ligne_id'))
    created.push(ligneId)

    const body = await (await request.get(`/api/fetch_ligne.php?ligne_id=${ligneId}`)).json()
    expect(body.arret_ids).toHaveLength(stops.length)
    const crees = (body.arret_ids as number[]).filter((id) => !catalogueAvant.includes(id))
    arretsCrees.push(...crees)
    expect(crees).toHaveLength(nouveaux.length)
    expect(body.ligne.geometry.type).toBe('MultiLineString')
  })

  test('changer de ligne GTFS efface les suggestions', async ({ page }) => {
    await page.goto(URL_ADMIN)
    await choisirLigneGtfs(page, 'S01')
    await page.locator('#gtfs-show-stops').click()
    await expect(page.locator('.vg-gtfs-stop').first()).toBeAttached()
    await page.locator('#gtfs-routes').selectOption({ index: 2 })
    await expect(page.locator('.vg-gtfs-stop')).toHaveCount(0)
  })
})
