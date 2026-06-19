import { createApp, h } from "vue";
import SunIndicator from "@/components/shared/SunIndicator.vue";

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("vue-sun-simulator");
  if (!mountEl) return;

  const lat = parseFloat(mountEl.dataset.lat || "");
  const lng = parseFloat(mountEl.dataset.lng || "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;

  const app = createApp({
    setup() {
      return () => h(SunIndicator, { lat, lng });
    },
  });

  app.mount(mountEl);
});
