import { createApp, h, ref, watch } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

interface FalaiseItem extends FormAutocompleteItem {
  latlng?: string
  status?: string
  nomformate?: string
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-ajout-falaise')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-ajout-falaise mount point not found')
    return
  }

  let falaises: FalaiseItem[] = []
  let isAdmin = false
  let presetFalaiseId: number | null = null

  try {
    falaises = JSON.parse(mountEl.dataset.falaises || '[]')
    isAdmin = mountEl.dataset.admin === 'true'
    presetFalaiseId = mountEl.dataset.presetFalaiseId
      ? parseInt(mountEl.dataset.presetFalaiseId, 10)
      : null
  } catch (e) {
    console.error('[velogrimpe] Failed to parse ajout-falaise data:', e)
  }

  // Helper function to format falaise name
  const formatNomFalaise = (nom: string): string => {
    return nom
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 255)
  }

  // Expose fetchAndPrefillData for compatibility with existing code
  const fetchAndPrefillData = (id: number | string) => {
    // This function is defined in the PHP page, call it if available
    if (typeof (window as unknown as { fetchAndPrefillData?: (id: number | string) => void }).fetchAndPrefillData === 'function') {
      (window as unknown as { fetchAndPrefillData: (id: number | string) => void }).fetchAndPrefillData(id)
    }
  }

  // Create Vue app
  const app = createApp({
    setup() {
      const falaiseValue = ref('')
      const isDisabled = ref(presetFalaiseId !== null)

      // If editing an existing falaise, pre-fill the value
      if (presetFalaiseId) {
        // The PHP page handles fetching data for existing falaise
        isDisabled.value = true
      }

      const onFalaiseSelect = (_item: FormAutocompleteItem | null, value: string) => {
        const confirmButton = document.getElementById('confirmButton')
        const falaiseExistsAlert = document.getElementById('falaiseExistsAlert')
        const falaiseEditInfo = document.getElementById('falaiseEditInfo')
        const falaiseIdEl = document.getElementById('falaise_id') as HTMLInputElement
        const falaiseNomformateEl = document.getElementById('falaise_nomformate') as HTMLInputElement
        const falaiseLatlngEl = document.getElementById('falaise_latlng') as HTMLInputElement
        const linkSelectedFalaise = document.getElementById('linkSelectedFalaise') as HTMLAnchorElement

        if (confirmButton) {
          confirmButton.textContent = 'Ajouter la falaise'
        }

        if (!value) {
          // Reset state
          if (falaiseExistsAlert) falaiseExistsAlert.classList.add('hidden')
          if (falaiseEditInfo) falaiseEditInfo.classList.add('hidden')
          return
        }

        // Check if selected value matches an existing falaise
        const existing = falaises.find(
          (f) => f.nom.toLowerCase() === value.toLowerCase()
        )

        if (existing) {
          // Hide image previews when selecting an existing falaise
          document.getElementById('falaise_img1_preview')?.classList.add('hidden')
          document.getElementById('falaise_img2_preview')?.classList.add('hidden')
          document.getElementById('falaise_img3_preview')?.classList.add('hidden')

          // Set coordinates and formatted name
          if (falaiseLatlngEl && existing.latlng) falaiseLatlngEl.value = existing.latlng
          if (falaiseNomformateEl && existing.nomformate) falaiseNomformateEl.value = existing.nomformate

          // Trigger marker update
          falaiseLatlngEl?.dispatchEvent(new Event('input'))

          if (existing.status === 'verrouillée') {
            // Locked falaise
            if (falaiseExistsAlert) falaiseExistsAlert.classList.remove('hidden')
            if (falaiseEditInfo) falaiseEditInfo.classList.add('hidden')
            if (linkSelectedFalaise) {
              linkSelectedFalaise.href = `/falaise.php?falaise_id=${existing.id}`
            }
            // Admin can still edit locked falaises
            if (isAdmin) {
              fetchAndPrefillData(existing.id)
            }
          } else {
            // Editable existing falaise
            if (falaiseExistsAlert) falaiseExistsAlert.classList.add('hidden')
            if (falaiseEditInfo) falaiseEditInfo.classList.remove('hidden')
            if (falaiseIdEl) falaiseIdEl.value = String(existing.id)
            fetchAndPrefillData(existing.id)
          }
        } else {
          // New falaise
          if (falaiseExistsAlert) falaiseExistsAlert.classList.add('hidden')
          if (falaiseEditInfo) falaiseEditInfo.classList.add('hidden')
          // Format the name for URL slug
          if (falaiseNomformateEl) falaiseNomformateEl.value = formatNomFalaise(value)
          if (falaiseIdEl) falaiseIdEl.value = ''
        }
      }

      // Watch for changes to update the formatted name
      watch(falaiseValue, (newVal) => {
        // Only update nomformate if it's a new falaise (no existing match)
        const existing = falaises.find(
          (f) => f.nom.toLowerCase() === newVal.toLowerCase()
        )
        if (!existing) {
          const falaiseNomformateEl = document.getElementById('falaise_nomformate') as HTMLInputElement
          if (falaiseNomformateEl) {
            falaiseNomformateEl.value = formatNomFalaise(newVal)
          }
        }
      })

      return () =>
        h(FormAutocomplete, {
          modelValue: falaiseValue.value,
          'onUpdate:modelValue': (v: string) => {
            falaiseValue.value = v
          },
          items: falaises.map((f) => ({
            ...f,
            // Add status to label for better UX
            nom: f.nom,
          })),
          acceptNewValue: true,
          disabled: isDisabled.value,
          onSelect: onFalaiseSelect,
        })
    },
  })

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue ajout-falaise autocomplete mounted')
})
