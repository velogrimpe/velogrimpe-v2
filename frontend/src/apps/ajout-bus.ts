import { createApp, h, ref, type Ref } from 'vue'
import FalaisesLiees, { type AccesExistant } from '@/components/ajout/FalaisesLiees.vue'
import RichTextField from '@/components/shared/RichTextField.vue'
import { postBusStop } from '@/utils/bus-api'
import { lireAccesPied } from '@/utils/acces-pied'

interface FalaiseItem {
  id: number
  nom: string
  [key: string]: unknown
}

// Pont posé par le script carte inline de ajout_arret.php : il détient l'état des
// falaises liées (Set + hidden #arret_falaise_ids) et notifie par événement.
declare global {
  interface Window {
    busFalaises?: FalaiseItem[]
    busSetFalaiseLinked?: (id: number, linked: boolean) => void
    busFocusFalaise?: (id: number) => void
    busFitLinkedFalaises?: () => void
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Simple porteur de données (arrêt à éditer) : plus de composant Vue monté dessus depuis le Lot 9
  const mountEl = document.getElementById('vue-ajout-bus')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-ajout-bus data element not found')
    return
  }

  let presetArretId: number | null = null
  try {
    presetArretId = mountEl.dataset.presetArretId
      ? parseInt(mountEl.dataset.presetArretId, 10)
      : null
  } catch (e) {
    console.error('[velogrimpe] Failed to parse ajout-bus data:', e)
  }

  // Accès déjà décrits de l'arrêt (édition), par falaise : renseignés au chargement de l'arrêt (prefill)
  const accesExistants = ref<Record<string, AccesExistant[]>>({})

  // --- Liste des falaises liées (alternative à la carte) ---
  const falaisesMountEl = document.getElementById('vue-falaises-liees')
  if (falaisesMountEl) {
    // État courant : le hidden est déjà rempli si la page a pré-lié des falaises
    // (?falaise_ids=…), ce qui se produit avant que l'écoute ci-dessous démarre.
    const linkedIds = ref<number[]>(
      ((document.getElementById('arret_falaise_ids') as HTMLInputElement | null)?.value ?? '')
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n)),
    )
    document.addEventListener('velogrimpe:bus-falaises-changed', (e) => {
      const detail = (e as CustomEvent<{ ids?: number[] }>).detail
      linkedIds.value = (detail?.ids ?? []).map(Number)
    })
    createApp({
      setup() {
        return () =>
          h(FalaisesLiees, {
            falaises: window.busFalaises ?? [],
            linkedIds: linkedIds.value,
            accesDetails: true,
            accesExistants: accesExistants.value,
            onLink: (id: number) => {
              window.busSetFalaiseLinked?.(id, true)
              // Cadrage sur l'ensemble arrêt + falaises liées, pas sur la seule ajoutée.
              window.busFitLinkedFalaises?.()
            },
            onUnlink: (id: number) => window.busSetFalaiseLinked?.(id, false),
            onCenter: (id: number) => window.busFocusFalaise?.(id),
          })
      },
    }).mount(falaisesMountEl)
  } else {
    console.warn('[velogrimpe] #vue-falaises-liees mount point not found')
  }

  // --- Champs RichText autonomes (commentaire de l'arrêt) ---
  const richTextRefs: Record<string, Ref<{ setContent: (html: string) => void } | null>> = {}
  document.querySelectorAll<HTMLElement>('.vue-richtext').forEach((el) => {
    const name = el.dataset.name || ''
    const initial = el.dataset.value || ''
    const cmpRef = ref<{ setContent: (html: string) => void } | null>(null)
    const rtApp = createApp({
      setup() {
        return () => h(RichTextField, { name, modelValue: initial, ref: cmpRef })
      },
    })
    rtApp.mount(el)
    richTextRefs[name] = cmpRef
  })
  ;(window as unknown as Record<string, unknown>).setRichText = (name: string, html: string) => {
    richTextRefs[name]?.value?.setContent(html || '')
  }

  // --- Prefill en mode édition ---
  if (presetArretId) {
    fetch(`/api/fetch_arret.php?arret_id=${presetArretId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_bus failed'))))
      .then((data) => {
        const arret = data.arret || {}
        const nomEl = document.getElementById('arret_nom') as HTMLInputElement | null
        if (nomEl) nomEl.value = arret.nom || ''
        // Modalités desservies : coche les cases correspondantes et notifie
        // le script carte (icône du marqueur, cf. arret-icon.js) via 'change'.
        const typeCheckboxes = document.querySelectorAll<HTMLInputElement>('.arret-type-checkbox')
        typeCheckboxes.forEach((cb) => {
          cb.checked = Array.isArray(arret.types) && arret.types.includes(cb.value)
        })
        typeCheckboxes[0]?.dispatchEvent(new Event('change', { bubbles: true }))
        const locEl = document.getElementById('arret_loc') as HTMLInputElement | null
        if (locEl && arret.loc) {
          locEl.value = arret.loc
          locEl.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const osmIdEl = document.getElementById('arret_osm_id') as HTMLInputElement | null
        if (osmIdEl) osmIdEl.value = arret.osm_id || ''
        // Données OSM : remplir le champ caché + afficher le bloc properties
        const osmDataEl = document.getElementById('arret_osm_data') as HTMLInputElement | null
        if (arret.osm_data != null) {
          const osmDataStr =
            typeof arret.osm_data === 'string' ? arret.osm_data : JSON.stringify(arret.osm_data)
          if (osmDataEl) osmDataEl.value = osmDataStr
          const props = document.getElementById('arret_osm_props')
          const wrap = document.getElementById('arret_osm_props_wrap')
          if (props) {
            try {
              const obj = typeof arret.osm_data === 'string' ? JSON.parse(arret.osm_data) : arret.osm_data
              props.textContent = JSON.stringify(obj, null, 2)
            } catch {
              props.textContent = osmDataStr
            }
          }
          if (wrap) wrap.classList.remove('hidden')
        } else if (osmDataEl) {
          osmDataEl.value = ''
        }
        // Commentaire RichText
        const setRich = (window as unknown as Record<string, (n: string, h: string) => void>).setRichText
        if (setRich) setRich('description', arret.description || '')
        // Falaises liées (géré par le script carte de la page)
        const setLinked = (window as unknown as Record<string, (ids: number[]) => void>)
          .busSetLinkedFalaises
        if (setLinked && Array.isArray(data.falaise_ids)) setLinked(data.falaise_ids)
        // Accès déjà décrits, regroupés par falaise (affichés dans le détail de chaque falaise liée)
        const parFalaise: Record<string, AccesExistant[]> = {}
        for (const a of (data.acces ?? []) as Array<AccesExistant & { falaise_id: number }>) {
          ;(parFalaise[String(a.falaise_id)] ??= []).push(a)
        }
        accesExistants.value = parFalaise
      })
      .catch((e) => console.error('[velogrimpe] prefill bus failed:', e))
  }

  // --- Soumission (interception du form, envoi JSON) ---
  const form = document.getElementById('form') as HTMLFormElement | null
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()

    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
    const arretIdRaw = val('arret_id')
    const isEdition = arretIdRaw !== '' && arretIdRaw !== 'undefined'

    const falaiseIds = val('arret_falaise_ids')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))

    // Détails facultatifs des accès à pied (description, km, D+, D-) et traces GPX, par falaise liée
    const falaisesAcces: Record<string, Record<string, string>> = {}
    const gpxParFalaise: Record<string, File> = {}
    for (const id of falaiseIds) {
      const { details, gpx } = lireAccesPied(document, id)
      if (details) falaisesAcces[String(id)] = { ...details }
      if (gpx) gpxParFalaise[String(id)] = gpx
    }

    const descInput = document.querySelector(
      '.vue-richtext input[name="description"]',
    ) as HTMLInputElement | null

    const osmDataRaw = val('arret_osm_data')

    const types = Array.from(
      document.querySelectorAll<HTMLInputElement>('.arret-type-checkbox:checked'),
    ).map((cb) => cb.value)

    const payload = {
      admin: val('admin'),
      arret_id: isEdition ? arretIdRaw : null,
      nom: val('arret_nom'),
      loc: val('arret_loc'),
      types,
      commune: val('arret_commune') || null,
      code_insee: val('arret_code_insee') || null,
      cp: val('arret_cp') || null,
      description: descInput?.value ?? '',
      osm_id: val('arret_osm_id') || null,
      osm_data: osmDataRaw || null,
      falaise_ids: falaiseIds,
      falaises_acces: falaisesAcces,
      nom_prenom: val('nom_prenom'),
      email: val('email'),
      message: val('message'),
    }

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
    if (submitBtn) submitBtn.disabled = true

    const result = await postBusStop(payload, gpxParFalaise)
    if (!result.success) {
      alert('Erreur : ' + (result.error || result.status))
      if (submitBtn) submitBtn.disabled = false
      return
    }

    // Sauvegarde des infos contributeur
    const contribStorage = (window as unknown as Record<string, { saveContribInfo?: (n: string, e: string) => void }>).contribStorage
    contribStorage?.saveContribInfo?.(val('nom_prenom'), val('email'))

    // admin : le jeton lui-même (vérifié par confirmation_arret.php), jamais un
    // booléen. Nom / email restent dans le localStorage, pas dans l'URL.
    const params = new URLSearchParams({
      arret_id: String(result.arret_id),
      type: isEdition ? 'update' : 'insert',
    })
    if (payload.admin && payload.admin !== '0') params.set('admin', payload.admin)
    window.location.href = '/ajout/confirmation_arret.php?' + params.toString()
  })

  console.log('[velogrimpe] Vue ajout-bus mounted')
})
