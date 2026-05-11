import { createApp } from "vue";
import { createPinia } from "pinia";
import QrGenerator from "@/components/qr/QrGenerator.vue";

declare global {
  interface Window {
    __QR_DATA__?: {
      token: string;
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("vue-qr-generator");
  if (!mountEl) {
    console.warn("[velogrimpe] No mount point found for qr-generator");
    return;
  }

  const pinia = createPinia();
  const app = createApp(QrGenerator);
  app.use(pinia);
  app.mount(mountEl);

  console.log("[velogrimpe] QR generator mounted");
});
