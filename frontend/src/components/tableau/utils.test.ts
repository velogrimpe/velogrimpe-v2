import { describe, expect, test } from 'bun:test'
import { accesPietonLabel } from './utils'

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
