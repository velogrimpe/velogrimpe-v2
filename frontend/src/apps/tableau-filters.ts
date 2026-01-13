import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { TableauFilterPanel } from '@/components/filters'

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-filters')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-filters mount point not found')
    return
  }

  // Create Vue app
  const app = createApp(TableauFilterPanel)
  const pinia = createPinia()
  app.use(pinia)

  // Mount the app
  app.mount(mountEl)
  console.log('[velogrimpe] Vue tableau filters app mounted')
})
