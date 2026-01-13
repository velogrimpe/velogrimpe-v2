export type Exposition = 'N' | 'E' | 'S' | 'O'
export type Cotation = '40' | '50' | '59' | '60' | '69' | '70' | '79' | '80'

export interface FilterState {
  // Exposition (OR logic between selected)
  exposition: Exposition[]

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
