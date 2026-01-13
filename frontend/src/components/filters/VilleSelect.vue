<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore, useFalaisesStore } from '@/stores'

const filtersStore = useFiltersStore()
const falaisesStore = useFalaisesStore()

const selected = computed({
  get: () => filtersStore.filters.villeId ?? '-1',
  set: (value: string) => {
    filtersStore.setVilleId(value === '-1' ? null : value)
  },
})
</script>

<template>
  <div class="flex flex-row gap-2">
    <div class="font-bold">&bull; Au départ de</div>
    <select v-model="selected" class="select select-primary select-xs w-32">
      <option value="-1">Choisir Ville</option>
      <option v-for="ville in falaisesStore.villes" :key="ville.ville_id" :value="ville.ville_id">
        {{ ville.ville_nom }}
      </option>
    </select>
  </div>
</template>
