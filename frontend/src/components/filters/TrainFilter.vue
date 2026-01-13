<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores'

const store = useFiltersStore()

const tempsMax = computed({
  get: () => store.filters.train.tempsMax ?? '',
  set: (value: string | number) => {
    store.setTrainTempsMax(value === '' ? null : Number(value))
  },
})

const correspMax = computed({
  get: () => store.filters.train.correspMax,
  set: (value: number | null) => store.setTrainCorrespMax(value),
})

const terOnly = computed({
  get: () => store.filters.train.terOnly,
  set: (value: boolean) => store.setTrainTerOnly(value),
})

const isDisabled = computed(() => !store.hasVilleSelected)
</script>

<template>
  <div class="flex flex-col gap-2" :class="{ 'opacity-30': isDisabled }">
    <div class="flex flex-row gap-2 items-center">
      <div class="font-bold">&bull; Train (T)</div>
      <div class="text-normal font-bold">&le;</div>
      <input
        type="number"
        v-model="tempsMax"
        step="1"
        min="0"
        class="input input-primary input-xs w-10"
        :disabled="isDisabled"
      />
      <div>minutes</div>
    </div>
    <div class="flex flex-row items-center gap-1 ml-2">
      <div>Nb. Corresp.</div>
      <div class="flex flex-row gap-2 items-center">
        <label class="label cursor-pointer gap-1">
          <input
            type="radio"
            name="nbCorrespMax"
            :checked="correspMax === 0"
            class="radio radio-primary radio-xs"
            :disabled="isDisabled"
            @change="correspMax = 0"
          />
          <span class="label-text">0</span>
        </label>
        <label class="label cursor-pointer gap-1">
          <input
            type="radio"
            name="nbCorrespMax"
            :checked="correspMax === 1"
            class="radio radio-primary radio-xs"
            :disabled="isDisabled"
            @change="correspMax = 1"
          />
          <span class="label-text">&le;1</span>
        </label>
        <label class="label cursor-pointer gap-1">
          <input
            type="radio"
            name="nbCorrespMax"
            :checked="correspMax === null"
            class="radio radio-primary radio-xs"
            :disabled="isDisabled"
            @change="correspMax = null"
          />
          <span class="label-text">Illimité</span>
        </label>
      </div>
    </div>
    <label class="label cursor-pointer gap-2 ml-2 justify-start py-0">
      <input
        type="checkbox"
        v-model="terOnly"
        class="checkbox checkbox-primary checkbox-sm"
        :disabled="isDisabled"
      />
      <span class="label-text">TER uniquement (pas de TGV)</span>
    </label>
  </div>
</template>
