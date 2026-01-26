import { createApp, h, ref, onMounted } from 'vue'
import FormAutocomplete from '@/components/shared/FormAutocomplete.vue'
import type { FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

// Helper to create search icon slot
const searchIconSlot = () => ({
  icon: () => h('svg', { class: 'w-4 h-4 fill-none stroke-current shrink-0' }, [h('use', { href: '#search' })]),
})

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-falaise-comment')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-falaise-comment mount point not found')
    return
  }

  let villes: FormAutocompleteItem[] = []
  let gares: FormAutocompleteItem[] = []

  try {
    villes = JSON.parse(mountEl.dataset.villes || '[]')
    gares = JSON.parse(mountEl.dataset.gares || '[]')
  } catch (e) {
    console.error('[velogrimpe] Failed to parse falaise-comment data:', e)
  }

  // Create Vue app
  const app = createApp({
    setup() {
      const villeValue = ref('')
      const gareDepartValue = ref('')
      const gareArriveeValue = ref('')

      // Expose refs to window for edit comment functionality
      onMounted(() => {
        // Allow external code to update the values (e.g., when editing a comment)
        (window as unknown as { setCommentFormValues?: (values: { ville_nom?: string; gare_depart?: string; gare_arrivee?: string }) => void }).setCommentFormValues = (values) => {
          if (values.ville_nom !== undefined) villeValue.value = values.ville_nom
          if (values.gare_depart !== undefined) gareDepartValue.value = values.gare_depart
          if (values.gare_arrivee !== undefined) gareArriveeValue.value = values.gare_arrivee
        }
      })

      return () =>
        h('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
          // Ville field
          h('div', { class: 'relative' }, [
            h('div', { class: 'form-control w-full' }, [
              h('label', { class: 'label', for: 'ville_nom' }, [
                h('span', { class: 'label-text' }, 'Ville de départ'),
              ]),
              h(
                FormAutocomplete,
                {
                  modelValue: villeValue.value,
                  'onUpdate:modelValue': (v: string) => {
                    villeValue.value = v
                  },
                  items: villes,
                  acceptNewValue: true,
                },
                searchIconSlot()
              ),
              // Hidden input for form submission
              h('input', {
                type: 'hidden',
                name: 'ville_nom',
                value: villeValue.value,
              }),
            ]),
          ]),
          // Gare depart field
          h('div', { class: 'relative' }, [
            h('div', { class: 'form-control w-full' }, [
              h('label', { class: 'label', for: 'gare_depart' }, [
                h('span', { class: 'label-text' }, 'Gare de départ'),
              ]),
              h(
                FormAutocomplete,
                {
                  modelValue: gareDepartValue.value,
                  'onUpdate:modelValue': (v: string) => {
                    gareDepartValue.value = v
                  },
                  items: gares,
                  acceptNewValue: true,
                },
                searchIconSlot()
              ),
              // Hidden input for form submission
              h('input', {
                type: 'hidden',
                name: 'gare_depart',
                value: gareDepartValue.value,
              }),
            ]),
          ]),
          // Gare arrivee field
          h('div', { class: 'relative' }, [
            h('div', { class: 'form-control w-full' }, [
              h('label', { class: 'label', for: 'gare_arrivee' }, [
                h('span', { class: 'label-text' }, 'Gare d\'arrivée'),
              ]),
              h(
                FormAutocomplete,
                {
                  modelValue: gareArriveeValue.value,
                  'onUpdate:modelValue': (v: string) => {
                    gareArriveeValue.value = v
                  },
                  items: gares,
                  acceptNewValue: true,
                },
                searchIconSlot()
              ),
              // Hidden input for form submission
              h('input', {
                type: 'hidden',
                name: 'gare_arrivee',
                value: gareArriveeValue.value,
              }),
            ]),
          ]),
        ])
    },
  })

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue falaise-comment autocomplete mounted')
})
