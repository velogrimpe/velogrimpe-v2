export type SortKey = 'total' | 'train' | 'velo' | 'voies' | 'approche'
export type SortDir = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  dir: SortDir
}

export interface TableauItinerary {
  falaise_id: number
  falaise_nom: string
  falaise_cotmin: string
  falaise_cotmax: string
  falaise_nbvoies: number
  falaise_maa: number
  falaise_exposhort1: string
  falaise_exposhort2: string
  falaise_bloc: number
  falaise_gvnb: string | null
  falaise_fermee: string
  zone_nom: string
  train_temps: number
  train_arrivee: string
  train_correspmin: number
  train_correspmax: number
  train_tgv: number
  velo_km: number
  velo_dplus: number
  velo_dmoins: number
  velo_apieduniquement: number
  velo_apiedpossible: number
  temps_total: number
  variante: number
  variante_a_pied: number
  ville_nom: string
}

export type TableauFalaise = TableauItinerary[]
