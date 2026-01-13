export function formatTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) {
    return ''
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours > 0) {
    return `${hours}h${remainingMinutes.toString().padStart(2, '0')}`
  } else {
    return `${remainingMinutes}'`
  }
}

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
