import { createApp, h } from 'vue'
import SunIndicator from '@/components/shared/SunIndicator.vue'

document.addEventListener('DOMContentLoaded', () => {
  // Fonctionnalité en preview : activée uniquement avec ?preview=true dans l'URL.
  if (new URLSearchParams(window.location.search).get('preview') !== 'true') return

  const mountEl = document.getElementById('vue-sun-simulator')
  if (!mountEl) return

  const lat = parseFloat(mountEl.dataset.lat || '')
  const lng = parseFloat(mountEl.dataset.lng || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return

  const app = createApp({
    setup() {
      return () => h(SunIndicator, { lat, lng })
    }
  })

  app.mount(mountEl)
})
