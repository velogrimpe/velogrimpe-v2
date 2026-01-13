export interface VilleTrainInfo {
  ville_id: string
  ville: string
  temps: number
  nCorresp: number
  train_tgv: number
}

export interface VilleAccess extends VilleTrainInfo {
  tempsTrainVelo: number
  tempsTotal: number
}

export interface Gare {
  gare_id: string
  gare_nom: string
  gare_latlng: string
  gare_tgv: string
  deleted: string
  villes: VilleTrainInfo[]
}

export interface Velo {
  velo_id: string
  gare_id: string
  falaise_id: string
  velo_km: string
  velo_dplus: string
  velo_temps: string
  velo_apieduniquement: string
  velo_apiedpossible: string
  velo_variante: string
  velo_public: string
  tempsVelo: number
}

export interface Access extends Velo {
  gare: Gare
  villes: VilleAccess[]
}

export interface Falaise {
  falaise_id: string
  falaise_nom: string
  falaise_nomformate: string
  falaise_latlng: string
  falaise_fermee: string | null
  falaise_bloc: string
  falaise_cotmin: string
  falaise_cotmax: string
  falaise_cottxt: string
  falaise_nbvoies: string
  falaise_voies: string
  falaise_gvnb: string | null
  falaise_gvtxt: string | null
  falaise_maa: number | null
  falaise_matxt: string | null
  falaise_exposhort1: string
  falaise_exposhort2: string
  falaise_expotxt: string
  falaise_voletcarto: string
  falaise_public: string
  access: Access[]
  // Runtime state
  filteredOut?: boolean
  highlighted?: boolean
  type?: 'falaise' | 'falaise_hors_topo'
}

export interface Ville {
  ville_id: string
  ville_nom: string
}
