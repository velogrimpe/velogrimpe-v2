import { createApp, h, ref } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'
import TransitousStationSearch, { type TransitousStation } from '@/components/shared/TransitousStationSearch.vue'

// Helper to create search icon slot
const searchIconSlot = () => ({
  icon: () => h('svg', { class: 'w-4 h-4 fill-none stroke-current shrink-0' }, [h('use', { href: '#search' })]),
})

interface GareItem extends FormAutocompleteItem {
  codeuic?: string
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Mount gare autocomplete (for form submission)
  mountGareAutocomplete()

  // Mount Transitous station search fields (for route lookup)
  mountStationSearch()
})

function mountGareAutocomplete() {
  const mountEl = document.getElementById('vue-ajout-train')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-ajout-train mount point not found')
    return
  }

  let gares: GareItem[] = []
  let presetGareNom: string | null = null

  try {
    gares = JSON.parse(mountEl.dataset.gares || '[]')
    presetGareNom = mountEl.dataset.presetGareNom || null
  } catch (e) {
    console.error('[velogrimpe] Failed to parse ajout-train data:', e)
  }

  // Helper to verify if itinerary exists
  const verifierExistenceItineraire = () => {
    const gareIdEl = document.getElementById('gare_id') as HTMLInputElement
    const villeIdEl = document.getElementById('ville_id') as HTMLSelectElement
    const tgvEl = document.getElementById('train_tgv') as HTMLInputElement
    const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement

    const gareId = gareIdEl?.value || ''
    const villeId = villeIdEl?.value || ''
    const isTgv = tgvEl?.checked ?? false

    if (!gareId || !villeId) {
      const alert = document.getElementById('itineraireExistsAlert')
      if (alert) alert.classList.add('hidden')
      return
    }

    fetch(`/api/verify_train_dup.php?gare_id=${gareId}&ville_id=${villeId}&train_tgv=${isTgv ? 1 : 0}`)
      .then((response) => response.json())
      .then((exists) => {
        const alert = document.getElementById('itineraireExistsAlert')
        const typeSpan = document.getElementById('itineraireExistsType')

        if (exists) {
          if (alert) alert.classList.remove('hidden')
          if (typeSpan) typeSpan.textContent = isTgv ? 'TGV' : 'TER'
          if (submitBtn) submitBtn.disabled = true
        } else {
          if (alert) alert.classList.add('hidden')
          if (submitBtn) submitBtn.disabled = false
        }
      })
  }

  const app = createApp({
    setup() {
      const gareValue = ref(presetGareNom || '')

      const onGareSelect = (item: FormAutocompleteItem | null) => {
        const gareIdEl = document.getElementById('gare_id') as HTMLInputElement
        const trainArriveeEl = document.getElementById('train_arrivee') as HTMLInputElement

        if (item) {
          if (gareIdEl) gareIdEl.value = String(item.id)
          if (trainArriveeEl) trainArriveeEl.value = item.nom
          verifierExistenceItineraire()
        } else {
          if (gareIdEl) gareIdEl.value = ''
          if (trainArriveeEl) trainArriveeEl.value = ''
        }
      }

      // Set up listeners for ville and TGV changes
      setTimeout(() => {
        const villeIdEl = document.getElementById('ville_id')
        const tgvEl = document.getElementById('train_tgv')
        villeIdEl?.addEventListener('change', verifierExistenceItineraire)
        tgvEl?.addEventListener('change', verifierExistenceItineraire)
      }, 0)

      return () =>
        h(
          FormAutocomplete,
          {
            modelValue: gareValue.value,
            'onUpdate:modelValue': (v: string) => {
              gareValue.value = v
            },
            items: gares,
            onSelect: onGareSelect,
          },
          searchIconSlot()
        )
    },
  })

  app.mount(mountEl)
  console.log('[velogrimpe] Vue ajout-train gare autocomplete mounted')
}

// Store selected stations for route lookup
interface SelectedStations {
  depart: TransitousStation | null
  arrivee: TransitousStation | null
}

declare global {
  interface Window {
    __transitousStations__?: SelectedStations
  }
}

function mountStationSearch() {
  const departMountEl = document.getElementById('vue-station-depart')
  const arriveeMountEl = document.getElementById('vue-station-arrivee')

  if (!departMountEl && !arriveeMountEl) {
    return // No station search fields on page
  }

  // Initialize global storage for selected stations
  window.__transitousStations__ = {
    depart: null,
    arrivee: null,
  }

  if (departMountEl) {
    const app = createApp({
      setup() {
        const value = ref('')

        const onSelect = (station: TransitousStation | null) => {
          if (window.__transitousStations__) {
            window.__transitousStations__.depart = station
          }
        }

        return () =>
          h(TransitousStationSearch, {
            modelValue: value.value,
            'onUpdate:modelValue': (v: string) => {
              value.value = v
            },
            placeholder: 'ex: Lyon Part-Dieu',
            onSelect,
          })
      },
    })
    app.mount(departMountEl)
    console.log('[velogrimpe] Vue station-depart search mounted')
  }

  if (arriveeMountEl) {
    const app = createApp({
      setup() {
        const value = ref('')

        const onSelect = (station: TransitousStation | null) => {
          if (window.__transitousStations__) {
            window.__transitousStations__.arrivee = station
          }
        }

        return () =>
          h(TransitousStationSearch, {
            modelValue: value.value,
            'onUpdate:modelValue': (v: string) => {
              value.value = v
            },
            placeholder: 'ex: Dijon Ville',
            onSelect,
          })
      },
    })
    app.mount(arriveeMountEl)
    console.log('[velogrimpe] Vue station-arrivee search mounted')
  }
}
