<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores'

const store = useFiltersStore()

const tempsMax = computed({
  get: () => store.filters.velo.tempsMax ?? '',
  set: (value: string | number) => {
    store.setVeloTempsMax(value === '' ? null : Number(value))
  },
})

const distMax = computed({
  get: () => store.filters.velo.distMax ?? '',
  set: (value: string | number) => {
    store.setVeloDistMax(value === '' ? null : Number(value))
  },
})

const denivMax = computed({
  get: () => store.filters.velo.denivMax ?? '',
  set: (value: string | number) => {
    store.setVeloDenivMax(value === '' ? null : Number(value))
  },
})

const apiedPossible = computed({
  get: () => store.filters.velo.apiedPossible,
  set: (value: boolean) => store.setVeloApiedPossible(value),
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-row gap-2 items-center">
      <div class="font-bold">&bull; Vélo (V)</div>
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
    <div class="flex flex-row gap-2 items-center ml-2">
      <div>Distance</div>
      <div class="text-normal font-bold">&le;</div>
      <input
        type="number"
        v-model="distMax"
        step="1"
        min="0"
        class="input input-primary input-xs w-10"
      />
      <div>km</div>
    </div>
    <div class="flex flex-row gap-2 items-center ml-2">
      <div>Dénivelé</div>
      <div class="text-normal font-bold">&le;</div>
      <input
        type="number"
        v-model="denivMax"
        step="1"
        min="0"
        class="input input-primary input-xs w-10"
      />
      <div>m D+</div>
    </div>
    <label class="label cursor-pointer gap-2 ml-2 justify-start py-0">
      <input
        type="checkbox"
        v-model="apiedPossible"
        class="checkbox checkbox-primary checkbox-sm"
      />
      <span class="label-text">Accessible à pied</span>
    </label>
  </div>
</template>
