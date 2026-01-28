<script setup lang="ts">
import { useSortiesStore } from "@/stores/sorties";
import type { Sortie } from "@/types/sortie";

const props = defineProps<{
  sortie: Sortie;
  compact?: boolean;
}>();

const store = useSortiesStore();

function handleClick() {
  store.selectSortie(props.sortie);
}
</script>

<template>
  <div class="relative">
    <button
      class="text-left w-full rounded p-2 transition-colors hover:bg-base-200 cursor-pointer"
      :class="{
        'opacity-60': sortie.is_past,
        'text-xs': compact,
        'bg-primary/10 hover:bg-primary/20': !sortie.is_past,
        'bg-base-200': sortie.is_past,
      }"
      @click="handleClick"
    >
      <div class="font-semibold truncate" :class="{ 'text-xs': compact }">
        {{ sortie.falaise_principale_nom }}
      </div>
      <div class="text-xs text-base-content/70 truncate">
        {{ sortie.ville_depart }}
      </div>
      <div
        v-if="sortie.nb_interesses > 0"
        class="text-xs text-base-content/60 mt-1"
      >
        {{ sortie.nb_interesses }} intéressé{{
          sortie.nb_interesses > 1 ? "s" : ""
        }}
      </div>
    </button>
  </div>
</template>
