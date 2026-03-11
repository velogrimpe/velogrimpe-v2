import { createApp } from 'vue'
import { createPinia } from 'pinia'
import NewsletterAdmin from '@/components/newsletter/NewsletterAdmin.vue'

declare global {
  interface Window {
    __NEWSLETTER_DATA__?: {
      token: string
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-newsletter-admin')
  if (!mountEl) {
    console.warn('[velogrimpe] No mount point found for newsletter-admin')
    return
  }

  const pinia = createPinia()
  const app = createApp(NewsletterAdmin)
  app.use(pinia)
  app.mount(mountEl)

  console.log('[velogrimpe] Newsletter admin mounted')
})
