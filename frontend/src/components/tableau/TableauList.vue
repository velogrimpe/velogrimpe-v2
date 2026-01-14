<script setup lang="ts">
import { computed } from 'vue'
import { useTableauStore } from '@/stores'
import FalaiseMobileCard from './FalaiseMobileCard.vue'
import FalaiseDesktopRow from './FalaiseDesktopRow.vue'
import SortDropdown from './SortDropdown.vue'

const store = useTableauStore()

const falaises = computed(() => store.sortedFalaises)
const villeId = computed(() => store.villeId ?? 0)
const filteredCount = computed(() => store.filteredCount)
const hasResults = computed(() => filteredCount.value > 0)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Info and Sort controls -->
    <div class="flex justify-between w-full items-center">
      <div id="nbFalaisesInFilter" class="text-primary text-sm font-bold">
        {{ filteredCount }} falaises
      </div>
      <SortDropdown />
    </div>

    <!-- Mobile List -->
    <div class="flex flex-col gap-4 md:hidden">
      <FalaiseMobileCard
        v-for="falaise in falaises"
        :key="falaise[0].falaise_id"
        :falaise="falaise"
        :ville-id="villeId"
      />
      <div
        v-if="!hasResults"
        class="bg-base-100 text-center w-full py-4 font-bold rounded-lg shadow-lg"
      >
        Aucune falaise ne correspond aux filtres.
      </div>
    </div>

    <!-- Desktop Grid -->
    <div
      class="hidden md:grid grid-cols-[1.5fr_60px_1fr_2fr_2fr] gap-[1px] bg-base-300 shadow-xl rounded-lg overflow-hidden text-center items-center text-sm"
    >
      <!-- Header row -->
      <div class="bg-base-100 px-2 py-1 self-stretch flex items-center justify-center vg-desktop-header"></div>
      <div class="bg-base-100 px-1 py-1 self-stretch flex items-center justify-center font-bold text-xs vg-desktop-header">
        Temps total (T+V+A)
      </div>
      <div class="bg-base-100 px-2 py-1 self-stretch flex flex-col items-center justify-center vg-desktop-header">
        <img class="h-12" alt="Train" :src="'/images/icons/train-station_color.png'" />
      </div>
      <div class="bg-base-100 px-2 py-1 self-stretch flex flex-col items-center justify-center vg-desktop-header">
        <img class="h-12" alt="Velo" :src="'/images/icons/bicycle_color.png'" />
      </div>
      <div class="bg-base-100 px-2 py-1 self-stretch flex flex-col items-center justify-center vg-desktop-header">
        <img class="h-12" alt="Escalade" :src="'/images/icons/rock-climbing_color.png'" />
      </div>

      <!-- Data rows -->
      <template v-for="falaise in falaises" :key="falaise[0].falaise_id">
        <FalaiseDesktopRow :falaise="falaise" :ville-id="villeId" />
      </template>

      <!-- No results message -->
      <div
        v-if="!hasResults"
        class="bg-base-100 text-center w-full col-span-5 py-4 font-bold"
      >
        Aucune falaise ne correspond aux filtres.
      </div>
    </div>
  </div>
</template>
