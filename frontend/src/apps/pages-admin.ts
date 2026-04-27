import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PagesAdmin from '@/components/pages/PagesAdmin.vue'

declare global {
  interface Window {
    __PAGES_DATA__?: {
      token: string
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-pages-admin')
  if (!mountEl) {
    console.warn('[velogrimpe] No mount point found for pages-admin')
    return
  }

  const pinia = createPinia()
  const app = createApp(PagesAdmin)
  app.use(pinia)
  app.mount(mountEl)

  console.log('[velogrimpe] Pages admin mounted')
})
