export interface FalaiseAlternative {
  nom: string
  id?: number
}

export interface Sortie {
  sortie_id: number
  organisateur_nom: string
  ville_depart: string
  ville_id: number | null
  falaise_principale_nom: string
  falaise_principale_id: number | null
  falaises_alternatives: FalaiseAlternative[]
  velo_nom: string | null
  velo_id: number | null
  lien_groupe: string
  description: string
  date_debut: string // YYYY-MM-DD format
  date_fin: string | null // YYYY-MM-DD format
  nb_interesses: number
  date_creation: string
  date_modification: string | null
  is_past?: boolean
  is_multi_day?: boolean
}

export interface VeloRoute {
  velo_id: number
  gare_id: number
  velo_depart: string
  velo_arrivee: string
  velo_km: number
  velo_dplus: number
  velo_dmoins: number
  velo_descr: string
  velo_openrunner: string | null
  velo_variante: string
  velo_apieduniquement: number
  velo_apiedpossible: number
  gare_nom: string
  gare_nomformate: string
  gare_tgv: number
}

export interface Ville {
  ville_id: number
  ville_nom: string
  ville_tableau: number
}

export interface ParticipationRequest {
  participant_nom: string
  participant_email: string
  participant_telephone?: string
  preferences_contact: {
    signal: boolean
    whatsapp: boolean
    email: boolean
    telephone: boolean
  }
  message?: string
}
