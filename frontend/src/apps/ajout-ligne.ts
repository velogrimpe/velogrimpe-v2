import { createApp, h, ref } from 'vue'
import ArretsLies from '@/components/ajout/ArretsLies.vue'
import GtfsComparaison from '@/components/ajout/GtfsComparaison.vue'
import { compareGtfsStops, type GtfsDiff } from '@/utils/gtfs-match'
import {
  MAX_GTFS_ZIP_BYTES,
  listRouteStops,
  listRoutes,
  readGtfs,
  routeModalites,
  routeToLigneFields,
  shapesToMultiLineString,
  type GtfsFeed,
  type GtfsStop,
  type Modalite,
  type GtfsRoute,
  type MultiLineString,
} from '@/utils/gtfs'
import type { ArretGeo } from '@/utils/gtfs-match'

interface ArretItem {
  id: number
  nom: string
  [key: string]: unknown
}

// Pont posé par le script carte inline de ajout_ligne.php : il détient la
// géométrie (#ligne_geometry) et les arrêts liés (#ligne_arret_ids).
declare global {
  interface Window {
    ligneArrets?: ArretItem[]
    ligneSetArretLinked?: (id: number, linked: boolean) => void
    ligneFocusArret?: (id: number) => void
    ligneRemoveNouvelArret?: (key: string) => void
    ligneShowGtfsStops?: (stops: GtfsStop[], types: Modalite[]) => void
    ligneImportGtfsStops?: (stops: GtfsStop[], types: Modalite[]) => void
    ligneClearGtfsStops?: () => void
    ligneAddNouvelArret?: (key: string, nom: string, lat: number, lng: number, types: Modalite[]) => void
    ligneRecordGtfsRef?: (arretId: number, stopId: string, nom: string) => void
    ligneGtfsStops?: GtfsStop[]
  }
}

const FIELDS = {
  nom: 'ligne_nom',
  numero: 'ligne_numero',
  operateur: 'ligne_operateur',
  operateur_url: 'ligne_operateur_url',
  horaire_url: 'ligne_horaire_url',
  ref: 'ligne_ref',
  couleur: 'ligne_couleur',
} as const
type FieldKey = keyof typeof FIELDS

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null
const input = (id: string) => el<HTMLInputElement>(id)!

function setField(key: FieldKey, value: string | null) {
  const e = input(FIELDS[key])
  e.value = value ?? ''
  e.dispatchEvent(new Event('input', { bubbles: true }))
}

function setGeometry(geometry: MultiLineString | null) {
  document.dispatchEvent(new CustomEvent('velogrimpe:ligne-geometry-set', { detail: { geometry } }))
}

function showError(id: string, message: string | null) {
  const box = el(id)
  if (!box) return
  box.textContent = message ?? ''
  box.classList.toggle('hidden', !message)
}

/** Zip trop volumineux : pas d'analyse, et des pistes pour réduire la portée du GTFS. */
function showGtfsTooLarge(sizeBytes: number) {
  const box = el('gtfs-error')!
  const mo = (sizeBytes / 1024 / 1024).toFixed(1).replace('.', ',')
  const lien = document.createElement('a')
  lien.href = 'https://transport.data.gouv.fr/datasets'
  lien.target = '_blank'
  lien.rel = 'noopener'
  lien.className = 'link'
  lien.textContent = 'transport.data.gouv.fr'
  box.replaceChildren(
    `Ce fichier fait ${mo} Mo : au-delà de ${MAX_GTFS_ZIP_BYTES / 1024 / 1024} Mo, l'analyse est trop lourde pour le navigateur. ` +
      'Prenez un GTFS plus restreint (sur ',
    lien,
    ", les GTFS sont publiés réseau par réseau) ou réduisez-le à la ou aux lignes voulues avec un outil de filtrage de GTFS (par ex. gtfstools sous R, gtfsutils sous Python) avant de l'importer.",
  )
  box.classList.remove('hidden')
}

document.addEventListener('DOMContentLoaded', () => {
  const adminToken = new URLSearchParams(window.location.search).get('admin') ?? ''

  // --- Arrêts liés (liste Vue branchée sur les événements du script carte) ---
  const mountEl = el('vue-arrets-lies')
  if (mountEl) {
    const linkedIds = ref<number[]>([])
    const nouveaux = ref<Array<{ key: string; nom: string }>>([])
    document.addEventListener('velogrimpe:ligne-arrets-changed', (e) => {
      const detail = (e as CustomEvent<{ ids?: number[]; nouveaux?: Array<{ key: string; nom: string }> }>).detail
      linkedIds.value = (detail?.ids ?? []).map(Number)
      nouveaux.value = detail?.nouveaux ?? []
    })
    createApp({
      setup: () => () =>
        h(ArretsLies, {
          arrets: window.ligneArrets ?? [],
          linkedIds: linkedIds.value,
          nouveaux: nouveaux.value,
          onLink: (id: number) => window.ligneSetArretLinked?.(id, true),
          onUnlink: (id: number) => window.ligneSetArretLinked?.(id, false),
          onUnlinkNouveau: (key: string) => window.ligneRemoveNouvelArret?.(key),
          onCenter: (id: number) => window.ligneFocusArret?.(id),
        }),
    }).mount(mountEl)
  }

  // --- Import GTFS : zip → liste des lignes → choix → champs + géométrie ---
  let feed: GtfsFeed | null = null
  let routes: GtfsRoute[] = []
  const routesSelect = el<HTMLSelectElement>('gtfs-routes')!
  input('gtfs-file').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    showError('gtfs-error', null)
    window.ligneClearGtfsStops?.()
    el('gtfs-choose')!.classList.add('hidden')
    setStopsButtons(false)
    if (file.size > MAX_GTFS_ZIP_BYTES) {
      showGtfsTooLarge(file.size)
      return
    }
    try {
      feed = readGtfs(new Uint8Array(await file.arrayBuffer()))
      routes = listRoutes(feed)
    } catch (err) {
      feed = null
      showError('gtfs-error', `Fichier GTFS illisible : ${err instanceof Error ? err.message : err}`)
      return
    }
    routesSelect.innerHTML = '<option value="">Choisir une ligne…</option>'
    routes.forEach((r, i) => {
      const o = document.createElement('option')
      o.value = String(i)
      o.textContent = `${r.numero ? r.numero + ' — ' : ''}${r.nom}`
      routesSelect.appendChild(o)
    })
    el('gtfs-choose')!.classList.remove('hidden')
  })
  // « Montrer / Importer les arrêts » (au-dessus de la carte) : actifs une fois une ligne GTFS choisie
  const stopsButtons = ['gtfs-show-stops', 'gtfs-import-stops'].map((id) => el<HTMLButtonElement>(id)!)
  const setStopsButtons = (enabled: boolean) => stopsButtons.forEach((b) => (b.disabled = !enabled))
  routesSelect.addEventListener('change', () => {
    window.ligneClearGtfsStops?.()
    setStopsButtons(routesSelect.value !== '')
    closeDiff()
  })

  // --- Mise à jour : comparaison GTFS ↔ arrêts liés (mode édition) ---
  let savedRefs: Record<number, string[]> = {}
  const compareBtn = el<HTMLButtonElement>('gtfs-compare')
  const diffMount = el('vue-gtfs-diff')
  const diff = ref<GtfsDiff | null>(null)
  const diffKey = ref(0) // nouvelle clé à chaque comparaison : l'état des cases repart de zéro
  const closeDiff = () => (diff.value = null)
  let diffTypes: Modalite[] = ['bus']
  if (compareBtn && diffMount) {
    routesSelect.addEventListener('change', () => (compareBtn.disabled = routesSelect.value === ''))
    compareBtn.addEventListener('click', () => {
      const route = routes[Number(routesSelect.value)]
      if (!feed || !route) return
      const stops = listRouteStops(feed, route)
      if (!stops.length) {
        showError('gtfs-error', 'Aucun arrêt trouvé pour cette ligne dans le GTFS (stops.txt / stop_times.txt).')
        return
      }
      showError('gtfs-error', null)
      diffTypes = routeModalites(route)
      const catalog = (window.ligneArrets ?? []) as unknown as ArretGeo[]
      const linkedIds = new Set(
        input('ligne_arret_ids').value.split(',').map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)),
      )
      diffKey.value++
      diff.value = compareGtfsStops(stops, catalog.filter((a) => linkedIds.has(a.id)), catalog, savedRefs)
    })
    createApp({
      setup: () => () =>
        diff.value
          ? h(GtfsComparaison, {
              key: diffKey.value,
              diff: diff.value,
              onClose: closeDiff,
              onApply: (sel: { added: number[]; removed: number[] }) => {
                const d = diff.value!
                d.served.forEach((s) => window.ligneRecordGtfsRef?.(s.arret.id, s.stop.id, s.stop.nom))
                sel.added.forEach((i) => {
                  const { stop, arret } = d.added[i]
                  if (arret) {
                    window.ligneSetArretLinked?.(arret.id, true)
                    window.ligneRecordGtfsRef?.(arret.id, stop.id, stop.nom)
                  } else window.ligneAddNouvelArret?.(`gtfs:${stop.id}`, stop.nom, stop.lat, stop.lng, diffTypes)
                })
                sel.removed.forEach((i) => window.ligneSetArretLinked?.(d.removed[i].id, false))
                closeDiff()
              },
            })
          : null,
    }).mount(diffMount)
  }

  // Arrêts de la ligne GTFS choisie : suggestions sur la carte, ou ajout direct à la ligne
  const stopsAction = (action: 'ligneShowGtfsStops' | 'ligneImportGtfsStops') => () => {
    const route = routes[Number(routesSelect.value)]
    if (!feed || !route || routesSelect.value === '') return
    const stops = listRouteStops(feed, route)
    if (!stops.length) {
      showError('gtfs-error', 'Aucun arrêt trouvé pour cette ligne dans le GTFS (stops.txt / stop_times.txt).')
      return
    }
    showError('gtfs-error', null)
    window[action]?.(stops, routeModalites(route))
  }
  el('gtfs-show-stops')!.addEventListener('click', stopsAction('ligneShowGtfsStops'))
  el('gtfs-import-stops')!.addEventListener('click', stopsAction('ligneImportGtfsStops'))

  el('gtfs-import')!.addEventListener('click', () => {
    const route = routes[Number(routesSelect.value)]
    if (!feed || !route || routesSelect.value === '') return
    const fields = routeToLigneFields(feed, route)
    for (const key of Object.keys(FIELDS) as FieldKey[]) {
      if (key in fields) setField(key, fields[key as keyof typeof fields])
    }
    const geometry = shapesToMultiLineString(feed.shapesText, route.shapeIds)
    if (geometry) {
      showError('gtfs-error', null)
      setGeometry(geometry)
    } else {
      showError('gtfs-error', 'Cette ligne n\'a pas de tracé (shapes.txt) dans le GTFS : tracez-la à la main.')
    }
  })

  // --- Import d'un shapes.txt seul (remplace la géométrie) ---
  input('shapes-file').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const geometry = shapesToMultiLineString(await file.text())
    if (!geometry) {
      alert('Aucune forme exploitable dans ce shapes.txt.')
      return
    }
    setGeometry(geometry)
  })

  // --- Prefill en mode édition ---
  const ligneId = input('ligne_id').value
  if (ligneId) {
    fetch(`/api/fetch_ligne.php?ligne_id=${ligneId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`fetch_ligne ${r.status}`))))
      .then((data) => {
        for (const key of Object.keys(FIELDS) as FieldKey[]) setField(key, data.ligne[key] ?? '')
        savedRefs = data.gtfs_refs ?? {}
        if (data.ligne.geometry) setGeometry(data.ligne.geometry)
        const apply = () => (data.arret_ids as number[]).forEach((id) => window.ligneSetArretLinked?.(id, true))
        if (window.ligneSetArretLinked) apply()
        else window.addEventListener('load', apply)
      })
      .catch((e) => console.error('[velogrimpe] prefill ligne failed:', e))
  }
  if (new URLSearchParams(window.location.search).has('saved')) el('saved-alert')?.classList.remove('hidden')

  // --- Soumission ---
  const form = el<HTMLFormElement>('form')!
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!input(FIELDS.nom).value.trim()) {
      input(FIELDS.nom).reportValidity()
      return
    }
    const payload: Record<string, unknown> = {
      ligne_id: ligneId ? Number(ligneId) : null,
      geometry: input('ligne_geometry').value ? JSON.parse(input('ligne_geometry').value) : null,
      nouveaux_arrets: input('ligne_nouveaux_arrets').value
        ? JSON.parse(input('ligne_nouveaux_arrets').value)
        : [],
      arret_ids: input('ligne_arret_ids')
        .value.split(',')
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n)),
    }
    payload.gtfs_refs = input('ligne_gtfs_refs').value ? JSON.parse(input('ligne_gtfs_refs').value) : []
    for (const key of Object.keys(FIELDS) as FieldKey[]) payload[key] = input(FIELDS[key]).value
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (btn) btn.disabled = true
    try {
      const res = await fetch('/api/add_ligne.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.success) throw new Error(body.error || `HTTP ${res.status}`)
      const params = new URLSearchParams({ admin: adminToken, ligne_id: String(body.ligne_id), saved: '1' })
      window.location.href = `/ajout/ajout_ligne.php?${params}`
    } catch (err) {
      alert('Erreur : ' + (err instanceof Error ? err.message : err))
      if (btn) btn.disabled = false
    }
  })

  // --- Suppression (Bearer admin) ---
  el('btn-delete')?.addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement cette ligne ?')) return
    const res = await fetch('/api/delete_ligne.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ligne_id: Number(ligneId) }),
    })
    if (!res.ok) {
      alert('Suppression impossible (' + res.status + ')')
      return
    }
    window.location.href = `/ajout/ajout_ligne.php?admin=${encodeURIComponent(adminToken)}`
  })
})
