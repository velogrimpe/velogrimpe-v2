import { describe, expect, test } from 'bun:test'
import {
  compareGtfsStops,
  describePlanItem,
  nouvelArretExtra,
  normalizeNom,
  planGtfsStops,
  type ArretGeo,
  type PlanContext,
} from './gtfs-match'
import type { GtfsStop } from './gtfs'

const stop = (id: string, lat: number, lng: number, nom = `S${id}`, parentId: string | null = null): GtfsStop => ({
  id,
  nom,
  lat,
  lng,
  parentId,
})
const arret = (id: number, lat: number, lng: number, extra: Partial<ArretGeo> = {}): ArretGeo => ({
  id,
  nom: `A${id}`,
  lat,
  lng,
  ...extra,
})
// 0.0001° de latitude ≈ 11 m ; 0.0005° ≈ 55 m ; 0.001° ≈ 111 m ; 0.002° ≈ 222 m
const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({ linked: [], catalog: [], ...over })
const plan = (stops: GtfsStop[], over: Partial<PlanContext> = {}) => planGtfsStops(stops, ctx(over)).items

describe('normalizeNom', () => {
  test('casse, accents, ponctuation et préfixes courants', () => {
    expect(normalizeNom('Gare de Saint-Étienne')).toBe(normalizeNom('SAINT ETIENNE'))
    expect(normalizeNom('Arrêt "Mairie"')).toBe('mairie')
    expect(normalizeNom("Gare d'Ambérieu")).toBe(normalizeNom('Amberieu'))
    expect(normalizeNom('  ')).toBe('')
  })
})

describe('planGtfsStops : arrêt existant déjà suivi (ref mémorisée)', () => {
  test('arrêt lié portant la ref : « served » par id, même s\'il a bougé', () => {
    const a1 = arret(1, 45, 5, { gtfsRefs: ['X'] })
    const [item] = plan([stop('X', 46, 6)], { linked: [a1], catalog: [a1] })
    expect(item).toMatchObject({ action: 'served', by: 'id', arret: a1 })
  })

  test('un arrêt lié ne sert qu\'un seul arrêt GTFS', () => {
    const a1 = arret(1, 45, 5, { gtfsRefs: ['X'] })
    const items = plan([stop('X', 45, 5), stop('Y', 45.0001, 5)], { linked: [a1], catalog: [a1] })
    expect(items[0]!.action).toBe('served')
    expect(items[1]!.action).toBe('group') // même ref déjà prise : l'autre est un autre quai
    expect(items[1]!.arret).toBe(a1)
  })

  test('arrêt du catalogue (non lié) portant déjà cette ref à moins de 100 m : identité, ref connue', () => {
    const a = arret(1, 45, 5, { gtfsRefs: ['X'] })
    const [item] = plan([stop('X', 45.0008, 5, 'Autre nom')], { catalog: [a] })
    expect(item).toMatchObject({ action: 'adopt', arret: a, refKnown: true })
  })

  test('même ref mais à plus de 100 m (autre réseau) : pas d\'identité', () => {
    const a = arret(1, 45, 5, { gtfsRefs: ['X'] })
    const [item] = plan([stop('X', 45.01, 5)], { catalog: [a] })
    expect(item!.action).toBe('create')
  })
})

describe('planGtfsStops : importé → existant (50 m, ou 100 m si même nom)', () => {
  test('à 50 m ou moins, quel que soit le nom : l\'arrêt sans ref adopte la ref (identité)', () => {
    const a = arret(1, 45, 5)
    const [item] = plan([stop('s', 45.0004, 5, 'Tout autre nom')], { catalog: [a] })
    expect(item).toMatchObject({ action: 'adopt', arret: a, refKnown: false })
  })

  test('entre 50 et 100 m : seulement si le nom est identique (normalisé)', () => {
    const a = arret(1, 45, 5, { nom: 'Gare de Longchamp' })
    expect(plan([stop('s', 45.0008, 5, 'LONGCHAMP')], { catalog: [a] })[0]).toMatchObject({ action: 'adopt', arret: a })
    expect(plan([stop('s', 45.0008, 5, 'Autre')], { catalog: [a] })[0]!.action).toBe('create')
  })

  test('au-delà de 100 m : nouvel arrêt, même avec le même nom', () => {
    const a = arret(1, 45, 5, { nom: 'Mairie' })
    expect(plan([stop('s', 45.0012, 5, 'Mairie')], { catalog: [a] })[0]!.action).toBe('create')
  })

  test('plusieurs candidats : le plus proche', () => {
    const near = arret(1, 45.0001, 5)
    const far = arret(2, 45.0004, 5)
    expect(plan([stop('s', 45, 5)], { catalog: [far, near] })[0]!.arret).toBe(near)
  })

  test('l\'arrêt existant porte déjà une autre ref GTFS (autre quai ou autre flux) : regroupement', () => {
    const a = arret(1, 45, 5, { gtfsRefs: ['AUTRE'] })
    const [item] = plan([stop('s', 45.0002, 5)], { catalog: [a] })
    expect(item).toMatchObject({ action: 'group', arret: a })
  })

  test('arrêt lié sans ref (ancienne ligne), à proximité : adopté (« served » par proximité côté diff)', () => {
    const a = arret(1, 45, 5)
    const [item] = plan([stop('s', 45.0002, 5)], { linked: [a], catalog: [a] })
    expect(item).toMatchObject({ action: 'adopt', arret: a })
  })

  test('un arrêt déjà adopté par un arrêt GTFS du même import porte une ref : le suivant se regroupe', () => {
    const a = arret(1, 45, 5)
    const items = plan([stop('s1', 45.0001, 5), stop('s2', 45.0002, 5)], { catalog: [a] })
    expect(items.map((i) => i.action)).toEqual(['adopt', 'group'])
    expect(items[1]!.arret).toBe(a)
  })

  test('types : un arrêt de bus ne se rapproche pas d\'une gare, TER et TGV vont ensemble', () => {
    const gare = arret(2, 45, 5, { types: ['ter', 'tgv'] })
    const bus = arret(1, 45, 5, { types: ['bus'] })
    expect(plan([stop('s', 45, 5)], { catalog: [gare], stopTypes: ['bus'] })[0]!.action).toBe('create')
    expect(plan([stop('s', 45, 5)], { catalog: [gare, bus], stopTypes: ['bus'] })[0]!.arret).toBe(bus)
    expect(plan([stop('s', 45, 5)], { catalog: [bus, gare], stopTypes: ['ter'] })[0]!.arret).toBe(gare)
  })
})

describe('planGtfsStops : deux arrêts du GTFS entre eux', () => {
  test('même nom à moins de 200 m : regroupés (clé de groupe commune)', () => {
    const [a, b] = plan([stop('a', 45, 5, 'Mairie'), stop('b', 45.0016, 5, 'MAIRIE')]) // ~178 m
    expect(a!.action).toBe('create')
    expect(b!.action).toBe('create')
    expect(a!.groupe).not.toBeNull()
    expect(a!.groupe).toBe(b!.groupe)
    expect(a!.groupeStopId).toBeNull()
  })

  test('noms différents, ou plus de 200 m : pas de regroupement', () => {
    const items = plan([stop('a', 45, 5, 'Mairie'), stop('b', 45.0005, 5, 'École'), stop('c', 45.003, 5, 'Mairie')])
    expect(items.every((i) => i.groupe === null)).toBe(true)
  })

  test('deux arrêts consécutifs d\'un même trajet ne sont jamais regroupés', () => {
    const items = plan([stop('a', 45, 5, 'Mairie'), stop('b', 45.0005, 5, 'Mairie')], {
      consecutive: new Set(['a|b']),
    })
    expect(items.every((i) => i.groupe === null)).toBe(true)
  })

  test('même station parente GTFS : regroupés quelle que soit la distance, la station est mémorisée', () => {
    const [a, b] = plan([stop('q1', 46.1364, 5.1933, 'Longchamp', 'ST'), stop('q2', 46.1335, 5.1911, 'Longchamp', 'ST')]) // ~360 m
    expect(a!.groupe).not.toBeNull()
    expect(a!.groupe).toBe(b!.groupe)
    expect(a!.groupeStopId).toBe('ST')
    expect(b!.groupeStopId).toBe('ST')
  })

  test('un seul arrêt GTFS d\'une station : pas de regroupement à créer', () => {
    const [a] = plan([stop('q1', 46, 5, 'Longchamp', 'ST')])
    expect(a!.action).toBe('create')
    expect(a!.groupe).toBeNull()
  })

  test('un quai rapproché d\'un arrêt existant entraîne ses quais frères : tous se regroupent avec lui', () => {
    const x = arret(1, 46.1364, 5.1933, { nom: 'Longchamp' })
    const [q1, q2] = plan([stop('q1', 46.1364, 5.1933, 'Longchamp', 'ST'), stop('q2', 46.1335, 5.1911, 'Longchamp', 'ST')], { catalog: [x] })
    expect(q1).toMatchObject({ action: 'adopt', arret: x })
    expect(q2).toMatchObject({ action: 'group', arret: x, groupe: null, groupeStopId: 'ST' })
  })

  test('réimport : un nouveau quai d\'une station dont un quai est déjà suivi rejoint cet arrêt', () => {
    const a1 = arret(1, 46.1364, 5.1933, { gtfsRefs: ['q1'] })
    const [q1, q2] = plan([stop('q1', 46.1364, 5.1933, 'Longchamp', 'ST'), stop('q2', 46.1335, 5.1911, 'Longchamp', 'ST')], { linked: [a1], catalog: [a1] })
    expect(q1!.action).toBe('served')
    expect(q2).toMatchObject({ action: 'group', arret: a1, groupeStopId: 'ST' })
  })

  test('un arrêt à créer proche d\'un arrêt GTFS déjà rapproché d\'un existant se regroupe avec cet existant (même nom, < 200 m)', () => {
    const x = arret(1, 45, 5, { nom: 'Mairie' })
    const [s1, s2] = plan([stop('s1', 45, 5, 'Mairie'), stop('s2', 45.0016, 5, 'Mairie')], { catalog: [x] })
    expect(s1!.action).toBe('adopt')
    expect(s2).toMatchObject({ action: 'group', arret: x })
  })
})

describe('planGtfsStops : arrêts retirés', () => {
  test('les arrêts liés jamais rapprochés sont « retirés »', () => {
    const a1 = arret(1, 45, 5, { gtfsRefs: ['X'] })
    const a3 = arret(3, 45.2, 5.2) // lié, plus desservi
    const res = planGtfsStops([stop('X', 45, 5)], ctx({ linked: [a1, a3], catalog: [a1, a3] }))
    expect(res.removed.map((a) => a.id)).toEqual([3])
  })
})

describe('compareGtfsStops (aperçu de mise à jour)', () => {
  const a1 = arret(1, 45, 5, { gtfsRefs: ['s1'] })
  const a2 = arret(2, 45.1, 5.1)
  const a3 = arret(3, 45.2, 5.2) // lié, plus desservi
  const other = arret(9, 45.3, 5.3) // non lié, dans le catalogue

  test('trois groupes : toujours desservis (par id ou proximité), nouveaux (à lier / à créer), absents', () => {
    const stops = [stop('s1', 45, 5), stop('s2', 45.1001, 5.1), stop('s9', 45.3, 5.3001), stop('new', 44, 4)]
    const d = compareGtfsStops(stops, [a1, a2, a3], [a1, a2, a3, other])
    expect(d.served.map((s) => [s.arret.id, s.by])).toEqual([[1, 'id'], [2, 'proximite']])
    expect(d.added.map((a) => [a.stop.id, a.arret?.id ?? null, a.item.action])).toEqual([
      ['s9', 9, 'adopt'],
      ['new', null, 'create'],
    ])
    expect(d.removed.map((a) => a.id)).toEqual([3])
  })

  test('un arrêt à regrouper apparaît dans « nouveaux » avec son arrêt cible', () => {
    const x = arret(1, 45, 5, { gtfsRefs: ['AUTRE'] })
    const d = compareGtfsStops([stop('s', 45.0002, 5)], [], [x])
    expect(d.added[0]).toMatchObject({ arret: null, item: { action: 'group', arret: x } })
  })
})

describe('describePlanItem / nouvelArretExtra', () => {
  const x = arret(7, 45, 5, { nom: 'Gare de Longchamp' })
  const base = { stop: stop('q', 45, 5, 'Longchamp'), refKnown: false, by: null, groupe: null, groupeStopId: null } as const

  test('libellés', () => {
    expect(describePlanItem({ ...base, action: 'served', arret: x })).toContain('Gare de Longchamp')
    expect(describePlanItem({ ...base, action: 'adopt', arret: x })).toContain('Gare de Longchamp')
    expect(describePlanItem({ ...base, action: 'group', arret: x })).toMatch(/regroupé avec « Gare de Longchamp »/)
    expect(describePlanItem({ ...base, action: 'create', arret: null, groupe: 'g:q' })).toMatch(/regroupé/)
    expect(describePlanItem({ ...base, action: 'create', arret: null })).toMatch(/Nouvel arrêt/)
  })

  test('champs de regroupement transmis à add_ligne.php', () => {
    expect(nouvelArretExtra({ ...base, action: 'group', arret: x, groupeStopId: 'ST' })).toEqual({ regrouper_avec: 7, groupe_stop_id: 'ST' })
    expect(nouvelArretExtra({ ...base, action: 'group', arret: x })).toEqual({ regrouper_avec: 7 })
    expect(nouvelArretExtra({ ...base, action: 'create', arret: null, groupe: 'g:q', groupeStopId: 'ST' })).toEqual({ groupe: 'g:q', groupe_stop_id: 'ST' })
    expect(nouvelArretExtra({ ...base, action: 'create', arret: null })).toEqual({})
  })
})
