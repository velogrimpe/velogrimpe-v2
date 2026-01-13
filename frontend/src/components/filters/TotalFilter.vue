<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores'

const store = useFiltersStore()

const tempsTV = computed({
  get: () => store.filters.total.tempsTV ?? '',
  set: (value: string | number) => {
    store.setTotalTempsTV(value === '' ? null : Number(value))
  },
})

const tempsTVA = computed({
  get: () => store.filters.total.tempsTVA ?? '',
  set: (value: string | number) => {
    store.setTotalTempsTVA(value === '' ? null : Number(value))
  },
})

const isDisabled = computed(() => !store.hasVilleSelected)
</script>

<template>
  <div class="flex flex-col gap-2" :class="{ 'opacity-30': isDisabled }">
    <div class="flex flex-row gap-2 items-center">
      <div class="font-bold">&bull; Total T+V</div>
      <div class="text-normal font-bold">&le;</div>
      <input
        type="number"
        v-model="tempsTV"
        step="1"
        min="0"
        class="input input-primary input-xs w-10"
        :disabled="isDisabled"
      />
      <div>min.</div>
    </div>
    <div class="flex flex-row gap-2 items-center">
      <div class="font-bold">&bull; Total T+V+A</div>
      <div class="text-normal font-bold">&le;</div>
      <input
        type="number"
        v-model="tempsTVA"
        step="1"
        min="0"
        class="input input-primary input-xs w-10"
        :disabled="isDisabled"
      />
      <div>min.</div>
    </div>
  </div>
</template>
