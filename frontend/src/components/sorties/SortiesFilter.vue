<script setup lang="ts">
import { useSortiesStore } from "@/stores/sorties";

const store = useSortiesStore();

function handleVilleChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const value = select.value === "" ? null : Number(select.value);
  store.setFilterVille(value);
}
</script>

<template>
  <div class="bg-base-100 rounded-lg p-4 shadow-lg">
    <div
      class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
    >
      <div class="flex-1 flex flex-col md:flex-row md:gap-4">
        <label for="ville-filter" class="label">
          <span class="label-text font-semibold"
            >Filtrer par ville de départ</span
          >
        </label>
        <select
          id="ville-filter"
          class="select select-bordered w-full max-w-xs"
          :value="store.filterVilleId ?? ''"
          @change="handleVilleChange"
        >
          <option value="">Toutes les villes</option>
          <option
            v-for="ville in store.villes"
            :key="ville.ville_id"
            :value="ville.ville_id"
          >
            {{ ville.ville_nom }}
          </option>
        </select>
      </div>

      <div class="text-sm text-base-content/70">
        <span v-if="store.filteredSorties.length === 0"
          >Aucune sortie trouvée</span
        >
        <span v-else-if="store.filteredSorties.length === 1"
          >1 sortie disponible</span
        >
        <span v-else
          >{{ store.filteredSorties.length }} sorties disponibles</span
        >
      </div>
    </div>
  </div>
</template>
