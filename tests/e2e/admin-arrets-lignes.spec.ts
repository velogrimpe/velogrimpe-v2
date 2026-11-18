import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Panneau admin « Arrêts et lignes » : dialogs de modification (arrêt : nom + modalités ; ligne : infos de base)
 * et import GTFS d'une ligne (bilan puis confirmation). Mêmes actions sur un arrêt en liste et sur la carte.
 *
 * Le panneau est derrière la Basic Auth de /admin : ADMIN_BASIC_AUTH=user:motdepasse. Sans elle, les tests sont
 * ignorés, sauf si ADMIN_PAGE désigne une copie de la page hors de /admin/ (ex. /tmp_arrets_lignes.php).
 */

const ROOT = resolve(__dirname, '../..')
const ADMIN_TOKEN = /['"]admin_token['"]\s*=>\s*['"]([^'"]+)['"]/.exec(readFileSync(resolve(ROOT, 'config.php'), 'utf8'))![1]
const BEARER = { Authorization: `Bearer ${ADMIN_TOKEN}` }
const GTFS_ZIP = resolve(ROOT, 'assets/gtfs_savoie.zip')
const PAGE = process.env.ADMIN_PAGE ?? '/admin/arrets_lignes.php'
const auth = process.env.ADMIN_BASIC_AUTH

const mysql = (q: string) =>
  execSync(`docker exec velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd -N -e "${q}"`).toString().trim()

test.skip(!auth && !process.env.ADMIN_PAGE, 'ADMIN_BASIC_AUTH=user:mdp requis (Basic Auth de /admin)')
if (auth) test.use({ httpCredentials: { username: auth.split(':')[0], password: auth.split(':').slice(1).join(':') } })

// En série : le test de création repère sa ligne par id, les autres créent aussi des lignes
test.describe.configure({ mode: 'serial' })

const arretsCrees: number[] = []
const lignesCreees: number[] = []
test.afterEach(async ({ request }) => {
  for (const id of lignesCreees.splice(0)) {
    await request.post('/api/delete_ligne.php', { headers: BEARER, data: { ligne_id: id, supprimer_arrets: true } })
  }
  for (const id of arretsCrees.splice(0)) mysql(`DELETE FROM arrets WHERE id = ${id}`)
})

function creerArret(nom: string): number {
  const id = Number(
    mysql(
      `INSERT INTO arrets (loc, nom, slug, bus, contrib, contrib_mail) VALUES (ST_GeomFromText('POINT(5.383 43.827)', 4326), '${nom}', 'phpunit-e2e', 1, 'phpunit', 'phpunit@example.org'); SELECT LAST_INSERT_ID();`,
    ),
  )
  arretsCrees.push(id)
  return id
}

async function creerLigne(request: any, data: Record<string, unknown> = {}): Promise<number> {
  const res = await request.post('/api/add_ligne.php', {
    data: { nom: 'PHPUnit e2e admin ligne', numero: 'E2E', couleur: '#123456', arret_ids: [], ...data },
  })
  const id = (await res.json()).ligne_id as number
  lignesCreees.push(id)
  return id
}

test('Modifier un arrêt : dialog nom + modalités, plus de bouton Renommer', async ({ page }) => {
  const id = creerArret('PHPUnit e2e admin arret')
  await page.goto(`${PAGE}?q=PHPUnit e2e admin arret`)
  await expect(page.locator('[data-rename-arret]')).toHaveCount(0)
  await page.locator(`[data-edit-arret="${id}"]`).click()
  await expect(page.locator('#dlg-arret')).toBeVisible()
  await expect(page.locator('#arret-nom')).toHaveValue('PHPUnit e2e admin arret')
  await expect(page.locator('#arret-types input[value="bus"]')).toBeChecked()

  // Aucune modalité : refus côté formulaire
  await page.locator('#arret-types input[value="bus"]').uncheck()
  await page.getByRole('button', { name: 'Valider' }).first().click()
  await expect(page.locator('#arret-error')).toContainText('modalité')

  await page.locator('#arret-types input[value="bus"]').check()
  await page.locator('#arret-types input[value="tram"]').check()
  await page.fill('#arret-nom', 'PHPUnit e2e admin arret renommé')
  await page.getByRole('button', { name: 'Valider' }).first().click()
  await page.waitForLoadState('load')
  await expect.poll(() => mysql(`SELECT CONCAT(nom, '|', bus, tram) FROM arrets WHERE id = ${id}`)).toBe('PHPUnit e2e admin arret renommé|11')
})

test('Modifier une ligne : infos de base, tracé et arrêts conservés', async ({ page, request }) => {
  const arret = creerArret('PHPUnit e2e admin arret ligne')
  const geometry = { type: 'MultiLineString', coordinates: [[[5.38, 43.82], [5.39, 43.83]]] }
  const id = await creerLigne(request, { geometry, arret_ids: [arret] })
  await page.goto(`${PAGE}?q=PHPUnit e2e admin ligne`)
  await page.locator(`[data-edit-ligne="${id}"]`).click()
  await expect(page.locator('#dlg-ligne')).toBeVisible()
  await expect(page.locator('#ligne-numero')).toHaveValue('E2E')
  await page.fill('#ligne-nom', 'PHPUnit e2e admin ligne modifiée')
  await page.fill('#ligne-operateur', 'Opérateur e2e')
  await page.getByRole('button', { name: 'Valider' }).last().click()
  await page.waitForLoadState('load')
  await expect.poll(() => mysql(`SELECT CONCAT(nom, '|', operateur) FROM lignes_transport WHERE id = ${id}`)).toBe('PHPUnit e2e admin ligne modifiée|Opérateur e2e')
  expect(mysql(`SELECT COUNT(*) FROM lignes_transport WHERE id = ${id} AND geometry IS NOT NULL`)).toBe('1')
  expect(mysql(`SELECT COUNT(*) FROM arrets_lignes_transport WHERE ligne_id = ${id}`)).toBe('1')
})

test('Import GTFS : bilan puis confirmation remplace tracé et arrêts', async ({ page, request }) => {
  const id = await creerLigne(request, { nom: 'PHPUnit e2e admin gtfs' })
  await page.goto(`${PAGE}?q=PHPUnit e2e admin gtfs`)
  await page.locator(`[data-gtfs-ligne="${id}"]`).click()
  await page.getByTestId('gtfs-file').setInputFiles(GTFS_ZIP)
  await page.getByTestId('gtfs-route').selectOption({ index: 1 })
  // Pendant l'analyse : spinner, libellé « Analyse… » et bouton désactivé
  await page.evaluate(() => {
    const b = document.querySelector('[data-testid="gtfs-analyser"]') as HTMLButtonElement
    ;(window as any).__analyse = false
    new MutationObserver(() => {
      if (b.disabled && b.textContent!.includes('Analyse…') && b.querySelector('.loading-spinner')) (window as any).__analyse = true
    }).observe(b, { childList: true, subtree: true, attributes: true, characterData: true })
  })
  await page.getByTestId('gtfs-analyser').click()
  await expect.poll(() => page.evaluate(() => (window as any).__analyse)).toBe(true)
  await expect(page.getByTestId('gtfs-analyser')).toBeEnabled()
  await expect(page.getByTestId('gtfs-bilan')).toContainText('Bilan')
  await expect(page.getByTestId('gtfs-geometry')).toBeVisible()
  // Rien n'est écrit avant la confirmation
  expect(mysql(`SELECT COUNT(*) FROM arrets_lignes_transport WHERE ligne_id = ${id}`)).toBe('0')

  await page.getByRole('button', { name: "Confirmer l'import" }).click()
  await page.waitForLoadState('load')
  await expect.poll(() => Number(mysql(`SELECT COUNT(*) FROM arrets_lignes_transport WHERE ligne_id = ${id}`))).toBeGreaterThan(0)
})

test('« + » des lignes : crée une ligne avec infos de base, tracé et arrêts du GTFS', async ({ page }) => {
  const avant = Number(mysql('SELECT COALESCE(MAX(id), 0) FROM lignes_transport'))
  await page.goto(PAGE)
  await page.locator('[data-gtfs-ligne="new"]').click()
  await expect(page.locator('dialog[open] h3')).toContainText('nouvelle ligne')
  await page.getByTestId('gtfs-file').setInputFiles(GTFS_ZIP)
  await page.getByTestId('gtfs-route').selectOption({ index: 1 })
  await page.getByTestId('gtfs-analyser').click()
  await expect(page.getByTestId('gtfs-nouvelle-ligne')).toContainText('Ligne créée')
  await expect(page.getByTestId('gtfs-bilan')).toContainText('0 retiré')
  await page.getByRole('button', { name: 'Créer la ligne' }).click()
  await page.waitForLoadState('load')
  await expect.poll(() => Number(mysql(`SELECT COUNT(*) FROM lignes_transport WHERE id > ${avant}`))).toBe(1)
  const id = Number(mysql(`SELECT id FROM lignes_transport WHERE id > ${avant}`))
  lignesCreees.push(id)
  expect(mysql(`SELECT nom <> '' AND ref IS NOT NULL AND geometry IS NOT NULL FROM lignes_transport WHERE id = ${id}`)).toBe('1')
  expect(Number(mysql(`SELECT COUNT(*) FROM arrets_lignes_transport WHERE ligne_id = ${id}`))).toBeGreaterThan(0)
})

test('mêmes actions sur un arrêt en liste et sur la carte', async ({ page }) => {
  await page.goto(PAGE)
  const sel = (r: string) => `${r} [data-edit-arret], ${r} [data-move-arret], ${r} [data-link-start]`
  const n = await page.locator(sel('#tbody-arrets tr:first-child')).count()
  await page.locator('#tbody-arrets [data-show-arret]').first().click()
  await expect(page.locator('.maplibregl-popup')).toBeVisible()
  expect(await page.locator(sel('.maplibregl-popup')).count()).toBe(n)
})
