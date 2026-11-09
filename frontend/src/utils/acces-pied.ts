/**
 * Lecture des champs d'un accès à pied (composant AccesPiedFields) dans le DOM, pour les formulaires qui
 * envoient leur charge utile eux-mêmes (formulaire d'arrêt, dialogue de l'éditeur de falaise).
 */
export interface AccesPiedDetails {
  /** nom de la variante (vide : l'accès existant du couple est complété, sinon accès sans variante) */
  variante: string
  description: string
  km: string
  dplus: string
  dmoins: string
}

export interface AccesPiedLu {
  /** null si rien n'est renseigné (ni texte, ni chiffres) */
  details: AccesPiedDetails | null
  /** Trace GPX choisie, ou null */
  gpx: File | null
}

type ChampTexte = HTMLInputElement | HTMLTextAreaElement

export function lireAccesPied(root: ParentNode, id: number | string): AccesPiedLu {
  const champ = (nom: string) =>
    (root.querySelector(`[name="acces_pieton[${id}][${nom}]"]`) as ChampTexte | null)?.value.trim() ?? ''
  const details: AccesPiedDetails = {
    variante: champ('variante'),
    description: champ('description'),
    km: champ('km'),
    dplus: champ('dplus'),
    dmoins: champ('dmoins'),
  }
  const fichier = (root.querySelector(`input[type="file"][name="acces_gpx_${id}"]`) as HTMLInputElement | null)
    ?.files?.[0] ?? null
  return {
    details: Object.values(details).some((v) => v !== '') ? details : null,
    gpx: fichier,
  }
}
