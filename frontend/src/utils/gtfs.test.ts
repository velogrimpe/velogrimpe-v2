import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import {
  agencyForRoute,
  listRouteStops,
  listRoutes,
  parseCsv,
  readGtfs,
  routeModalites,
  routeToLigneFields,
  simplifyLine,
  shapesToMultiLineString,
} from './gtfs'

const AGENCY = `﻿agency_id,agency_name,agency_url,agency_timezone
A1,"Cars, Région",https://cars.example.org,Europe/Paris
A2,Autre réseau,https://autre.example.org,Europe/Paris
`
const ROUTES = `route_id,agency_id,route_short_name,route_long_name,route_url,route_color
R1,A1,S01,"ST-ALBAN < > CHAMBÉRY",https://cars.example.org/s01,DE5202
R2,A2,T2,Tram 2,,
R3,A1,S09,Sans trip,,FFFFFF
`
const TRIPS = `route_id,trip_id,shape_id
R1,t1,SH_A
R1,t2,SH_A
R1,t3,SH_B
R1,t4,SH_DUP
R2,t5,SH_C
R2,t6,
`
// SH_A volontairement désordonné (sequence) ; SH_DUP identique à SH_B
const SHAPES = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
SH_A,45.2,5.2,2
SH_A,45.0,5.0,0
SH_A,45.2,5.0,1
SH_B,46.0,6.0,0
SH_B,46.1,6.1,1
SH_DUP,46.0,6.0,0
SH_DUP,46.1,6.1,1
SH_C,47.0,7.0,0
SH_C,47.1,7.1,1
`

function buildZip(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
}

describe('parseCsv', () => {
  test('lit en-têtes et lignes, retire le BOM', () => {
    expect(parseCsv('﻿a,b\n1,2\n3,4\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })
  test('champs entre guillemets : virgules, guillemets échappés, retours à la ligne', () => {
    expect(parseCsv('a,b\n"x, y","il dit ""oui"""\n"l1\nl2",z\n')).toEqual([
      { a: 'x, y', b: 'il dit "oui"' },
      { a: 'l1\nl2', b: 'z' },
    ])
  })
  test('fins de ligne CRLF et absence de saut de ligne final', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })
  test('champs vides et lignes vides ignorées', () => {
    expect(parseCsv('a,b,c\n1,,3\n\n,,\n')).toEqual([
      { a: '1', b: '', c: '3' },
      { a: '', b: '', c: '' },
    ])
  })
  test('texte vide', () => {
    expect(parseCsv('')).toEqual([])
  })
})

describe('readGtfs / listRoutes', () => {
  const feed = readGtfs(buildZip({ 'agency.txt': AGENCY, 'routes.txt': ROUTES, 'trips.txt': TRIPS, 'shapes.txt': SHAPES }))

  test('liste les lignes de routes.txt avec leurs shape_id (via trips.txt)', () => {
    const routes = listRoutes(feed)
    expect(routes.map((r) => r.id)).toEqual(['R1', 'R2', 'R3'])
    const r1 = routes[0]!
    expect(r1.numero).toBe('S01')
    expect(r1.nom).toBe('ST-ALBAN < > CHAMBÉRY')
    expect(r1.couleur).toBe('#DE5202')
    expect(r1.shapeIds.sort()).toEqual(['SH_A', 'SH_B', 'SH_DUP'])
    expect(r1.tripCount).toBe(4)
  })
  test('route sans couleur → null, trips sans shape_id ignorés, route sans trip → aucun shape', () => {
    const [, r2, r3] = listRoutes(feed)
    expect(r2!.couleur).toBeNull()
    expect(r2!.shapeIds).toEqual(['SH_C'])
    expect(r3!.shapeIds).toEqual([])
    expect(r3!.tripCount).toBe(0)
  })
  test('zip sans shapes.txt : lignes listées, shapes vide', () => {
    const f = readGtfs(buildZip({ 'agency.txt': AGENCY, 'routes.txt': ROUTES, 'trips.txt': TRIPS }))
    expect(listRoutes(f)).toHaveLength(3)
    expect(f.shapesText).toBeNull()
  })
  test('zip dont les fichiers sont dans un sous-dossier', () => {
    const f = readGtfs(buildZip({ 'gtfs/routes.txt': ROUTES, 'gtfs/trips.txt': TRIPS }))
    expect(listRoutes(f)).toHaveLength(3)
  })
  test('zip sans routes.txt → erreur explicite', () => {
    expect(() => readGtfs(buildZip({ 'agency.txt': AGENCY }))).toThrow(/routes\.txt/)
  })
})

describe('shapesToMultiLineString', () => {
  const feed = readGtfs(buildZip({ 'routes.txt': ROUTES, 'trips.txt': TRIPS, 'shapes.txt': SHAPES }))

  test('ordonne par sequence et inverse en [lng, lat]', () => {
    const g = shapesToMultiLineString(feed.shapesText!, ['SH_A'])
    expect(g).toEqual({
      type: 'MultiLineString',
      coordinates: [
        [
          [5.0, 45.0],
          [5.0, 45.2],
          [5.2, 45.2],
        ],
      ],
    })
  })
  test('plusieurs shape_id → plusieurs lignes, doublons géométriques écartés', () => {
    const g = shapesToMultiLineString(feed.shapesText!, ['SH_A', 'SH_B', 'SH_DUP'])
    expect(g!.coordinates).toHaveLength(2)
  })
  test('sans liste de shape_id : toutes les formes (import d\'un shapes.txt isolé)', () => {
    expect(shapesToMultiLineString(SHAPES)!.coordinates).toHaveLength(3)
  })
  test('shape_id inconnus ou texte absent → null', () => {
    expect(shapesToMultiLineString(SHAPES, ['NOPE'])).toBeNull()
    expect(shapesToMultiLineString(null, ['SH_A'])).toBeNull()
  })
  test('une forme à un seul point est ignorée (pas une ligne valide)', () => {
    const one = 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nX,45,5,0\n'
    expect(shapesToMultiLineString(one)).toBeNull()
  })
})

describe('agencyForRoute / routeToLigneFields', () => {
  const feed = readGtfs(buildZip({ 'agency.txt': AGENCY, 'routes.txt': ROUTES, 'trips.txt': TRIPS, 'shapes.txt': SHAPES }))
  const routes = listRoutes(feed)

  test('agence rattachée à la route par agency_id', () => {
    expect(agencyForRoute(feed, routes[1]!)).toEqual({ operateur: 'Autre réseau', operateur_url: 'https://autre.example.org' })
  })
  test('champs du formulaire alimentés depuis la route et l\'agence', () => {
    expect(routeToLigneFields(feed, routes[0]!)).toEqual({
      nom: 'ST-ALBAN < > CHAMBÉRY',
      numero: 'S01',
      operateur: 'Cars, Région',
      operateur_url: 'https://cars.example.org',
      horaire_url: 'https://cars.example.org/s01',
      ref: 'R1',
      couleur: '#DE5202',
    })
  })
  test('sans agency.txt : opérateur null', () => {
    const f = readGtfs(buildZip({ 'routes.txt': ROUTES, 'trips.txt': TRIPS }))
    const fields = routeToLigneFields(f, listRoutes(f)[0]!)
    expect(fields.operateur).toBeNull()
    expect(fields.operateur_url).toBeNull()
  })
  test('nom de repli sur le numéro si route_long_name est vide', () => {
    const f = readGtfs(buildZip({ 'routes.txt': 'route_id,route_short_name,route_long_name\nR9,Z9,\n', 'trips.txt': 'route_id,trip_id,shape_id\n' }))
    expect(routeToLigneFields(f, listRoutes(f)[0]!).nom).toBe('Z9')
  })
})

describe('listRouteStops / routeModalites', () => {
  // Deux quais (type 0) rattachés à la gare parente P1 ; Q3 sans parent ; Q9 hors ligne R1
  const STOPS = `stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station
P1,Gare centrale,45.0,5.0,1,
Q1a,Gare centrale,45.0001,5.0001,0,P1
Q1b,Gare centrale,45.0002,5.0002,0,P1
Q2,Mairie,45.1,5.1,0,
Q3,Lycée,45.2,5.2,0,
Q9,Ailleurs,46.0,6.0,0,
`
  const STOP_TIMES = `trip_id,arrival_time,departure_time,stop_id,stop_sequence
t1,07:00,07:00,Q1a,1
t1,07:10,07:10,Q2,2
t1,07:20,07:20,Q3,3
t2,08:00,08:00,Q3,1
t2,08:10,08:10,Q2,2
t2,08:20,08:20,Q1b,3
t5,09:00,09:00,Q9,1
`
  const feed = readGtfs(
    buildZip({ 'agency.txt': AGENCY, 'routes.txt': ROUTES, 'trips.txt': TRIPS, 'stops.txt': STOPS, 'stop_times.txt': STOP_TIMES }),
  )
  const routes = listRoutes(feed)

  test('arrêts de la ligne : un par lieu (quais regroupés sous leur gare parente), dans l\'ordre du trajet', () => {
    const stops = listRouteStops(feed, routes[0]!)
    expect(stops).toEqual([
      { id: 'P1', nom: 'Gare centrale', lat: 45.0, lng: 5.0 },
      { id: 'Q2', nom: 'Mairie', lat: 45.1, lng: 5.1 },
      { id: 'Q3', nom: 'Lycée', lat: 45.2, lng: 5.2 },
    ])
  })
  test('les arrêts des autres lignes ne sont pas inclus', () => {
    expect(listRouteStops(feed, routes[1]!).map((s) => s.id)).toEqual(['Q9'])
  })
  test('ligne sans trajet → aucun arrêt', () => {
    expect(listRouteStops(feed, routes[2]!)).toEqual([])
  })
  test('zip sans stops.txt / stop_times.txt → aucun arrêt, pas d\'erreur', () => {
    const f = readGtfs(buildZip({ 'routes.txt': ROUTES, 'trips.txt': TRIPS }))
    expect(listRouteStops(f, listRoutes(f)[0]!)).toEqual([])
  })
  test('modalité déduite de route_type (GTFS de base et étendu), bus par défaut', () => {
    const m = (route_type: string) => {
      const f = readGtfs(buildZip({ 'routes.txt': `route_id,route_type\nR,${route_type}\n`, 'trips.txt': 'route_id,trip_id,shape_id\n' }))
      return routeModalites(listRoutes(f)[0]!)
    }
    expect(m('3')).toEqual(['bus'])
    expect(m('200')).toEqual(['bus'])
    expect(m('0')).toEqual(['tram'])
    expect(m('900')).toEqual(['tram'])
    expect(m('6')).toEqual(['telepherique'])
    expect(m('2')).toEqual(['ter'])
    expect(m('')).toEqual(['bus'])
  })
})

// GTFS réel (Savoie) : garde-fou sur des données de production, ignoré si le zip est absent
const SAVOIE = resolve(import.meta.dir, '../../../assets/gtfs_savoie.zip')
describe.skipIf(!existsSync(SAVOIE))('GTFS Savoie (données réelles)', () => {
  const feed = readGtfs(new Uint8Array(readFileSync(SAVOIE)))
  const routes = listRoutes(feed)

  test('20 lignes, toutes avec un numéro, un nom et au moins un shape', () => {
    expect(routes).toHaveLength(20)
    for (const r of routes) {
      expect(r.numero).toBeTruthy()
      expect(r.nom).toBeTruthy()
      expect(r.shapeIds.length).toBeGreaterThan(0)
    }
  })
  test('S01 : couleur #DE5202, opérateur de l\'agence, géométrie en Savoie (lng 5-7, lat 45-46)', () => {
    const s01 = routes.find((r) => r.numero === 'S01')!
    expect(s01.couleur).toBe('#DE5202')
    expect(routeToLigneFields(feed, s01).operateur).toBe('REGION - cars Région Savoie')
    const g = shapesToMultiLineString(feed.shapesText, s01.shapeIds)!
    expect(g.coordinates.length).toBeGreaterThan(0)
    for (const line of g.coordinates)
      for (const [lng, lat] of line) {
        expect(lng).toBeGreaterThan(5)
        expect(lng).toBeLessThan(7)
        expect(lat).toBeGreaterThan(45)
        expect(lat).toBeLessThan(46)
      }
  })
  test('S01 : arrêts uniques, nommés, situés en Savoie', () => {
    const s01 = routes.find((r) => r.numero === 'S01')!
    const stops = listRouteStops(feed, s01)
    expect(stops.length).toBeGreaterThan(5)
    expect(new Set(stops.map((s) => s.id)).size).toBe(stops.length)
    for (const st of stops) {
      expect(st.nom).toBeTruthy()
      expect(st.lat).toBeGreaterThan(45)
      expect(st.lat).toBeLessThan(46)
    }
    expect(routeModalites(s01)).toEqual(['bus'])
  })
})

describe('simplifyLine / shapesToMultiLineString (volume)', () => {
  test('supprime les points colinéaires et conserve les extrémités', () => {
    const line = Array.from({ length: 101 }, (_, i) => [5 + i * 0.0001, 45])
    expect(simplifyLine(line)).toEqual([line[0], line[100]])
  })
  test('conserve un vrai virage', () => {
    const line = [[5, 45], [5.01, 45], [5.01, 45.01]]
    expect(simplifyLine(line)).toEqual(line)
  })
  test('arrondit à 5 décimales', () => {
    const txt = 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\na,45.123456789,5.987654321,0\na,45.2,6,1\n'
    expect(shapesToMultiLineString(txt)!.coordinates[0]![0]).toEqual([5.98765, 45.12346])
  })
})
