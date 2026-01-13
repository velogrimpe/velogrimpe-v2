<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores'

const store = useFiltersStore()

const tempsMax = computed({
  get: () => store.filters.approche.tempsMax ?? '',
  set: (value: string | number) => {
    store.setApprocheTempsMax(value === '' ? null : Number(value))
  },
})
</script>

<template>
  <div class="flex flex-row gap-2 items-center">
    <div class="font-bold">&bull; Marche d'approche (A)</div>
    <div class="text-normal font-bold">&le;</div>
    <input
      type="number"
      v-model="tempsMax"
      step="1"
      min="0"
      class="input input-primary input-xs w-10"
    />
    <div>min.</div>
  </div>
</template>
