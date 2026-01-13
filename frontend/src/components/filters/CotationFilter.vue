<script setup lang="ts">
import { useFiltersStore } from '@/stores'
import type { Cotation } from '@/types'

const store = useFiltersStore()

const cotations: { id: Cotation; label: string }[] = [
  { id: '40', label: '≤4' },
  { id: '50', label: '5-' },
  { id: '59', label: '5+' },
  { id: '60', label: '6-' },
  { id: '69', label: '6+' },
  { id: '70', label: '7-' },
  { id: '79', label: '7+' },
  { id: '80', label: '≥8' },
]

function isChecked(id: Cotation): boolean {
  return store.filters.cotations.includes(id)
}

function toggle(id: Cotation) {
  store.toggleCotation(id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div>
      &bull; Je veux des cotations dans le <br />
      <span class="italic text-base-300 text-sm">(5- = de 5a à 5b, 5+ = de 5b+ à 5c+)</span>
    </div>
    <div
      class="flex flex-row md:flex-col gap-3 items-center md:justify-center md:items-start ml-4 md:w-fit"
    >
      <div class="flex items-center h-16 md:h-full md:w-full w-3">
        <div class="h-full md:w-full bg-base-300 rounded-full md:h-1 w-1 relative">
          <div
            class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-1/2 bg-base-100 rounded-full w-6 h-6 border-2 border-base-300 flex items-center justify-center text-xs text-slate-600 font-bold"
          >
            ET
          </div>
        </div>
      </div>
      <div
        class="max-w-96 md:flex flex-row grid grid-cols-[auto_auto_auto_auto] gap-x-[10px] gap-y-2 md:justify-between md:w-full"
      >
        <label
          v-for="cot in cotations"
          :key="cot.id"
          class="label cursor-pointer md:flex-col gap-y-2 w-12 md:w-4 py-0"
        >
          <input
            type="checkbox"
            :checked="isChecked(cot.id)"
            class="checkbox checkbox-primary checkbox-sm"
            @change="toggle(cot.id)"
          />
          <span class="label-text">{{ cot.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
