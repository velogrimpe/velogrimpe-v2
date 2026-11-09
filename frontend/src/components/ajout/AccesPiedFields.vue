<script setup lang="ts">
/**
 * Champs facultatifs d'un accès à pied (description, km, D+, D-, trace GPX), en champs natifs :
 * `acces_pieton[<id>][variante|description|km|dplus|dmoins]` et le fichier `acces_gpx_<id>`.
 *
 * `id` identifie la liaison dans le formulaire hôte : l'arrêt (formulaire de falaise, qui les envoie
 * tels quels avec le formulaire) ou la falaise (formulaire d'arrêt, dialogue de l'éditeur, qui les lisent
 * au submit avec `lireAccesPied()` de `@/utils/acces-pied`). Mêmes contrôles de GPX côté serveur que
 * pour le formulaire d'ajout d'accès (`velo_lire_gpx_upload`).
 */
defineProps<{ id: number | string }>();
</script>

<template>
  <div class="flex flex-col gap-2 mt-2">
    <input
      type="text"
      :name="`acces_pieton[${id}][variante]`"
      maxlength="100"
      placeholder="Nom de la variante (optionnel) : ex. « Option par le Nord »"
      aria-label="Nom de la variante"
      class="input input-sm w-full"
    />
    <textarea
      :name="`acces_pieton[${id}][description]`"
      rows="2"
      class="textarea textarea-sm leading-5 w-full"
      placeholder="Description : durée, sentier balisé ou non, passages délicats…"
    ></textarea>
    <div class="flex flex-wrap gap-2">
      <input
        type="number"
        :name="`acces_pieton[${id}][km]`"
        step="0.1"
        min="0"
        placeholder="km"
        aria-label="Distance (km)"
        class="input input-sm w-24"
      />
      <input
        type="number"
        :name="`acces_pieton[${id}][dplus]`"
        min="0"
        placeholder="D+ (m)"
        aria-label="D+ (m)"
        class="input input-sm w-24"
      />
      <input
        type="number"
        :name="`acces_pieton[${id}][dmoins]`"
        min="0"
        placeholder="D- (m)"
        aria-label="D- (m)"
        class="input input-sm w-24"
      />
    </div>
    <label class="text-xs flex flex-col gap-1">
      Trace GPS (optionnel, au format GPX)
      <input
        type="file"
        :name="`acces_gpx_${id}`"
        accept=".gpx"
        class="file-input file-input-sm file-input-primary"
      />
    </label>
  </div>
</template>
