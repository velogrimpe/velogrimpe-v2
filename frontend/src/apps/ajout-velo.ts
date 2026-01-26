import { createApp, h, ref } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

// Helper to create search icon slot
const searchIconSlot = () => ({
  icon: () => h('svg', { class: 'w-4 h-4 fill-none stroke-current shrink-0' }, [h('use', { href: '#search' })]),
})

interface GareItem extends FormAutocompleteItem {
  nomformate: string
}

interface FalaiseItem extends FormAutocompleteItem {
  nomformate: string
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Parse data from PHP (passed via data attributes)
  const mountEl = document.getElementById('vue-ajout-velo')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-ajout-velo mount point not found')
    return
  }

  let gares: GareItem[] = []
  let falaises: FalaiseItem[] = []
  let presetFalaiseId: number | null = null
  let presetGareId: number | null = null

  try {
    gares = JSON.parse(mountEl.dataset.gares || '[]')
    falaises = JSON.parse(mountEl.dataset.falaises || '[]')
    presetFalaiseId = mountEl.dataset.presetFalaiseId
      ? parseInt(mountEl.dataset.presetFalaiseId, 10)
      : null
    presetGareId = mountEl.dataset.presetGareId
      ? parseInt(mountEl.dataset.presetGareId, 10)
      : null
  } catch (e) {
    console.error('[velogrimpe] Failed to parse ajout-velo data:', e)
  }

  // Helper to verify if itinerary exists
  const verifierExistenceItineraire = (gareId: string | number, falaiseId: string | number) => {
    if (!gareId || !falaiseId) {
      const alert = document.getElementById('itineraireExistsAlert')
      if (alert) alert.classList.add('hidden')
      return
    }
    fetch(`/api/verify_velo_dup.php?gare_id=${gareId}&falaise_id=${falaiseId}`)
      .then((response) => response.json())
      .then((exists) => {
        const alert = document.getElementById('itineraireExistsAlert')
        if (alert) {
          if (exists) {
            alert.classList.remove('hidden')
          } else {
            alert.classList.add('hidden')
          }
        }
      })
  }

  // Create Vue app
  const app = createApp({
    setup() {
      const gareValue = ref('')
      const gareDisabled = ref(false)
      const falaiseValue = ref('')
      const falaiseDisabled = ref(false)

      // Handle preset gare
      if (presetGareId) {
        const preset = gares.find((g) => g.id === presetGareId)
        if (preset) {
          gareValue.value = preset.nom
          gareDisabled.value = true
          // Also set hidden fields
          setTimeout(() => {
            const gareIdEl = document.getElementById('gare_id') as HTMLInputElement
            const veloDepartEl = document.getElementById('velo_depart') as HTMLInputElement
            if (gareIdEl) gareIdEl.value = String(preset.id)
            if (veloDepartEl) veloDepartEl.value = preset.nomformate
          }, 0)
        }
      }

      // Handle preset falaise
      if (presetFalaiseId) {
        const preset = falaises.find((f) => f.id === presetFalaiseId)
        if (preset) {
          falaiseValue.value = preset.nom
          falaiseDisabled.value = true
          // Also set hidden fields
          setTimeout(() => {
            const falaiseIdEl = document.getElementById('falaise_id') as HTMLInputElement
            const veloArriveeEl = document.getElementById('velo_arrivee') as HTMLInputElement
            if (falaiseIdEl) falaiseIdEl.value = String(preset.id)
            if (veloArriveeEl) veloArriveeEl.value = preset.nomformate
          }, 0)
        }
      }

      const onGareSelect = (item: FormAutocompleteItem | null) => {
        const gareItem = item as GareItem | null
        const gareIdEl = document.getElementById('gare_id') as HTMLInputElement
        const veloDepartEl = document.getElementById('velo_depart') as HTMLInputElement
        const falaiseIdEl = document.getElementById('falaise_id') as HTMLInputElement

        if (gareItem) {
          if (gareIdEl) gareIdEl.value = String(gareItem.id)
          if (veloDepartEl) veloDepartEl.value = gareItem.nomformate || ''
          verifierExistenceItineraire(gareItem.id, falaiseIdEl?.value || '')
        } else {
          if (gareIdEl) gareIdEl.value = ''
          if (veloDepartEl) veloDepartEl.value = ''
        }
      }

      const onFalaiseSelect = (item: FormAutocompleteItem | null) => {
        const falaiseItem = item as FalaiseItem | null
        const falaiseIdEl = document.getElementById('falaise_id') as HTMLInputElement
        const veloArriveeEl = document.getElementById('velo_arrivee') as HTMLInputElement
        const gareIdEl = document.getElementById('gare_id') as HTMLInputElement

        if (falaiseItem) {
          if (falaiseIdEl) falaiseIdEl.value = String(falaiseItem.id)
          if (veloArriveeEl) veloArriveeEl.value = falaiseItem.nomformate || ''
          verifierExistenceItineraire(gareIdEl?.value || '', falaiseItem.id)
        } else {
          if (falaiseIdEl) falaiseIdEl.value = ''
          if (veloArriveeEl) veloArriveeEl.value = ''
        }
      }

      return () =>
        h('div', { class: 'flex flex-col md:flex-row gap-4 md:items-center flex-1' }, [
          // Gare field
          h('div', { class: 'flex flex-col gap-1 grow' }, [
            h('div', { class: 'relative not-prose' }, [
              h('label', { class: 'form-control', for: 'gare_nom' }, [
                h('b', null, 'Gare de départ de l\'itinéraire vélo :'),
                h(
                  FormAutocomplete,
                  {
                    modelValue: gareValue.value,
                    'onUpdate:modelValue': (v: string) => {
                      gareValue.value = v
                    },
                    items: gares,
                    disabled: gareDisabled.value,
                    onSelect: onGareSelect,
                  },
                  searchIconSlot()
                ),
              ]),
            ]),
          ]),
          // Falaise field
          h('div', { class: 'flex flex-col gap-1 grow' }, [
            h('div', { class: 'relative not-prose' }, [
              h('label', { class: 'form-control', for: 'falaise_nom' }, [
                h('b', null, 'Falaise d\'arrivée de l\'itinéraire vélo :'),
                h(
                  FormAutocomplete,
                  {
                    modelValue: falaiseValue.value,
                    'onUpdate:modelValue': (v: string) => {
                      falaiseValue.value = v
                    },
                    items: falaises,
                    disabled: falaiseDisabled.value,
                    onSelect: onFalaiseSelect,
                  },
                  searchIconSlot()
                ),
              ]),
            ]),
          ]),
        ])
    },
  })

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue ajout-velo autocomplete mounted')
})
