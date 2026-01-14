/**
 * Format minutes as human-readable time (e.g., "1h30" or "45'")
 */
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

/**
 * Calculate bike/walk travel time in minutes
 * Formula: km/20 + D+/500 for bike, km/4 + D+/500 for walking
 */
export function calculateVeloTime(itinerary: {
  velo_km: number | string
  velo_dplus: number | string
  velo_apieduniquement?: number | string | null
}): number {
  const { velo_km, velo_dplus, velo_apieduniquement } = itinerary
  const km = typeof velo_km === 'string' ? parseFloat(velo_km) : velo_km
  const dplus = typeof velo_dplus === 'string' ? parseInt(velo_dplus, 10) : velo_dplus
  const isWalking = velo_apieduniquement === 1 || velo_apieduniquement === '1'

  let timeInHours: number
  if (isWalking) {
    // Walking: 4 km/h + 500m D+/h
    timeInHours = km / 4 + dplus / 500
  } else {
    // Biking: 20 km/h + 500m D+/h
    timeInHours = km / 20 + dplus / 500
  }

  return Math.round(timeInHours * 60)
}
