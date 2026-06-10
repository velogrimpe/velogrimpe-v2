/**
 * Helper de soumission d'un arrêt de bus, partagé entre la page `ajout_bus.php`
 * (apps/ajout-bus.ts) et le dialog intégré à l'éditeur de falaise
 * (components/ajout/BusStopDialog.vue).
 *
 * Construit le même payload et appelle `POST /api/add_bus.php`.
 */

export interface BusStopPayload {
  admin: string
  arret_id: string | number | null
  nom: string
  loc: string
  description: string
  osm_id: string | null
  osm_data: string | null
  falaise_ids: number[]
  /** Issu de AjoutBus.vue getLignes() : { id, key, nom, description, lien } */
  lignes: unknown[]
  /** Issu de AjoutBus.vue getLiaisons() : { id, arret_2_id, ligne_key, description } */
  liaisons: unknown[]
  nom_prenom: string
  email: string
  message: string
}

export interface BusStopResult {
  success: boolean
  arret_id?: number
  error?: string
  status?: number
}

/**
 * Envoie l'arrêt (création ou édition) à l'API.
 * Ne lève jamais : renvoie `{ success: false, error }` en cas d'échec réseau/HTTP.
 */
export async function postBusStop(payload: BusStopPayload): Promise<BusStopResult> {
  try {
    const res = await fetch('/api/add_bus.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = (await res.json().catch(() => ({}))) as BusStopResult
    if (!res.ok || !result.success) {
      return { success: false, error: result.error, status: res.status }
    }
    return result
  } catch {
    return { success: false, error: 'Erreur réseau lors de l\'enregistrement.' }
  }
}
