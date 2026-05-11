<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from "vue";
import QRCodeStyling from "qr-code-styling";

const props = defineProps<{ url: string }>();

const container = useTemplateRef<HTMLDivElement>("container");
let qr: QRCodeStyling | null = null;

const FALLBACK = "https://www.velogrimpe.fr/";

function buildOptions(data: string) {
  return {
    width: 300,
    height: 300,
    margin: 7,
    data: data || FALLBACK,
    image: "/images/logo_no_bg.png",
    dotsOptions: { color: "#2d8957", type: "rounded" as const },
    cornersSquareOptions: { color: "#0a0308", type: "extra-rounded" as const },
    cornersDotOptions: { color: "#0c0308", type: "dot" as const },
    imageOptions: { margin: 0, crossOrigin: "anonymous" as const },
    qrOptions: { errorCorrectionLevel: "H" as const },
  };
}

onMounted(() => {
  qr = new QRCodeStyling(buildOptions(props.url));
  if (container.value) qr.append(container.value);
});

watch(
  () => props.url,
  (v) => qr?.update({ data: v || FALLBACK }),
);

defineExpose({
  download(name = "velogrimpe-qr") {
    qr?.download({ name, extension: "png" });
  },
});
</script>

<template>
  <div ref="container" class="flex justify-center"></div>
</template>
