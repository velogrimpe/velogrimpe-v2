import { describe, expect, test } from 'bun:test'
import { accesPietonLabel, accesPietonChiffres } from './utils'

describe('accesPietonLabel', () => {
  test('gare : « en gare de <nom> »', () => {
    expect(accesPietonLabel({ gare_nom: 'Tenay - Hauteville', acces_pieton_types: ['ter'], acces_pieton_lignes: [] })).toBe(
      'Accès piéton possible via TER en gare de Tenay - Hauteville',
    )
  })

  test('TGV compte aussi comme gare', () => {
    expect(accesPietonLabel({ gare_nom: 'Lyon', acces_pieton_types: ['tgv'], acces_pieton_lignes: [] })).toBe(
      'Accès piéton possible via TGV en gare de Lyon',
    )
  })

  test('autre arrêt : « à l\'arrêt <nom> », lignes entre parenthèses après le mode', () => {
    expect(accesPietonLabel({ gare_nom: 'Sormiou Cayolle', acces_pieton_types: ['bus'], acces_pieton_lignes: ['L21', 'L22'] })).toBe(
      "Accès piéton possible via Bus (L21, L22) à l'arrêt Sormiou Cayolle",
    )
  })

  test('plusieurs modes : liés par une virgule ; une gare l\'emporte sur « arrêt »', () => {
    expect(accesPietonLabel({ gare_nom: 'Belley', acces_pieton_types: ['ter', 'bus'], acces_pieton_lignes: [] })).toBe(
      'Accès piéton possible via TER, Bus en gare de Belley',
    )
  })
})

describe('accesPietonChiffres', () => {
  test('km, D+ et D- renseignés', () => {
    expect(accesPietonChiffres({ acces_pieton_km: 1.5, acces_pieton_dplus: 120, acces_pieton_dmoins: 20 })).toBe('1.5 km, 120 D+, 20 D-')
  })

  test('uniquement ce qui est renseigné', () => {
    expect(accesPietonChiffres({ acces_pieton_km: 0.4, acces_pieton_dplus: null, acces_pieton_dmoins: null })).toBe('0.4 km')
    expect(accesPietonChiffres({ acces_pieton_km: null, acces_pieton_dplus: 40, acces_pieton_dmoins: null })).toBe('40 D+')
  })

  test('un 0 est une vraie valeur, pas une absence', () => {
    expect(accesPietonChiffres({ acces_pieton_km: 2, acces_pieton_dplus: 0, acces_pieton_dmoins: 0 })).toBe('2 km, 0 D+, 0 D-')
  })

  test('rien de renseigné (ou champs absents, itinéraire vélo) : chaîne vide', () => {
    expect(accesPietonChiffres({ acces_pieton_km: null, acces_pieton_dplus: null, acces_pieton_dmoins: null })).toBe('')
    expect(accesPietonChiffres({})).toBe('')
  })
})
