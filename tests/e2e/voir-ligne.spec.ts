import { test, expect, Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Lot 7 — bouton « voir la ligne » : panneau d'info des cartes globales
 * (Leaflet + MapLibre) et popup d'arrêt de la page falaise.
 *
 * Le rendu (couleur exacte, halo, lisibilité) reste vérifié à la main
 * (checklist du plan) ; ici : présence du bouton, couches créées / retirées.
 *
 * Données de la base locale : arrêt de bus 6214 « La Balme - Pont du Rhône »
 * (accès piéton vers la falaise 29, cf. carte-arrets.spec.ts).
 */

declare const arrets: any, map: any, falaises: any

// Chaque test crée une ligne sur le même arrêt témoin : exécution en série, sinon
// les lignes des tests parallèles s'additionnent dans le panneau.
test.describe.configure({ mode: 'serial' })

const ROOT = resolve(__dirname, '../..')
const ADMIN_TOKEN = /['"]admin_token['"]\s*=>\s*['"]([^'"]+)['"]/.exec(readFileSync(resolve(ROOT, 'config.php'), 'utf8'))![1]
const BUS = 6214
const FALAISE = 29
const COULEUR = '#ff0000'
const NUMERO = 'E2EV'

let ligneId: number
let autreArretId: number

test.beforeEach(async ({ request }) => {
  // Un second arrêt desservi, pour vérifier la mise en évidence des arrêts liés
  const autre = await (await request.get(`/api/fetch_arrets.php?falaise_id=${FALAISE}`)).json()
  autreArretId = autre.arrets.find((a: any) => a.id !== BUS)?.id ?? 6216
  const res = await request.post('/api/add_ligne.php', {
    data: {
      nom: 'PHPUnit e2e - Voir la ligne',
      numero: NUMERO,
      couleur: COULEUR,
      geometry: { type: 'MultiLineString', coordinates: [[[5.30, 45.85], [5.35, 45.90], [5.40, 45.95]]] },
      arret_ids: [BUS, autreArretId],
    },
  })
  ligneId = (await res.json()).ligne_id
})
test.afterEach(async ({ request }) => {
  await request.post('/api/delete_ligne.php', { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }, data: { ligne_id: ligneId } })
})

type Carte = { url: string; ready: string; setZoom: string; traits: string; halos: string; anneaux: string }
const cartes: Record<string, Carte> = {
  leaflet: {
    url: '/carte.php',
    ready: '#map.leaflet-container',
    setZoom: '(([lat, lng, z]) => map.setView([lat, lng], z, { animate: false }))',
    traits: `document.querySelectorAll('#map path.vg-ligne-voir')`,
    halos: `document.querySelectorAll('#map path.vg-ligne-halo')`,
    anneaux: `document.querySelectorAll('#map path.vg-ligne-arret-ring')`,
  },
  maplibre: {
    url: '/carte.php',
    ready: '#map.maplibregl-map',
    setZoom: '(([lat, lng, z]) => map.jumpTo({ center: [lng, lat], zoom: z }))',
    traits: `map.getStyle().layers.filter((l) => l.id.startsWith('ligne-voir-'))`,
    halos: `map.getStyle().layers.filter((l) => l.id.startsWith('ligne-halo-'))`,
    anneaux: `map.getStyle().layers.filter((l) => l.id.startsWith('ligne-rings-'))`,
  },
}

const compter = (page: Page, expr: string) => page.evaluate((e) => (eval(e) as ArrayLike<unknown>).length, expr)

async function selectionnerArret(page: Page, carte: Carte, arretId: number) {
  await page.goto(carte.url)
  await page.waitForSelector(carte.ready, { timeout: 15000 })
  await page.waitForFunction(() => typeof arrets !== 'undefined' && arrets.some((a: any) => a.marker) && falaises.some((f: any) => f.marker), null, { timeout: 20000 })
  await page.evaluate(
    ({ id, fn }) => {
      const a = arrets.find((x: any) => x.arret_id === id)
      const [lat, lng] = a.arret_latlng.split(',').map(parseFloat)
      eval(fn)([lat, lng, 11])
    },
    { id: arretId, fn: carte.setZoom },
  )
  await page.waitForTimeout(400)
  await page.evaluate((id) => {
    const m = arrets.find((x: any) => x.arret_id === id).marker
    if (m.getElement && !m.getLatLng) m.getElement().click()
    else m.fire('click')
  }, arretId)
}

for (const [nom, carte] of Object.entries(cartes)) {
  test.describe(`Carte ${nom} — voir la ligne`, () => {
    test('arrêt desservi : bouton « Voir la ligne », tracé coloré + halo + arrêts entourés', async ({ page }) => {
      await selectionnerArret(page, carte, BUS)
      const bouton = page.getByRole('button', { name: `Voir la ligne ${NUMERO}` })
      await expect(bouton).toBeVisible()
      expect(await compter(page, carte.traits)).toBe(0)

      await bouton.click()
      await expect.poll(() => compter(page, carte.traits)).toBe(1)
      expect(await compter(page, carte.halos)).toBe(1)
      expect(await compter(page, carte.anneaux)).toBe(0) // pas de cercle autour des arrêts desservis / terminus
      await expect(page.getByRole('button', { name: `Masquer la ligne ${NUMERO}` })).toHaveAttribute('aria-pressed', 'true')

      // Couleur de la base
      const couleur = await page.evaluate((c) => {
        if (c === 'leaflet') return getComputedStyle(document.querySelector('#map path.vg-ligne-voir')!).stroke
        return map.getPaintProperty(map.getStyle().layers.find((l: any) => l.id.startsWith('ligne-voir-')).id, 'line-color')
      }, nom)
      expect(couleur.replace(/\s/g, '')).toMatch(/^(rgb\(255,0,0\)|#ff0000)$/i)
    })

    test('ni le clic sur l\'arrêt ni « Voir la ligne » ne modifient le zoom', async ({ page }) => {
      const vue = () => page.evaluate(() => (typeof (window as any).L !== 'undefined' ? { z: map.getZoom(), c: [map.getCenter().lat, map.getCenter().lng] } : { z: map.getZoom(), c: [map.getCenter().lat, map.getCenter().lng] }))
      await page.goto(carte.url)
      await page.waitForSelector(carte.ready, { timeout: 15000 })
      await page.waitForFunction(() => typeof arrets !== 'undefined' && arrets.some((a: any) => a.marker) && falaises.some((f: any) => f.marker), null, { timeout: 20000 })
      await page.evaluate(({ id, fn }) => {
        const a = arrets.find((x: any) => x.arret_id === id)
        const [lat, lng] = a.arret_latlng.split(',').map(parseFloat)
        eval(fn)([lat, lng, 11])
      }, { id: BUS, fn: carte.setZoom })
      await page.waitForTimeout(600)
      const avant = await vue()
      await page.evaluate((id) => {
        const m = arrets.find((x: any) => x.arret_id === id).marker
        if (m.getElement && !m.getLatLng) m.getElement().click()
        else m.fire('click')
      }, BUS)
      await page.waitForTimeout(1500)
      expect(await vue()).toEqual(avant)
      await page.getByRole('button', { name: `Voir la ligne ${NUMERO}` }).click()
      await expect.poll(() => compter(page, carte.traits)).toBe(1)
      await page.waitForTimeout(1500)
      expect(await vue()).toEqual(avant)
    })

    test('un second clic masque la ligne', async ({ page }) => {
      await selectionnerArret(page, carte, BUS)
      await page.getByRole('button', { name: `Voir la ligne ${NUMERO}` }).click()
      await expect.poll(() => compter(page, carte.traits)).toBe(1)
      await page.getByRole('button', { name: `Masquer la ligne ${NUMERO}` }).click()
      await expect.poll(() => compter(page, carte.traits)).toBe(0)
      expect(await compter(page, carte.halos)).toBe(0)
      expect(await compter(page, carte.anneaux)).toBe(0)
    })

    test('changer de sélection efface la ligne', async ({ page }) => {
      await selectionnerArret(page, carte, BUS)
      await page.getByRole('button', { name: `Voir la ligne ${NUMERO}` }).click()
      await expect.poll(() => compter(page, carte.traits)).toBe(1)
      // Re-sélection du même arrêt : teardown → la ligne disparaît, le bouton se réinitialise
      await page.evaluate((id) => {
        const m = arrets.find((x: any) => x.arret_id === id).marker
        if (m.getElement && !m.getLatLng) m.getElement().click()
        else m.fire('click')
      }, BUS)
      await expect.poll(() => compter(page, carte.traits)).toBe(0)
      await expect(page.getByRole('button', { name: `Voir la ligne ${NUMERO}` })).toHaveAttribute('aria-pressed', 'false')
    })

    test('arrêt sans ligne : pas de bouton', async ({ page }) => {
      await page.goto(carte.url)
      await page.waitForSelector(carte.ready, { timeout: 15000 })
      await page.waitForFunction(() => typeof arrets !== 'undefined' && arrets.some((a: any) => a.marker), null, { timeout: 20000 })
      const sansLigne = await page.evaluate(
        ([bus, autre]) => arrets.find((a: any) => a.access.length > 0 && a.arret_id !== bus && a.arret_id !== autre).arret_id as number,
        [BUS, autreArretId],
      )
      await selectionnerArret(page, carte, sansLigne)
      await expect(page.locator('#vue-info-panel')).toContainText('Falaises accessibles')
      await expect(page.getByRole('button', { name: /la ligne/ })).toHaveCount(0)
    })
  })
}

test.describe('Page falaise — voir la ligne', () => {
  test('clic sur un arrêt desservi : popup avec bouton, puis tracé de la ligne', async ({ page }) => {
    await page.goto(`/falaise.php?falaise_id=${FALAISE}`)
    await page.waitForFunction(() => !!(window as any).map)
    await page.waitForTimeout(1200) // fin de l'animation de cadrage initial
    // Attendre le marqueur de l'arrêt (chargé en asynchrone) puis simuler son clic
    await page.waitForFunction(
      (id) => Object.values((window as any).map._layers).some((l: any) => l.options?.icon?.options?.className?.includes('vg-arret-icon') && l._leaflet_id),
      BUS,
      { timeout: 15000 },
    )
    const vue = (p: Page) => p.evaluate(() => { const m = (window as any).map; return { z: m.getZoom(), c: [m.getCenter().lat, m.getCenter().lng] } })
    const avant = await vue(page)
    const clicOk = await page.evaluate(async (id) => {
      const data = await (await fetch(`/api/fetch_arrets.php?falaise_id=${new URLSearchParams(location.search).get('falaise_id')}`)).json()
      const a = data.arrets.find((x: any) => x.id === id)
      if (!a) return false
      const m: any = Object.values((window as any).map._layers).find(
        (l: any) => l.getLatLng && Math.abs(l.getLatLng().lat - a.lat) < 1e-6 && Math.abs(l.getLatLng().lng - a.lng) < 1e-6 && l.options?.icon?.options?.className?.includes('vg-arret-icon'),
      )
      if (!m) return false
      m.fire('click')
      return true
    }, BUS)
    expect(clicOk).toBe(true)
    // Cliquer l'arrêt ne recadre plus la carte
    await page.waitForTimeout(1200)
    const apresClicArret = await vue(page)
    expect(apresClicArret).toEqual(avant)

    const bouton = page.getByRole('button', { name: `Voir la ligne ${NUMERO}` })
    await expect(bouton).toBeVisible()
    await bouton.click()
    await expect(page.locator('path.vg-ligne-voir')).toHaveCount(1)
    await expect(page.locator('path.vg-ligne-halo')).toHaveCount(1)
    // Ni recadrage, ni cercles autour des terminus / arrêts desservis
    await page.waitForTimeout(1200)
    expect(await vue(page)).toEqual(avant)
    await expect(page.locator('path.vg-ligne-arret-ring')).toHaveCount(0)

    // Clic ailleurs sur la carte : la ligne disparaît
    await page.evaluate(() => (window as any).map.fire('click'))
    await expect(page.locator('path.vg-ligne-voir')).toHaveCount(0)
  })
})
