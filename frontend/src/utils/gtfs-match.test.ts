import { describe, expect, test } from 'bun:test'
import { compareGtfsStops, type ArretGeo } from './gtfs-match'

const stop = (id: string, lat: number, lng: number) => ({ id, nom: `S${id}`, lat, lng })
const arret = (id: number, lat: number, lng: number): ArretGeo => ({ id, nom: `A${id}`, lat, lng })

describe('compareGtfsStops', () => {
  const a1 = arret(1, 45.0, 5.0)
  const a2 = arret(2, 45.1, 5.1)
  const a3 = arret(3, 45.2, 5.2) // lié, plus desservi
  const other = arret(9, 45.3, 5.3) // non lié, dans le catalogue

  test('stop_id mémorisé prime sur la proximité, même si l\'arrêt a bougé', () => {
    const d = compareGtfsStops([stop('X', 46, 6)], [a1], [a1], { 1: ['X'] })
    expect(d.served).toHaveLength(1)
    expect(d.served[0].by).toBe('id')
    expect(d.removed).toHaveLength(0)
  })

  test('proximité en secours, avec les trois groupes', () => {
    const stops = [stop('s1', 45.0001, 5.0), stop('s2', 45.1, 5.1), stop('s9', 45.3, 5.3001), stop('new', 44, 4)]
    const d = compareGtfsStops(stops, [a1, a2, a3], [a1, a2, a3, other], {})
    expect(d.served.map((s) => [s.arret.id, s.by])).toEqual([[1, 'proximite'], [2, 'proximite']])
    expect(d.added.map((a) => a.arret?.id ?? null)).toEqual([9, null])
    expect(d.removed.map((a) => a.id)).toEqual([3])
  })

  test('un arrêt lié n\'est rapproché que d\'un seul arrêt GTFS', () => {
    const d = compareGtfsStops([stop('a', 45, 5), stop('b', 45.0001, 5)], [a1], [a1], {})
    expect(d.served).toHaveLength(1)
    expect(d.added).toHaveLength(1)
  })

  test('hors seuil : nouvel arrêt', () => {
    const d = compareGtfsStops([stop('far', 45.01, 5)], [a1], [a1], {})
    expect(d.added[0].arret).toBeNull()
    expect(d.removed).toEqual([a1])
  })
})
