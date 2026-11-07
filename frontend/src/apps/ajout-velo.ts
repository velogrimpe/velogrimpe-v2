import { createApp, h, ref } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'
import {
  type ArretItem,
  type FalaiseItem,
  searchIconSlot,
  emitMapEvent,
  gareMapDetail,
  falaiseMapDetail,
} from '@/utils/velo-form'

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Parse data from PHP (passed via data attributes)
  const mountEl = document.getElementById('vue-ajout-velo')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-ajout-velo mount point not found')
    return
  }

  let arrets: ArretItem[] = []
  let falaises: FalaiseItem[] = []
  let presetFalaiseId: number | null = null
  let presetArretId: number | null = null

  try {
    arrets = JSON.parse(mountEl.dataset.arrets || '[]')
    falaises = JSON.parse(mountEl.dataset.falaises || '[]')
    presetFalaiseId = mountEl.dataset.presetFalaiseId
      ? parseInt(mountEl.dataset.presetFalaiseId, 10)
      : null
    presetArretId = mountEl.dataset.presetArretId
      ? parseInt(mountEl.dataset.presetArretId, 10)
      : null
  } catch (e) {
    console.error('[velogrimpe] Failed to parse ajout-velo data:', e)
  }

  // Helper to verify if itinerary exists
  const verifierExistenceItineraire = (arretId: string | number, falaiseId: string | number) => {
    if (!arretId || !falaiseId) {
      const alert = document.getElementById('itineraireExistsAlert')
      if (alert) alert.classList.add('hidden')
      return
    }
    fetch(`/api/verify_velo_dup.php?arret_id=${arretId}&falaise_id=${falaiseId}`)
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
      const arretValue = ref('')
      const arretDisabled = ref(false)
      const falaiseValue = ref('')
      const falaiseDisabled = ref(false)

      // Handle preset arrêt
      if (presetArretId) {
        const preset = arrets.find((a) => a.id === presetArretId)
        if (preset) {
          arretValue.value = preset.nom
          arretDisabled.value = true
          // Also set hidden fields
          setTimeout(() => {
            const arretIdEl = document.getElementById('arret_id') as HTMLInputElement
            const veloDepartEl = document.getElementById('velo_depart') as HTMLInputElement
            if (arretIdEl) arretIdEl.value = String(preset.id)
            if (veloDepartEl) veloDepartEl.value = preset.nomformate
            emitMapEvent('gare', gareMapDetail(preset))
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
            emitMapEvent('falaise', falaiseMapDetail(preset))
          }, 0)
        }
      }

      const onArretSelect = (item: FormAutocompleteItem | null) => {
        const gareItem = item as ArretItem | null
        const arretIdEl = document.getElementById('arret_id') as HTMLInputElement
        const veloDepartEl = document.getElementById('velo_depart') as HTMLInputElement
        const falaiseIdEl = document.getElementById('falaise_id') as HTMLInputElement

        if (gareItem) {
          if (arretIdEl) arretIdEl.value = String(gareItem.id)
          if (veloDepartEl) veloDepartEl.value = gareItem.nomformate || ''
          verifierExistenceItineraire(gareItem.id, falaiseIdEl?.value || '')
          emitMapEvent('gare', gareMapDetail(gareItem))
        } else {
          if (arretIdEl) arretIdEl.value = ''
          if (veloDepartEl) veloDepartEl.value = ''
          emitMapEvent('gare', null)
        }
      }

      const onFalaiseSelect = (item: FormAutocompleteItem | null) => {
        const falaiseItem = item as FalaiseItem | null
        const falaiseIdEl = document.getElementById('falaise_id') as HTMLInputElement
        const veloArriveeEl = document.getElementById('velo_arrivee') as HTMLInputElement
        const arretIdEl = document.getElementById('arret_id') as HTMLInputElement

        if (falaiseItem) {
          if (falaiseIdEl) falaiseIdEl.value = String(falaiseItem.id)
          if (veloArriveeEl) veloArriveeEl.value = falaiseItem.nomformate || ''
          verifierExistenceItineraire(arretIdEl?.value || '', falaiseItem.id)
          emitMapEvent('falaise', falaiseMapDetail(falaiseItem))
        } else {
          if (falaiseIdEl) falaiseIdEl.value = ''
          if (veloArriveeEl) veloArriveeEl.value = ''
          emitMapEvent('falaise', null)
        }
      }

      return () =>
        h('div', { class: 'flex flex-col md:flex-row gap-4 md:items-center flex-1' }, [
          // Arrêt field
          h('div', { class: 'flex flex-col gap-1 grow' }, [
            h('div', { class: 'relative not-prose' }, [
              h('label', { class: 'form-control', for: 'arret_nom' }, [
                h('b', null, 'Arrêt de départ :'),
                h(
                  FormAutocomplete,
                  {
                    modelValue: arretValue.value,
                    'onUpdate:modelValue': (v: string) => {
                      arretValue.value = v
                    },
                    items: arrets,
                    disabled: arretDisabled.value,
                    onSelect: onArretSelect,
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
                h('b', null, 'Falaise d\'arrivée :'),
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
