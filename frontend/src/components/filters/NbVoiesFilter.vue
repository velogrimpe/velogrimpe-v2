<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores'

const store = useFiltersStore()

const options = [
  { value: 0, label: 'Pas de minimum' },
  { value: 20, label: 'Plus de 20' },
  { value: 50, label: 'Plus de 50' },
  { value: 100, label: 'Plus de 100' },
  { value: 200, label: 'Plus de 200' },
]

const selected = computed({
  get: () => store.filters.nbVoiesMin,
  set: (value: number) => store.setNbVoiesMin(value),
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div>&bull; Nombre de voies</div>
    <div>
      <label class="label cursor-pointer gap-2 p-0 pr-1 w-full justify-start">
        <select
          v-model.number="selected"
          class="select select-xs select-primary focus:outline-base-300"
        >
          <option v-for="opt in options" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>
    </div>
  </div>
</template>
