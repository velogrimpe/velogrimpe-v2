import { createApp } from "vue";
import { createPinia } from "pinia";
import { SortieForm } from "@/components/sorties";

interface Ville {
  ville_id: number;
  ville_nom: string;
}

interface Falaise {
  falaise_id: number;
  falaise_nom: string;
}

interface Gare {
  gare_id: number;
  gare_nom: string;
}

function init() {
  const mountEl = document.getElementById("vue-sortie-form");
  if (!mountEl) {
    console.warn("[velogrimpe] #vue-sortie-form mount point not found");
    return;
  }

  // Parse data attributes
  const villesData = mountEl.dataset.villes;
  const falaisesData = mountEl.dataset.falaises;
  const garesData = mountEl.dataset.gares;
  const sortieData = mountEl.dataset.sortie;
  const editMode = mountEl.dataset.editMode === "true";
  const editToken = mountEl.dataset.editToken || "";

  if (!villesData || !falaisesData || !garesData) {
    console.error("[velogrimpe] Missing required data attributes");
    return;
  }

  const villes: Ville[] = JSON.parse(villesData);
  const falaises: Falaise[] = JSON.parse(falaisesData);
  const gares: Gare[] = JSON.parse(garesData);

  // Parse initial data for edit mode
  const initialData = sortieData ? JSON.parse(sortieData) : undefined;

  // Create Vue app
  const app = createApp(SortieForm, {
    villes,
    falaises,
    gares,
    editMode,
    initialData,
    editToken,
  });

  const pinia = createPinia();
  app.use(pinia);

  // Mount the app
  app.mount(mountEl);
  console.log("[velogrimpe] Vue sortie form mounted", editMode ? "(edit mode)" : "");
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
