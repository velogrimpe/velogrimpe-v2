<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import QrPreview from "./QrPreview.vue";
import ToastContainer from "@/components/shared/ToastContainer.vue";
import { useToast } from "@/composables/useToast";

const { showToast } = useToast();

function defaultTag() {
  const d = new Date();
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `link-${yy}${mm}${dd}`;
}

const rawUrl = ref("https://www.velogrimpe.fr/");
const tag = ref(defaultTag());

const trimmedTag = computed(() => tag.value.trim());
const tagInvalid = computed(() => trimmedTag.value === "");

const finalUrl = computed(() => {
  if (tagInvalid.value) return "";
  try {
    const u = new URL(rawUrl.value.trim());
    u.searchParams.set("source", trimmedTag.value);
    return u.toString();
  } catch {
    return "";
  }
});

const urlInvalid = computed(() => {
  if (!rawUrl.value.trim()) return true;
  try {
    new URL(rawUrl.value.trim());
    return false;
  } catch {
    return true;
  }
});

const canExport = computed(() => finalUrl.value !== "");

const qrRef = useTemplateRef<InstanceType<typeof QrPreview>>("qrRef");

async function copy() {
  if (!canExport.value) return;
  try {
    await navigator.clipboard.writeText(finalUrl.value);
    showToast("Lien copié !", "success");
  } catch {
    showToast("Impossible de copier le lien", "error");
  }
}

function download() {
  if (!canExport.value) return;
  qrRef.value?.download(`velogrimpe-${trimmedTag.value}`);
}
</script>

<template>
  <div class="card bg-base-100 shadow-xl max-w-2xl mx-auto my-8">
    <div class="card-body gap-4">
      <h1 class="card-title text-2xl">QR &amp; liens trackés</h1>
      <p class="text-sm opacity-70">
        Construit une URL avec un paramètre <code>source</code> pour suivre
        l'origine des visites, et génère un QR code aux couleurs velogrimpe.
      </p>

      <label class="form-control">
        <span class="label label-text font-semibold">URL à publier</span>
        <input
          v-model="rawUrl"
          type="url"
          required
          placeholder="https://www.velogrimpe.fr/…"
          class="input input-bordered w-full"
          :class="{ 'input-error': urlInvalid }"
        />
        <span v-if="urlInvalid" class="label label-text-alt text-error">
          URL invalide
        </span>
      </label>

      <label class="form-control">
        <span class="label label-text font-semibold">
          Tag (code de suivi, ex: qrcode-climbup-oct-26, flyers-fev-25,
          instagram)
        </span>
        <input
          v-model="tag"
          type="text"
          required
          placeholder="ex: instagram, flyer-tdf, link-260511"
          class="input input-bordered w-full"
          :class="{ 'input-error': tagInvalid }"
        />
        <span v-if="tagInvalid" class="label label-text-alt text-error">
          Le tag est obligatoire
        </span>
      </label>

      <label class="form-control">
        <span class="label label-text font-semibold">Lien final</span>
        <textarea
          :value="finalUrl"
          readonly
          rows="2"
          class="textarea textarea-bordered w-full font-mono text-xs"
          :placeholder="canExport ? '' : 'Renseigne une URL et un tag valides'"
        ></textarea>
      </label>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canExport"
          @click="copy"
        >
          Copier le lien
        </button>
        <button
          type="button"
          class="btn btn-outline"
          :disabled="!canExport"
          @click="download"
        >
          Télécharger le QR (PNG)
        </button>
      </div>

      <div class="divider">QR code</div>
      <QrPreview ref="qrRef" :url="finalUrl" />
    </div>
    <ToastContainer />
  </div>
</template>
