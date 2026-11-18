import { createApp } from 'vue'
import AdminLigneGtfsImport from '@/components/admin/AdminLigneGtfsImport.vue'

// admin/arrets_lignes.php : dialog d'import GTFS d'une ligne (ouvert par js/admin-arrets-lignes.js)
document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-gtfs-import')
  if (mountEl) createApp(AdminLigneGtfsImport).mount(mountEl)
})
