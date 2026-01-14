import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { TableauFilterPanel } from '@/components/filters'
import { TableauList } from '@/components/tableau'
import { useTableauStore } from '@/stores'
import type { TableauFalaise } from '@/types/tableau'

// Extend window to include the falaises data from PHP
declare global {
  interface Window {
    __TABLEAU_DATA__?: {
      falaises: TableauFalaise[]
      villeId: number
    }
  }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const filtersMountEl = document.getElementById('vue-filters')
  const listMountEl = document.getElementById('vue-tableau')

  if (!filtersMountEl && !listMountEl) {
    console.warn('[velogrimpe] No mount points found for tableau')
    return
  }

  // Create shared Pinia instance
  const pinia = createPinia()

  // Initialize tableau store with data from PHP FIRST
  const tableauStore = useTableauStore(pinia)

  if (window.__TABLEAU_DATA__) {
    tableauStore.initialize(window.__TABLEAU_DATA__)
    console.log('[velogrimpe] Tableau store initialized with', window.__TABLEAU_DATA__.falaises.length, 'falaises')
  } else {
    console.warn('[velogrimpe] No tableau data found on window.__TABLEAU_DATA__')
  }

  // Mount filters panel
  if (filtersMountEl) {
    const filtersApp = createApp(TableauFilterPanel)
    filtersApp.use(pinia)
    filtersApp.mount(filtersMountEl)
    console.log('[velogrimpe] Vue tableau filters mounted')
  }

  // Mount list
  if (listMountEl) {
    const listApp = createApp(TableauList)
    listApp.use(pinia)
    listApp.mount(listMountEl)
    console.log('[velogrimpe] Vue tableau list mounted')
  }
})
