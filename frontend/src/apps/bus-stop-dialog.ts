import { createApp } from 'vue'
import BusStopDialog from '@/components/ajout/BusStopDialog.vue'
import type { FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

interface ArretItem extends FormAutocompleteItem {
  id: number
  nom: string
}
interface LigneItem extends FormAutocompleteItem {
  id: number
  nom: string
  description?: string
  lien?: string
}

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-bus-stop-dialog')
  if (!mountEl) return

  let arrets: ArretItem[] = []
  let lignes: LigneItem[] = []
  try {
    arrets = JSON.parse(mountEl.dataset.arrets || '[]')
    lignes = JSON.parse(mountEl.dataset.lignes || '[]')
  } catch (e) {
    console.error('[velogrimpe] Failed to parse bus-stop-dialog data:', e)
  }

  createApp(BusStopDialog, { arrets, lignes }).mount(mountEl)
  console.log('[velogrimpe] Vue bus-stop-dialog mounted')
})
