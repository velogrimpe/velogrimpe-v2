/**
 * Helper de soumission d'un arrêt de bus, partagé entre la page `ajout_arret.php`
 * (apps/ajout-bus.ts) et le dialog intégré à l'éditeur de falaise
 * (components/ajout/BusStopDialog.vue).
 *
 * Construit le même payload et appelle `POST /api/add_arret.php`.
 */

export interface BusStopPayload {
  admin: string
  arret_id: string | number | null
  nom: string
  loc: string
  /** Sous-ensemble de ter/tgv/bus/tram/telepherique, cf. lib/arrets_lib.php */
  types: string[]
  commune?: string | null
  code_insee?: string | null
  cp?: string | null
  description: string
  osm_id: string | null
  osm_data: string | null
  falaise_ids: number[]
  /** Détails facultatifs des accès à pied, par falaise : { description, km, dplus, dmoins } (chaînes du formulaire). */
  falaises_acces?: Record<string, Record<string, string>>
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
export async function postBusStop(
  payload: BusStopPayload,
  /** Traces GPX d'accès à pied, par falaise liée : `{ [falaise_id]: File }` (envoi multipart). */
  gpxParFalaise: Record<string, File> = {},
): Promise<BusStopResult> {
  try {
    const fichiers = Object.entries(gpxParFalaise)
    let init: RequestInit
    if (fichiers.length) {
      // multipart : charge JSON dans `payload`, fichiers `acces_gpx_<falaise_id>` (cf. api/add_arret.php)
      const fd = new FormData()
      fd.append('payload', JSON.stringify(payload))
      for (const [falaiseId, file] of fichiers) fd.append(`acces_gpx_${falaiseId}`, file)
      init = { method: 'POST', body: fd }
    } else {
      init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    }
    const res = await fetch('/api/add_arret.php', init)
    const result = (await res.json().catch(() => ({}))) as BusStopResult
    if (!res.ok || !result.success) {
      return { success: false, error: result.error, status: res.status }
    }
    return result
  } catch {
    return { success: false, error: 'Erreur réseau lors de l\'enregistrement.' }
  }
}
