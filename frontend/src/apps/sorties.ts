import { createApp } from "vue";
import { createPinia } from "pinia";
import { SortiesApp } from "@/components/sorties";
import type { Ville } from "@/types/sortie";

function init() {
  const mountEl = document.getElementById("vue-sorties");
  if (!mountEl) {
    console.warn("[velogrimpe] #vue-sorties mount point not found");
    return;
  }

  // Parse data attributes
  const villesData = mountEl.dataset.villes;
  if (!villesData) {
    console.error("[velogrimpe] villes data not found");
    return;
  }

  const villes: Ville[] = JSON.parse(villesData);

  // Create Vue app
  const app = createApp(SortiesApp, {
    villes,
  });

  const pinia = createPinia();
  app.use(pinia);

  // Mount the app
  app.mount(mountEl);
  console.log("[velogrimpe] Vue sorties app mounted");
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
