import { createApp } from "vue";
import { createPinia } from "pinia";
import EmportApp from "@/components/EmportApp.vue";

function init() {
  const mountEl = document.getElementById("vue-emport");
  if (!mountEl) {
    console.warn("[velogrimpe] #vue-emport mount point not found");
    return;
  }

  const app = createApp(EmportApp);
  app.use(createPinia());
  app.mount(mountEl);
  console.log("[velogrimpe] Vue emport app mounted");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
