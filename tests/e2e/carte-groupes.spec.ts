import { test, expect, Page } from '@playwright/test'
import { execSync } from 'node:child_process'

/**
 * Carte globale (MapLibre) : arrêts regroupés sous un parent (docs/plan-arrets-parents.md, lot P6).
 * Le rendu visuel (enveloppe, bascule parent → enfants) reste vérifié à la main ; ici l'état de la carte :
 * le parent porte ses enfants, une enveloppe existe pour 2 enfants (aucune pour 1), et les couches des
 * enfants / du parent ont les bons seuils de zoom (parent seul et nommé à bas zoom ; enfants, leurs noms
 * et l'enveloppe dès le zoom 14, avec la gestion des collisions native des symboles MapLibre).
 */

declare const arrets: any, map: any

const mysql = (q: string) =>
  execSync(`docker exec velogrimpe /opt/lampp/bin/mysql -uroot u829510062_bdd -N -e "${q}"`).toString().trim()

const ids = { enfants: [] as number[], parents: [] as number[], lignes: [] as number[] }

function creerArret(nom: string, lat: number, lng: number): number {
  const out = mysql(
    `INSERT INTO arrets (loc, nom, slug, bus, contrib, contrib_mail) VALUES (ST_GeomFromText('POINT(${lng} ${lat})', 4326), '${nom}', 'phpunit-e2e', 1, 'phpunit', 'phpunit@example.org'); SELECT LAST_INSERT_ID();`,
  )
  const id = Number(out)
  ids.enfants.push(id)
  return id
}

async function fusion(request: any, source: number, cible: number): Promise<number> {
  const token = JSON.parse(execSync('php -r \'echo json_encode(require "config.php");\'').toString()).admin_token
  const res = await request.post('/api/merge_arrets.php', {
    headers: { Authorization: `Bearer ${token}` },
    data: { source_id: source, cible_id: cible },
  })
  const parent = (await res.json()).parent_id as number
  ids.parents.push(parent)
  return parent
}

test.afterEach(() => {
  const tous = [...ids.enfants, ...ids.parents]
  if (tous.length) {
    mysql(`UPDATE arrets SET parent_id = NULL WHERE id IN (${tous.join(',')})`)
    mysql(`DELETE FROM arrets WHERE id IN (${tous.join(',')})`)
  }
  if (ids.lignes.length) mysql(`DELETE FROM lignes_transport WHERE id IN (${ids.lignes.join(',')})`)
  ids.enfants = []
  ids.parents = []
  ids.lignes = []
})

async function ouvrirCarte(page: Page) {
  await page.goto('/carte.php')
  await page.waitForSelector('#map.maplibregl-map', { timeout: 15000 })
  await page.waitForFunction(() => typeof map !== 'undefined' && !!map.getSource?.('arrets-groupes'), null, { timeout: 20000 })
}

test.describe('carte.php — arrêts regroupés', () => {
  test.describe.configure({ mode: 'serial' })

  test('un parent à deux enfants : enveloppe, enfants exposés, seuils de zoom des couches', async ({ page, request }) => {
    const a = creerArret('PHPUnit e2e Groupe A', 43.8270, 5.3830)
    const b = creerArret('PHPUnit e2e Groupe B', 43.8280, 5.3850)
    const parent = await fusion(request, a, b)
    ids.lignes.push(Number(mysql(`INSERT INTO lignes_transport (nom, numero) VALUES ('PHPUnit e2e ligne groupe', 'PHE'); SELECT LAST_INSERT_ID();`)))
    mysql(`INSERT INTO arrets_lignes_transport (ligne_id, arret_id) VALUES (${ids.lignes[0]}, ${a}), (${ids.lignes[0]}, ${b})`)

    await ouvrirCarte(page)
    const etat = await page.evaluate((pid) => {
      const p = arrets.find((x: any) => x.arret_id === pid)
      const src = (id: string) => map.getSource(id).serialize().data.features
      return {
        enfants: p?.enfants.map((e: any) => e.arret_id).sort(),
        lignes: p?.lignes,
        enveloppes: src('arrets-groupes').filter((f: any) => f.properties.id === pid).length,
        enfantsCarte: src('arrets-enfants').filter((f: any) => f.properties.parent === pid).length,
        parentsHorsTopo: src('arrets-parents').filter((f: any) => f.properties.id === pid).length,
        etiquettes: (() => {
          const noms = (id: string) => map.getSource(id).serialize().data.features.map((f: any) => f.properties.nom)
          const general = noms('arrets-labels')
          return {
            generalA: general.filter((n: string) => n === 'PHPUnit e2e Groupe A').length,
            generalB: general.filter((n: string) => n === 'PHPUnit e2e Groupe B').length,
            parents: noms('arrets-parents-labels').filter((n: string) => n.startsWith('PHPUnit e2e Groupe')),
            enfants: noms('arrets-enfants').filter((n: string) => n.startsWith('PHPUnit e2e Groupe')).sort(),
          }
        })(),
        zooms: Object.fromEntries(
          ['arrets-groupes-fill', 'arrets-groupes-line', 'arrets-enfants', 'arrets-enfants-labels', 'arrets-parents', 'arrets-parents-labels'].map((l) => [l, [map.getLayer(l).minzoom, map.getLayer(l).maxzoom]]),
        ),
      }
    }, parent)

    expect(etat.enfants).toEqual([a, b].sort())
    expect(etat.lignes).toContain('PHE')
    expect(etat.enveloppes).toBe(1)
    // Noms : le parent (nom de `cible_id`, ici B) est nommé à bas zoom ; les enfants le sont chacun à fort zoom,
    // jamais dans la couche générale des noms (sinon parent et enfants s'étiquetteraient ensemble)
    expect(etat.etiquettes).toEqual({ generalA: 0, generalB: 0, parents: ['PHPUnit e2e Groupe B'], enfants: ['PHPUnit e2e Groupe A', 'PHPUnit e2e Groupe B'] })
    expect(etat.enfantsCarte).toBe(2)
    expect(etat.parentsHorsTopo).toBe(1) // parent sans accès falaise mais desservi par une ligne : point à bas zoom
    expect(etat.zooms['arrets-groupes-fill'][0]).toBe(14)
    expect(etat.zooms['arrets-groupes-line'][0]).toBe(14)
    expect(etat.zooms['arrets-enfants'][0]).toBe(14) // enfants dès 14
    expect(etat.zooms['arrets-enfants-labels'][0]).toBe(14) // et leurs noms
    expect(etat.zooms['arrets-parents'][1]).toBe(14) // parent seul jusqu'à 14
    expect(etat.zooms['arrets-parents-labels'][1]).toBe(14)
  })

  test('les enfants ne sont pas des points de la carte à eux seuls, un parent à un seul enfant n\'a pas d\'enveloppe', async ({ page, request }) => {
    const a = creerArret('PHPUnit e2e Solo A', 43.8300, 5.3900)
    const b = creerArret('PHPUnit e2e Solo B', 43.8301, 5.3901)
    const c = creerArret('PHPUnit e2e Solo C', 43.8302, 5.3902)
    const parent = await fusion(request, a, b)
    // un seul enfant restant : on détache b et c n'est pas rattaché
    const token = JSON.parse(execSync('php -r \'echo json_encode(require "config.php");\'').toString()).admin_token
    await request.post('/api/merge_arrets.php', { headers: { Authorization: `Bearer ${token}` }, data: { source_id: c, cible_id: parent } })
    await request.post('/api/detach_arret.php', { headers: { Authorization: `Bearer ${token}` }, data: { arret_id: c } })
    await request.post('/api/detach_arret.php', { headers: { Authorization: `Bearer ${token}` }, data: { arret_id: b } })

    await ouvrirCarte(page)
    const etat = await page.evaluate(({ pid, enfants }) => ({
      enfantsDansArrets: arrets.filter((x: any) => enfants.includes(x.arret_id)).length,
      enveloppes: map.getSource('arrets-groupes').serialize().data.features.filter((f: any) => f.properties.id === pid).length,
      nbEnfants: arrets.find((x: any) => x.arret_id === pid)?.enfants.length,
    }), { pid: parent, enfants: [a, b, c] })

    expect(etat.nbEnfants).toBe(1)
    expect(etat.enveloppes).toBe(0)
    expect(etat.enfantsDansArrets).toBe(2) // b et c, redevenus orphelins, sont des points de la carte ; a (enfant) non
  })
})
