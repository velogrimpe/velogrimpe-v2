import { createApp, h } from 'vue'
import RoseDesVents from '@/components/shared/RoseDesVents.vue'

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-rose-des-vents')
  if (!mountEl) return

  const expo1 = mountEl.dataset.expo1 || ''
  const expo2 = mountEl.dataset.expo2 || ''
  const size = parseInt(mountEl.dataset.size || '60', 10)

  const app = createApp({
    setup() {
      return () => h(RoseDesVents, { expo1, expo2, size })
    }
  })

  app.mount(mountEl)
})
