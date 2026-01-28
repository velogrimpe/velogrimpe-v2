import { createApp } from "vue";
import { createPinia } from "pinia";
import SortieDetails from "@/components/sorties/SortieDetails.vue";
import type { Sortie } from "@/types/sortie";

function init() {
  const mountEl = document.getElementById("vue-sortie-details");
  if (!mountEl) {
    console.warn("[velogrimpe] #vue-sortie-details mount point not found");
    return;
  }

  // Parse data attributes
  const sortieData = mountEl.dataset.sortie;

  if (!sortieData) {
    console.error("[velogrimpe] Missing sortie data attribute");
    return;
  }

  const sortie: Sortie = JSON.parse(sortieData);

  // Create Vue app
  const app = createApp(SortieDetails, {
    sortie,
  });

  const pinia = createPinia();
  app.use(pinia);

  // Mount the app
  app.mount(mountEl);
  console.log("[velogrimpe] Vue sortie details mounted");
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
