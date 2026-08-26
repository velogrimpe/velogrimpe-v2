/**
 * Types et helpers partagés par les formulaires d'itinéraire vélo
 * (apps ajout-velo et edit-velo).
 */
import { h } from 'vue'
import type { FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

export interface GareItem extends FormAutocompleteItem {
  id: number
  nomformate: string
  latlng: string | null
}

export interface FalaiseItem extends FormAutocompleteItem {
  id: number
  nomformate: string
  latlng: string | null
  fermee: string | null
  bloc: number | null
}

/** Ligne renvoyée par /api/fetch_velos.php */
export interface VeloItem {
  velo_id: number
  gare_id: number
  falaise_id: number
  velo_depart: string
  velo_arrivee: string
  velo_variante: string
  velo_varianteformate: string
  velo_km: number | null
  velo_dplus: number | null
  velo_dmoins: number | null
  velo_descr: string
  velo_openrunner: string
  velo_apieduniquement: number
  velo_apiedpossible: number
  velo_public: number
  gare: GareItem
  gpx_url: string | null
}

/** Slot icône « loupe » pour FormAutocomplete. */
export const searchIconSlot = () => ({
  icon: () =>
    h('svg', { class: 'w-4 h-4 fill-none stroke-current shrink-0' }, [h('use', { href: '#search' })]),
})

/**
 * Notifie la carte (js/components/map/velo-form-map.js) de la sélection courante.
 * `kind` ∈ 'gare' | 'falaise' | 'gpx-url'.
 */
export const emitMapEvent = (kind: 'gare' | 'falaise' | 'gpx-url', detail: unknown) => {
  document.dispatchEvent(new CustomEvent(`velogrimpe:velo-form:${kind}`, { detail }))
}

export const gareMapDetail = (g: GareItem | null) => (g ? { latlng: g.latlng, nom: g.nom } : null)

export const falaiseMapDetail = (f: FalaiseItem | null) =>
  f ? { latlng: f.latlng, nom: f.nom, fermee: f.fermee, bloc: f.bloc } : null

export const fetchVelosForFalaise = async (falaiseId: number): Promise<VeloItem[]> => {
  const res = await fetch(`/api/fetch_velos.php?falaise_id=${falaiseId}`)
  if (!res.ok) throw new Error(`fetch_velos: HTTP ${res.status}`)
  const data = (await res.json()) as { velos: VeloItem[] }
  return data.velos ?? []
}
