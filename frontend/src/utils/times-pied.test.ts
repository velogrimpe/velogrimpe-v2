import { describe, expect, test } from 'bun:test'
// Utilitaire JS « historique » partagé avec les pages PHP (ES module, sans types)
// @ts-ignore
import { calculate_time_pied, pied_tooltip_html } from '../../../public_html/js/components/utils/times.js'

describe('calculate_time_pied (DIN 33466 : 4 km/h, +300 m/h, -500 m/h, max + min/2)', () => {
  test('durée en minutes quand km, D+ et D- sont renseignés', () => {
    // 4 km → 1 h à plat ; 600 m D+ → 2 h, 500 m D- → 1 h : vertical 3 h ; 3 h + 1 h / 2 = 3,5 h
    expect(calculate_time_pied({ km: 4, dplus: 600, dmoins: 500 })).toBe(210)
    // Plat : 8 km → 2 h
    expect(calculate_time_pied({ km: 8, dplus: 0, dmoins: 0 })).toBe(120)
    // 1,9 km, +40, -50 : horizontal 0,475 h, vertical 0,233 h → 0,592 h ≈ 36'
    expect(calculate_time_pied({ km: 1.9, dplus: 40, dmoins: 50 })).toBe(36)
  })

  test('null dès qu\'un paramètre manque (pas de durée approximative)', () => {
    expect(calculate_time_pied({ km: 2, dplus: 100, dmoins: null })).toBeNull()
    expect(calculate_time_pied({ km: null, dplus: 100, dmoins: 10 })).toBeNull()
    expect(calculate_time_pied({ km: 2 })).toBeNull()
    expect(calculate_time_pied({ km: '', dplus: 1, dmoins: 1 })).toBeNull()
  })

  test('0 est une vraie valeur', () => {
    expect(calculate_time_pied({ km: 2, dplus: 0, dmoins: 0 })).toBe(30)
  })
})

describe('pied_tooltip_html', () => {
  test('durée + icône de pas quand tout est renseigné', () => {
    const html = pied_tooltip_html({ km: 8, dplus: 0, dmoins: 0 })
    expect(html).toContain('2h00')
    expect(html).toContain('#footprint')
    expect(html).not.toContain('km')
  })

  test('sinon la distance, avec l\'icône', () => {
    const html = pied_tooltip_html({ km: 1.5, dplus: null, dmoins: null })
    expect(html).toContain('1.5 km')
    expect(html).toContain('#footprint')
  })

  test('rien de renseigné : pas de tooltip', () => {
    expect(pied_tooltip_html({ km: null, dplus: null, dmoins: null })).toBeNull()
  })
})
