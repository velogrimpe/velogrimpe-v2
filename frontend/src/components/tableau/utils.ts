export const nbVoiesCorresp: Record<number, string> = {
  10: '0-20 voies',
  20: '~20 voies',
  35: '20-50 voies',
  50: '~50 voies',
  75: '50-100 voies',
  100: '~100 voies',
  150: '100-200 voies',
  200: '~200 voies',
  350: '200-500 voies',
  500: '~500 voies',
  1000: '500+ voies',
}

export function getNbVoiesLabel(nbVoies: number): string {
  return nbVoiesCorresp[nbVoies] || 'Voies'
}

const modeLabels: Record<string, string> = {
  ter: 'TER',
  tgv: 'TGV',
  bus: 'Bus',
  tram: 'Tram',
  telepherique: 'Téléphérique',
}

/**
 * « Accès piéton possible via TER en gare de Tenay - Hauteville » : modes de
 * l'arrêt, ses lignes le cas échéant (« via Bus (L21, L22) »), puis son nom —
 * « en gare de » pour un arrêt TER/TGV, « à l'arrêt » sinon.
 */
export function accesPietonLabel(it: {
  gare_nom: string
  acces_pieton_types: string[]
  acces_pieton_lignes: string[]
}): string {
  const modes = it.acces_pieton_types.map((t) => modeLabels[t] ?? t).join(', ')
  const lignes = it.acces_pieton_lignes.length ? ` (${it.acces_pieton_lignes.join(', ')})` : ''
  const estGare = it.acces_pieton_types.some((t) => t === 'ter' || t === 'tgv')
  return `Accès piéton possible via ${modes}${lignes} ${estGare ? 'en gare de' : "à l'arrêt"} ${it.gare_nom}`
}
