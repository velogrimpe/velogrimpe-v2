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
import Icon from '@/components/shared/Icon.vue'

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
        <Icon name="refresh" />
        Réinitialiser les filtres
      </button>
    </div>
  </form>
</template>
