export type Exposition = 'N' | 'E' | 'S' | 'O'
export type Cotation = '40' | '50' | '59' | '60' | '69' | '70' | '79' | '80'

/**
 * Vrai si l'altitude (en mètres) est dans l'intervalle [min, max] (bornes
 * incluses, chacune optionnelle). Aucune borne => pas de filtre (toujours vrai).
 * Une altitude inconnue (null) est exclue dès qu'une borne est définie.
 */
export function matchesAltitude(
  altitude: number | null | undefined,
  min: number | null,
  max: number | null,
): boolean {
  if (min === null && max === null) return true
  if (altitude === null || altitude === undefined) return false
  const a = Number(altitude)
  if (!Number.isFinite(a)) return false
  return (min === null || a >= min) && (max === null || a <= max)
}

export interface FilterState {
  // Exposition (OR logic between selected)
  exposition: Exposition[]

  // Altitude (en mètres) : intervalle libre, bornes optionnelles
  altitude: {
    min: number | null
    max: number | null
  }

  // Cotations (AND logic - falaise must have routes in ALL selected ranges)
  cotations: Cotation[]

  // Type de voies (OR logic)
  typeVoies: {
    couenne: boolean
    grandeVoie: boolean
    bloc: boolean
    psychobloc: boolean
  }

  // Nombre de voies minimum
  nbVoiesMin: number

  // Ville de depart (null = no city filter)
  villeId: string | null

  // Train filters (only apply when villeId is set)
  train: {
    tempsMax: number | null
    correspMax: number | null // 0, 1, or null (unlimited)
    terOnly: boolean
  }

  // Velo filters
  velo: {
    tempsMax: number | null
    distMax: number | null
    denivMax: number | null
    apiedPossible: boolean
  }

  // Approche (marche d'approche)
  approche: {
    tempsMax: number | null
  }

  // Total time filters (only apply when villeId is set)
  total: {
    tempsTV: number | null // Train + Velo
    tempsTVA: number | null // Train + Velo + Approche
  }
}

export const defaultFilters: FilterState = {
  exposition: [],
  altitude: {
    min: null,
    max: null,
  },
  cotations: [],
  typeVoies: {
    couenne: false,
    grandeVoie: false,
    bloc: false,
    psychobloc: false,
  },
  nbVoiesMin: 0,
  villeId: null,
  train: {
    tempsMax: null,
    correspMax: null,
    terOnly: false,
  },
  velo: {
    tempsMax: null,
    distMax: null,
    denivMax: null,
    apiedPossible: false,
  },
  approche: {
    tempsMax: null,
  },
  total: {
    tempsTV: null,
    tempsTVA: null,
  },
}
