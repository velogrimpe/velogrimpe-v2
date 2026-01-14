import { createApp, h, ref } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

interface GareItem extends FormAutocompleteItem {
  codeuic?: string
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
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

  // Create Vue app
  const app = createApp({
    setup() {
      const gareValue = ref(presetGareNom || '')

      const onGareSelect = (item: FormAutocompleteItem | null) => {
        const gareIdEl = document.getElementById('gare_id') as HTMLInputElement

        if (item) {
          if (gareIdEl) gareIdEl.value = String(item.id)
          verifierExistenceItineraire()
        } else {
          if (gareIdEl) gareIdEl.value = ''
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
        h(FormAutocomplete, {
          modelValue: gareValue.value,
          'onUpdate:modelValue': (v: string) => {
            gareValue.value = v
          },
          items: gares,
          onSelect: onGareSelect,
        })
    },
  })

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue ajout-train autocomplete mounted')
})
