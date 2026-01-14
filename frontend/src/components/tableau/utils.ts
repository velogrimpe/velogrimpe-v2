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
