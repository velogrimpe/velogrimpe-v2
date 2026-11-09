import { createApp } from 'vue'
import BusStopDialog from '@/components/ajout/BusStopDialog.vue'

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-bus-stop-dialog')
  if (!mountEl) return

  createApp(BusStopDialog).mount(mountEl)
  console.log('[velogrimpe] Vue bus-stop-dialog mounted')
})
