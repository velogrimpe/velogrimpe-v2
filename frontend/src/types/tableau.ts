export type SortKey = "total" | "train" | "velo" | "voies" | "approche" | "altitude";
export type SortDir = "asc" | "desc";

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export interface TableauItinerary {
  falaise_id: number;
  falaise_nom: string;
  falaise_cotmin: string;
  falaise_cotmax: string;
  falaise_nbvoies: number;
  falaise_maa: number;
  falaise_exposhort1: string;
  falaise_exposhort2: string;
  falaise_altitude: number | null;
  falaise_bloc: number;
  falaise_gvnb: string | null;
  falaise_fermee: string;
  falaise_zonename: string | null;
  falaise_deptname: string | null;
  falaise_deptcode: string | null;
  /** Nom de l'arrêt (gare) d'où part l'accès. */
  gare_nom: string;
  train_temps: number;
  train_arrivee: string;
  train_correspmin: number;
  train_correspmax: number;
  train_tgv: number;
  velo_km: number;
  velo_dplus: number;
  velo_dmoins: number;
  velo_apiedpossible: number;
  /** 1 : ligne issue d'un accès à pied depuis l'arrêt (acces_falaise, type 'pied'), sans itinéraire vélo. */
  acces_pieton: number;
  /** 1 : la falaise a au moins un accès à pied depuis un arrêt (critère du filtre « Accessible à pied »). */
  falaise_acces_pieton: number;
  /** null pour un accès à pied (temps de marche arrêt → falaise inconnu). */
  temps_total: number | null;
  /** Modalités de l'arrêt d'un accès à pied (ter, tgv, bus, tram, telepherique) ; [] pour un itinéraire vélo. */
  acces_pieton_types: string[];
  /** Noms des lignes qui desservent l'arrêt d'un accès à pied. */
  acces_pieton_lignes: string[];
  /** Distance et dénivelés de l'accès à pied, quand ils sont renseignés (null sinon ; toujours null pour un itinéraire vélo). */
  acces_pieton_km: number | null;
  acces_pieton_dplus: number | null;
  acces_pieton_dmoins: number | null;
  variante: number;
  variante_a_pied: number;
  ville_nom: string;
}

export type TableauFalaise = TableauItinerary[];
