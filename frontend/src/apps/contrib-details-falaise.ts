import { createApp, h, ref } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

interface FalaiseItem extends FormAutocompleteItem {
  id: number
  nom: string
}

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-falaise-selector')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-falaise-selector mount point not found')
    return
  }

  let falaises: FalaiseItem[] = []
  let currentFalaiseId: number | null = null

  try {
    falaises = JSON.parse(mountEl.dataset.falaises || '[]')
    currentFalaiseId = mountEl.dataset.currentId ? parseInt(mountEl.dataset.currentId, 10) : null
  } catch (e) {
    console.error('[velogrimpe] Failed to parse falaises data:', e)
  }

  // Find current falaise name
  const currentFalaise = falaises.find((f) => f.id === currentFalaiseId)
  const initialValue = currentFalaise ? `${currentFalaise.nom} (${currentFalaise.id})` : ''

  const app = createApp({
    setup() {
      const selectedValue = ref(initialValue)

      const onFalaiseSelect = (item: FormAutocompleteItem | null) => {
        if (item && item.id) {
          window.location.href = `/ajout/contrib/details_falaise.php?falaise_id=${item.id}`
        }
      }

      return () =>
        h(
          FormAutocomplete,
          {
            modelValue: selectedValue.value,
            'onUpdate:modelValue': (v: string) => {
              selectedValue.value = v
            },
            items: falaises.map((f) => ({
              id: f.id,
              nom: `${f.nom} (${f.id})`,
            })),
            placeholder: 'Rechercher une falaise...',
            acceptNewValue: false,
            disabled: false,
            onSelect: onFalaiseSelect,
          },
          {
            icon: () =>
              h(
                'svg',
                { class: 'w-4 h-4 fill-none stroke-current shrink-0' },
                [h('use', { href: '#search' })]
              ),
          }
        )
    },
  })

  app.mount(mountEl)
  console.log('[velogrimpe] Vue contrib-details-falaise selector mounted')
})
