import { createApp, h, ref, type Ref } from 'vue'
import AjoutBus from '@/components/ajout/AjoutBus.vue'
import RichTextField from '@/components/shared/RichTextField.vue'
import { postBusStop } from '@/utils/bus-api'

interface ArretItem {
  id: number
  nom: string
}
interface LigneItem {
  id: number
  nom: string
  description?: string
  lien?: string
}

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-ajout-bus')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-ajout-bus mount point not found')
    return
  }

  let arrets: ArretItem[] = []
  let lignes: LigneItem[] = []
  let presetArretId: number | null = null
  try {
    arrets = JSON.parse(mountEl.dataset.arrets || '[]')
    lignes = JSON.parse(mountEl.dataset.lignes || '[]')
    presetArretId = mountEl.dataset.presetArretId
      ? parseInt(mountEl.dataset.presetArretId, 10)
      : null
  } catch (e) {
    console.error('[velogrimpe] Failed to parse ajout-bus data:', e)
  }

  // --- Composant principal (liaisons / lignes) ---
  const app = createApp(AjoutBus, {
    arrets,
    lignes,
    excludeArretId: presetArretId,
  })
  const vm = app.mount(mountEl) as unknown as {
    getLignes: () => unknown[]
    getLiaisons: () => unknown[]
    hydrate: (d: unknown) => Promise<void>
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
    fetch(`/api/fetch_bus.php?arret_id=${presetArretId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fetch_bus failed'))))
      .then((data) => {
        const arret = data.arret || {}
        const nomEl = document.getElementById('arret_nom') as HTMLInputElement | null
        if (nomEl) nomEl.value = arret.nom || ''
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
        // Liaisons / lignes
        vm.hydrate({ lignes: data.lignes || [], liaisons: data.liaisons || [] })
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

    const descInput = document.querySelector(
      '.vue-richtext input[name="description"]',
    ) as HTMLInputElement | null

    const osmDataRaw = val('arret_osm_data')

    const payload = {
      admin: val('admin'),
      arret_id: isEdition ? arretIdRaw : null,
      nom: val('arret_nom'),
      loc: val('arret_loc'),
      description: descInput?.value ?? '',
      osm_id: val('arret_osm_id') || null,
      osm_data: osmDataRaw || null,
      falaise_ids: falaiseIds,
      lignes: vm.getLignes(),
      liaisons: vm.getLiaisons(),
      nom_prenom: val('nom_prenom'),
      email: val('email'),
      message: val('message'),
    }

    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
    if (submitBtn) submitBtn.disabled = true

    const result = await postBusStop(payload)
    if (!result.success) {
      alert('Erreur : ' + (result.error || result.status))
      if (submitBtn) submitBtn.disabled = false
      return
    }

    // Sauvegarde des infos contributeur
    const contribStorage = (window as unknown as Record<string, { saveContribInfo?: (n: string, e: string) => void }>).contribStorage
    contribStorage?.saveContribInfo?.(val('nom_prenom'), val('email'))

    const params = new URLSearchParams({
      arret_id: String(result.arret_id),
      type: isEdition ? 'update' : 'insert',
      admin: payload.admin && payload.admin !== '0' ? '1' : '0',
      nom_prenom: payload.nom_prenom,
      email: payload.email,
    })
    window.location.href = '/ajout/confirmation_bus.php?' + params.toString()
  })

  console.log('[velogrimpe] Vue ajout-bus mounted')
})
