import { createApp } from 'vue'
import { createPinia } from 'pinia'
import InfoPanel from '@/components/carte/InfoPanel.vue'
import { useCarteStore, type SelectedItem } from '@/stores/carte'
import '@/types/global.d'

// ES modules are deferred, so DOM is ready when this runs
function init() {
  const mountEl = document.getElementById('vue-info-panel')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-info-panel mount point not found')
    return
  }

  // Create Vue app
  const app = createApp(InfoPanel)
  const pinia = createPinia()
  app.use(pinia)

  // Initialize store
  const store = useCarteStore(pinia)

  // Expose global API for Leaflet to call
  window.velogrimpe = window.velogrimpe || {} as Window['velogrimpe']
  window.velogrimpe.carteInfo = {
    setSelected: (item: SelectedItem) => {
      store.setSelected(item)
    },
    clearSelected: () => {
      store.clearSelected()
    },
    updateStats: (total: number, filtered: number) => {
      store.updateStats(total, filtered)
    }
  }

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue info panel mounted')

  // Notify Leaflet that Vue is ready
  window.dispatchEvent(new CustomEvent('velogrimpe:info-ready'))
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
