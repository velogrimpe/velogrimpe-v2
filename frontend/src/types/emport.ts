export interface EmportRow {
  emport_id: number;
  type_train: string;
  compagnie_region: string;
  regle_demonte: string | null;
  regle_nondemonte: string | null;
  source1: string | null;
  source2: string | null;
}

export type EmportCategory = "all" | "GV" | "Intercité" | "Régional";
