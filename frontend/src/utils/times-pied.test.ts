import { describe, expect, test } from 'bun:test'
// Utilitaire JS « historique » partagé avec les pages PHP (ES module, sans types)
// @ts-ignore
import { calculate_time_pied, pied_tooltip_html } from '../../../public_html/js/components/utils/times.js'

describe('calculate_time_pied (4 km/h + 500 m D+/h)', () => {
  test('durée en minutes quand km et D+ sont renseignés (le D- est ignoré)', () => {
    // 4 km → 1 h ; 250 m D+ → 30' : 90'
    expect(calculate_time_pied({ km: 4, dplus: 250 })).toBe(90)
    expect(calculate_time_pied({ km: 4, dplus: 250, dmoins: 999 })).toBe(90)
    // Plat : 8 km → 2 h
    expect(calculate_time_pied({ km: 8, dplus: 0 })).toBe(120)
    // 1,9 km (28,5') + 40 m D+ (4,8') → 33'
    expect(calculate_time_pied({ km: 1.9, dplus: 40 })).toBe(33)
  })

  test('null dès qu\'un paramètre manque (pas de durée approximative)', () => {
    expect(calculate_time_pied({ km: 2, dplus: null })).toBeNull()
    expect(calculate_time_pied({ km: null, dplus: 100 })).toBeNull()
    expect(calculate_time_pied({ km: 2 })).toBeNull()
    expect(calculate_time_pied({ km: '', dplus: 1 })).toBeNull()
  })

  test('0 est une vraie valeur', () => {
    expect(calculate_time_pied({ km: 2, dplus: 0 })).toBe(30)
  })
})

describe('pied_tooltip_html', () => {
  test('durée + icône de pas quand tout est renseigné', () => {
    const html = pied_tooltip_html({ km: 8, dplus: 0 })
    expect(html).toContain('2h00')
    expect(html).toContain('#footprint')
    expect(html).not.toContain('km')
  })

  test('sinon la distance, avec l\'icône', () => {
    const html = pied_tooltip_html({ km: 1.5, dplus: null })
    expect(html).toContain('1.5 km')
    expect(html).toContain('#footprint')
  })

  test('rien de renseigné : pas de tooltip', () => {
    expect(pied_tooltip_html({ km: null, dplus: null })).toBeNull()
  })
})
