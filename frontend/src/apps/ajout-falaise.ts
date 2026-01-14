import { createApp, h, ref, watch, computed } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'
import MultiSelect, { type MultiSelectOption } from '@/components/shared/MultiSelect.vue'
import RoseDesVents from '@/components/shared/RoseDesVents.vue'

// Shared refs for exposition values (used by both MultiSelect and RoseDesVents)
const expo1Value = ref<string[]>([])
const expo2Value = ref<string[]>([])

// Computed strings for the rose component
const expo1String = computed(() => expo1Value.value.join(','))
const expo2String = computed(() => expo2Value.value.join(','))

interface FalaiseItem extends FormAutocompleteItem {
  latlng?: string
  status?: string
  nomformate?: string
}

// Exposition options for multi-select
const expositionOptions: MultiSelectOption[] = [
  { value: "'N'", label: 'N' },
  { value: "'S'", label: 'S' },
  { value: "'E'", label: 'E' },
  { value: "'O'", label: 'O' },
  { value: "'NE'", label: 'NE' },
  { value: "'NO'", label: 'NO' },
  { value: "'SE'", label: 'SE' },
  { value: "'SO'", label: 'SO' },
  { value: "'NNE'", label: 'NNE' },
  { value: "'NNO'", label: 'NNO' },
  { value: "'SSE'", label: 'SSE' },
  { value: "'SSO'", label: 'SSO' },
  { value: "'ENE'", label: 'ENE' },
  { value: "'ESE'", label: 'ESE' },
  { value: "'OSO'", label: 'OSO' },
  { value: "'ONO'", label: 'ONO' },
]

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

  // Mount exposition multi-selects
  mountExpositionSelects()
})

// Helper to parse comma-separated values with quotes (e.g., "'N','S'" -> ["'N'", "'S'"])
function parseExpositionValue(value: string): string[] {
  if (!value) return []
  // Split by comma and trim, keeping the quotes
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0)
}

function mountExpositionSelects() {
  // Mount exposhort1 (required)
  const expo1El = document.getElementById('vue-exposhort1')
  if (expo1El) {
    const presetValue = expo1El.dataset.value || ''
    expo1Value.value = parseExpositionValue(presetValue)

    const expo1App = createApp({
      setup() {
        return () => h(MultiSelect, {
          modelValue: expo1Value.value,
          'onUpdate:modelValue': (v: string[]) => {
            expo1Value.value = v
          },
          options: expositionOptions,
          name: 'falaise_exposhort1',
          required: true,
          placeholder: 'Sélectionner...',
        })
      }
    })
    expo1App.mount(expo1El)
  }

  // Mount exposhort2 (optional)
  const expo2El = document.getElementById('vue-exposhort2')
  if (expo2El) {
    const presetValue = expo2El.dataset.value || ''
    expo2Value.value = parseExpositionValue(presetValue)

    const expo2App = createApp({
      setup() {
        return () => h(MultiSelect, {
          modelValue: expo2Value.value,
          'onUpdate:modelValue': (v: string[]) => {
            expo2Value.value = v
          },
          options: expositionOptions,
          name: 'falaise_exposhort2',
          required: false,
          placeholder: 'Sélectionner...',
        })
      }
    })
    expo2App.mount(expo2El)
  }

  // Mount rose des vents preview
  const roseEl = document.getElementById('vue-rose-preview')
  if (roseEl) {
    const roseApp = createApp({
      setup() {
        return () => h(RoseDesVents, {
          expo1: expo1String.value,
          expo2: expo2String.value,
          size: 80,
        })
      }
    })
    roseApp.mount(roseEl)
  }

  // Expose setters for prefill from PHP
  ;(window as unknown as Record<string, unknown>).setExpo1Value = (value: string) => {
    expo1Value.value = parseExpositionValue(value)
  }
  ;(window as unknown as Record<string, unknown>).setExpo2Value = (value: string) => {
    expo2Value.value = parseExpositionValue(value)
  }
}
