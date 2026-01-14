import { createApp } from 'vue'
import SearchAutocomplete from '@/components/carte/SearchAutocomplete.vue'

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-search')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-search mount point not found')
    return
  }

  // Parse data from PHP (passed via data attributes)
  let falaises: Array<{ falaise_id: number; falaise_nom: string }> = []
  let gares: Array<{ gare_id: number; gare_nom: string }> = []

  try {
    falaises = JSON.parse(mountEl.dataset.falaises || '[]')
    gares = JSON.parse(mountEl.dataset.gares || '[]')
  } catch (e) {
    console.error('[velogrimpe] Failed to parse search data:', e)
  }

  // Create Vue app with props
  const app = createApp(SearchAutocomplete, {
    falaises,
    gares,
  })

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue search autocomplete mounted')
})
