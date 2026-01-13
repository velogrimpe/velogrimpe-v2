<script setup lang="ts">
import { useFiltersStore } from '@/stores'
import ExpositionFilter from './ExpositionFilter.vue'
import NbVoiesFilter from './NbVoiesFilter.vue'
import CotationFilter from './CotationFilter.vue'
import TypeVoiesFilter from './TypeVoiesFilter.vue'
import VilleSelect from './VilleSelect.vue'
import TrainFilter from './TrainFilter.vue'
import VeloFilter from './VeloFilter.vue'
import ApprocheFilter from './ApprocheFilter.vue'
import TotalFilter from './TotalFilter.vue'

const store = useFiltersStore()
</script>

<template>
  <form class="flex flex-col gap-2 text-sm" @submit.prevent>
    <!-- Falaise Section -->
    <div class="flex flex-col gap-2">
      <div><b class="text-primary text-base">Falaise</b></div>
      <div class="flex flex-col gap-2">
        <ExpositionFilter />
        <NbVoiesFilter />
        <CotationFilter />
        <TypeVoiesFilter />
      </div>
    </div>

    <hr class="border-t border-base-300 my-1" />

    <!-- Accès Section -->
    <div class="flex flex-col gap-2">
      <div class="md:mt-2 flex flex-row gap-1">
        <div><b class="text-primary text-base">Accès</b></div>
      </div>
      <VilleSelect />
      <TrainFilter />
      <VeloFilter />
      <ApprocheFilter />
    </div>

    <hr class="border-t border-base-300 my-1" />

    <!-- Total Section -->
    <div class="flex flex-col gap-2">
      <div><b class="text-primary text-base">Temps total</b></div>
      <TotalFilter />
    </div>

    <!-- Reset Button -->
    <div class="mt-2">
      <button
        type="button"
        class="btn btn-sm btn-outline btn-primary w-full"
        :disabled="!store.hasActiveFilters"
        @click="store.resetFilters()"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4C14.7486 4 17.1749 5.38626 18.6156 7.5H16V9.5H22V3.5H20V5.99936C18.1762 3.57166 15.2724 2 12 2C6.47715 2 2 6.47715 2 12H4C4 7.58172 7.58172 4 12 4ZM20 12C20 16.4183 16.4183 20 12 20C9.25144 20 6.82508 18.6137 5.38443 16.5H8V14.5H2V20.5H4V18.0006C5.82381 20.4283 8.72764 22 12 22C17.5228 22 22 17.5228 22 12H20Z"></path>
        </svg>
        Réinitialiser les filtres
      </button>
    </div>
  </form>
</template>
