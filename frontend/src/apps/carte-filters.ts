import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { FilterPanel } from '@/components/filters'
import { useFalaisesStore } from '@/stores'
import type { Falaise, Gare, Ville } from '@/types'

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-filters')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-filters mount point not found')
    return
  }

  // Create Vue app
  const app = createApp(FilterPanel)
  const pinia = createPinia()
  app.use(pinia)

  // Parse data from PHP (passed via data attributes)
  try {
    const falaises: Falaise[] = JSON.parse(mountEl.dataset.falaises || '[]')
    const gares: Gare[] = JSON.parse(mountEl.dataset.gares || '[]')
    const villes: Ville[] = JSON.parse(mountEl.dataset.villes || '[]')

    // Initialize store with PHP data
    const store = useFalaisesStore(pinia)
    store.initialize({ falaises, gares, villes })

    console.log(`[velogrimpe] Initialized with ${falaises.length} falaises, ${gares.length} gares, ${villes.length} villes`)
  } catch (e) {
    console.error('[velogrimpe] Failed to parse data from PHP:', e)
  }

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue filters app mounted')
})
