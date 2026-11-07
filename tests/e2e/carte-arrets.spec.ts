import { test, expect, Page } from '@playwright/test'

/**
 * Lot 6 — carte globale : rendu des arrêts multimodaux (gares, bus, tram,
 * téléphérique) et tracé piéton arrêt → falaise, sur Leaflet et MapLibre.
 *
 * Le rendu visuel (icônes, seuils de zoom au pixel près) reste vérifié à la
 * main (checklist du Lot 6) : ici uniquement des assertions sur l'état de la
 * page (marqueur présent ou non, classe de l'icône, couche de tracé).
 *
 * Données de la base locale (export prod) :
 *  - 6214 « La Balme - Pont du Rhône » : arrêt de bus, accès piéton seul vers
 *    la falaise 29 (qui a aussi des accès vélo) → arrêt « du topo »
 *  - 6216 « Chambéry » : arrêt de bus sans aucun accès → hors topo
 */

// Noms lexicaux des scripts de page (const/var de script classique, hors globalThis)
declare const arrets: any, falaises: any, map: any, L: any

const BUS_TOPO_PIETON = 6214
const BUS_HORS_TOPO = 6216
const FALAISE_AVEC_PIETON = '29'

type Carte = { url: string; ready: string; setZoom: string; zoomPoint: number; zoomGarePoint: number }

const cartes: Record<string, Carte> = {
  leaflet: {
    url: '/carte.php',
    zoomGarePoint: 8, // gares : point de z=8 à z<9, icône ensuite
    zoomPoint: 10, // point doré de z=9 à z<11, icône ensuite
    ready: '#map.leaflet-container',
    setZoom: '(([lat, lng, z]) => map.setView([lat, lng], z, { animate: false }))',
  },
  maplibre: {
    url: '/carte.php',
    zoomGarePoint: 7,
    zoomPoint: 9, // un niveau plus bas que Leaflet : point de z=8 à z<10
    ready: '#map.maplibregl-map',
    setZoom: '(([lat, lng, z]) => map.jumpTo({ center: [lng, lat], zoom: z }))',
  },
}

async function ouvrir(page: Page, carte: Carte) {
  await page.goto(carte.url)
  await page.waitForSelector(carte.ready, { timeout: 15000 })
  // Carte prête : premier rendu des falaises et des arrêts effectué (MapLibre : après `load`)
  await page.waitForFunction(
    () => typeof arrets !== 'undefined' && arrets.some((a: any) => a.marker) && falaises.some((f: any) => f.marker),
    null,
    { timeout: 20000 },
  )
}

async function zoomSur(page: Page, carte: Carte, arretId: number, z: number) {
  await page.evaluate(
    ({ id, z, fn }) => {
      const a = arrets.find((x: any) => x.arret_id === id)
      const [lat, lng] = a.arret_latlng.split(',').map(parseFloat)
      return eval(fn)([lat, lng, z])
    },
    { id: arretId, z, fn: carte.setZoom },
  )
  await page.waitForTimeout(400)
}

// Marqueur affiché sur la carte ? (Leaflet : layer ajouté ; MapLibre : élément dans le DOM)
const marqueurAffiche = (page: Page, arretId: number) =>
  page.evaluate((id) => {
    const a = arrets.find((x: any) => x.arret_id === id)
    const m = a?.marker
    if (!m) return false
    if (typeof m.getElement === 'function') return !!m.getElement()?.isConnected
    return !!map.hasLayer(m)
  }, arretId)

const couleurFond = (page: Page, arretId: number) =>
  page.evaluate((id) => {
    const a = arrets.find((x: any) => x.arret_id === id)
    const m = a.marker
    const el: HTMLElement = typeof m.getElement === 'function' ? m.getElement() : m._icon
    return el.style.background || (el.querySelector('div:not(.vg-tip)') as HTMLElement).style.background
  }, arretId)

const classeMarqueur = (page: Page, arretId: number) =>
  page.evaluate((id) => {
    const a = arrets.find((x: any) => x.arret_id === id)
    const m = a.marker
    const el = typeof m.getElement === 'function' ? m.getElement() : m.getElement?.() ?? m._icon
    return el?.className ?? ''
  }, arretId)

async function cliquerArret(page: Page, arretId: number) {
  await page.evaluate((id) => {
    const a = arrets.find((x: any) => x.arret_id === id)
    const m = a.marker
    // MapLibre : Marker (Evented aussi, d'où le test sur getElement en premier)
    if (m.getElement && !m.getLatLng) m.getElement().click()
    else m.fire('click')
  }, arretId)
}

const nbTracesPieton = (page: Page) =>
  page.evaluate(() => {
    if (typeof L !== 'undefined' && map.getPane) {
      return document.querySelectorAll('#map path.vg-pieton-line').length
    }
    return map.getStyle().layers.filter((l: any) => l.id.startsWith('pieton-')).length
  })

for (const [nom, carte] of Object.entries(cartes)) {
  test.describe(`Carte ${nom} — arrêts multimodaux`, () => {
    test.beforeEach(async ({ page }) => {
      await ouvrir(page, carte)
    })

    test('arrêt de bus relié à une falaise : masqué en dézoomé, icône de bus en zoomé', async ({ page }) => {
      await zoomSur(page, carte, BUS_TOPO_PIETON, 6)
      expect(await marqueurAffiche(page, BUS_TOPO_PIETON)).toBe(false)

      await zoomSur(page, carte, BUS_TOPO_PIETON, 11)
      expect(await marqueurAffiche(page, BUS_TOPO_PIETON)).toBe(true)
      const classe = await classeMarqueur(page, BUS_TOPO_PIETON)
      expect(classe).toContain('vg-arret-icon')
    })

    test('bus/tram/téléphérique : point doré au zoom intermédiaire, puis icône sur fond doré', async ({ page }) => {
      await zoomSur(page, carte, BUS_TOPO_PIETON, carte.zoomPoint)
      expect(await marqueurAffiche(page, BUS_TOPO_PIETON)).toBe(true)
      const classe = await classeMarqueur(page, BUS_TOPO_PIETON)
      expect(classe).toContain('vg-arret-dot')
      expect(classe).not.toContain('vg-arret-icon')
      expect(await couleurFond(page, BUS_TOPO_PIETON)).toBe('gold')

      await zoomSur(page, carte, BUS_TOPO_PIETON, carte.zoomPoint + 1)
      expect(await classeMarqueur(page, BUS_TOPO_PIETON)).toContain('vg-arret-icon')
      expect(await couleurFond(page, BUS_TOPO_PIETON)).toBe('gold')
    })

    test('gares du topo : rien, puis point, puis icône', async ({ page }) => {
      const gareId = await page.evaluate(() => arrets.find((x: any) => x.types.includes('ter') && x.access.length > 0).arret_id as number)
      await zoomSur(page, carte, gareId, carte.zoomGarePoint - 1)
      expect(await marqueurAffiche(page, gareId)).toBe(false)
      await zoomSur(page, carte, gareId, carte.zoomGarePoint)
      expect(await classeMarqueur(page, gareId)).toContain('vg-arret-dot')
      await zoomSur(page, carte, gareId, carte.zoomGarePoint + 1)
      expect(await classeMarqueur(page, gareId)).toContain('vg-arret-icon')
    })

    test('les arrêts s\'affichent sous les marqueurs et labels de falaises', async ({ page }) => {
      await zoomSur(page, carte, BUS_TOPO_PIETON, 12)
      const { arret, falaise } = await page.evaluate((id) => {
        const z = (el: Element | null | undefined) => Number(getComputedStyle(el as Element).zIndex) || 0
        const a = arrets.find((x: any) => x.arret_id === id).marker
        if (typeof L !== 'undefined') {
          // Leaflet : z-index du pane (et non de l'icône, relatif au pane)
          return { arret: z(a.getPane?.() ?? a._icon.parentElement), falaise: z(map.getPane('markerPane')) }
        }
        return { arret: z(a.getElement()), falaise: z(document.querySelector('.vg-falaise-el')) }
      }, BUS_TOPO_PIETON)
      expect(arret).toBeLessThan(falaise)
    })

    test('arrêt de bus hors topo : jamais affiché', async ({ page }) => {
      await zoomSur(page, carte, BUS_HORS_TOPO, 13)
      expect(await marqueurAffiche(page, BUS_HORS_TOPO)).toBe(false)
    })

    test('les gares utilisent l\'icône unifiée (plus de .train-icon)', async ({ page }) => {
      const gareId = await page.evaluate(() => {
        const a = arrets.find((x: any) => x.types.includes('ter') && x.access.length > 0)
        return a.arret_id as number
      })
      await zoomSur(page, carte, gareId, 11)
      const classe = await classeMarqueur(page, gareId)
      expect(classe).toContain('vg-arret-icon')
      expect(classe).not.toContain('train-icon')
    })

    test('clic sur l\'arrêt : aucun trait droit vers les falaises en accès piéton', async ({ page }) => {
      await zoomSur(page, carte, BUS_TOPO_PIETON, 11)
      await cliquerArret(page, BUS_TOPO_PIETON)
      await page.waitForTimeout(1500) // les tracés sont posés après le déplacement de caméra
      expect(await nbTracesPieton(page)).toBe(0)

      // Le panneau d'info parle d'un arrêt, pas d'une gare
      const panneau = page.locator('#vue-info-panel')
      await expect(panneau).toContainText('Arrêt')
      await expect(panneau).not.toContainText('Gare de')
    })

    test('clic sur la falaise : le tooltip de l\'arrêt d\'accès piéton a un fond', async ({ page }) => {
      await page.evaluate((id) => {
        const f = falaises.find((x: any) => x.falaise_id === id)
        const m = f.marker
        if (m.getElement && !m.getLatLng) m.getElement().click()
        else m.fire('click')
      }, FALAISE_AVEC_PIETON)
      const tooltip = page.locator('.vg-station-tooltip').filter({ hasText: 'La Balme - Pont du Rhône' })
      await expect(tooltip).toBeVisible({ timeout: 5000 })
      const fond = await tooltip.evaluate((e) => getComputedStyle(e).backgroundColor)
      expect(fond).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    })

    test('clic sur la falaise : aucun trait droit vers l\'arrêt d\'accès piéton', async ({ page }) => {
      await page.evaluate((id) => {
        const f = falaises.find((x: any) => x.falaise_id === id)
        const m = f.marker
        if (m.getElement && !m.getLatLng) m.getElement().click()
        else m.fire('click')
      }, FALAISE_AVEC_PIETON)
      await page.waitForTimeout(1500)
      expect(await nbTracesPieton(page)).toBe(0)
    })
  })
}
