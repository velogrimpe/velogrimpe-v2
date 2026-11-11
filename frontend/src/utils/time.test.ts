import { describe, expect, test } from 'bun:test'
import { calculatePiedTime } from './time'

describe('calculatePiedTime (4 km/h + 500 m D+/h)', () => {
  test('durée en minutes quand km et D+ sont renseignés', () => {
    // 2 km → 30', 250 m D+ → 30'
    expect(calculatePiedTime({ km: 2, dplus: 250 })).toBe(60)
    // 3,3 km → 49,5', 450 m D+ → 54' : 103,5' arrondi à 104'
    expect(calculatePiedTime({ km: '3.3', dplus: '450' })).toBe(104)
  })

  test('0 est une vraie valeur', () => {
    expect(calculatePiedTime({ km: 4, dplus: 0 })).toBe(60)
  })

  test('null dès que km ou D+ manque', () => {
    expect(calculatePiedTime({ km: 2, dplus: null })).toBeNull()
    expect(calculatePiedTime({ km: null, dplus: 100 })).toBeNull()
    expect(calculatePiedTime({ km: '', dplus: 100 })).toBeNull()
  })
})
