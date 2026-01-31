import { createApp } from "vue";
import { createPinia } from "pinia";
import CarteMapFilters from "@/components/carte/CarteMapFilters.vue";
import type { Ville } from "@/types";

function initApp() {
  const mountEl = document.getElementById("vue-map-filters");
  if (!mountEl) {
    console.warn("[velogrimpe] #vue-map-filters mount point not found");
    return;
  }

  // Parse data from PHP (passed via data attributes)
  let falaises: Array<{ falaise_id: number; falaise_nom: string }> = [];
  let gares: Array<{ gare_id: number; gare_nom: string }> = [];
  let villes: Ville[] = [];

  try {
    falaises = JSON.parse(mountEl.dataset.falaises || "[]");
    gares = JSON.parse(mountEl.dataset.gares || "[]");
    villes = JSON.parse(mountEl.dataset.villes || "[]");
    console.log(
      `[velogrimpe] Parsed data: ${falaises.length} falaises, ${gares.length} gares, ${villes.length} villes`,
    );
  } catch (e) {
    console.error("[velogrimpe] Failed to parse data from PHP:", e);
  }

  // Create Vue app with Pinia
  const app = createApp(CarteMapFilters, {
    falaises,
    gares,
    villes,
  });

  const pinia = createPinia();
  app.use(pinia);

  // Mount the app
  app.mount(mountEl);
  console.log("[velogrimpe] Vue map filters app mounted");
}

// Handle both cases: DOM already loaded or not yet
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  // DOM is already loaded, but Leaflet control might not exist yet
  // Use a small delay to ensure Leaflet has added the control
  setTimeout(initApp, 0);
}
