<script setup lang="ts">
import { useFiltersStore } from '@/stores'
import type { Exposition } from '@/types'

const store = useFiltersStore()

const expositions: { id: Exposition; label: string; hint: string }[] = [
  { id: 'N', label: 'Nord', hint: '(NO, N, NE)' },
  { id: 'E', label: 'Est', hint: '(NE, E, SE)' },
  { id: 'S', label: 'Sud', hint: '(SE, S, SO)' },
  { id: 'O', label: 'Ouest', hint: '(SO, O, NO)' },
]

function isChecked(id: Exposition): boolean {
  return store.filters.exposition.includes(id)
}

function toggle(id: Exposition) {
  store.toggleExposition(id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div>&bull; Je veux une falaise exposée</div>
    <div class="flex flex-row gap-1 items-center ml-4">
      <div class="h-20 flex items-center w-3">
        <div class="h-full bg-base-300 rounded-full w-1 relative">
          <div
            class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-1/2 bg-base-100 rounded-full w-6 h-6 border-2 border-base-300 flex items-center justify-center text-xs text-slate-600 font-bold"
          >
            OU
          </div>
        </div>
      </div>
      <div class="max-w-96 grid grid-cols-[auto_auto] md:grid-cols-[auto] gap-x-2 md:gap-y-1">
        <label
          v-for="expo in expositions"
          :key="expo.id"
          class="label cursor-pointer justify-start gap-x-2 py-0"
        >
          <input
            type="checkbox"
            :checked="isChecked(expo.id)"
            class="checkbox checkbox-primary checkbox-sm"
            @change="toggle(expo.id)"
          />
          <span class="label-text">
            {{ expo.label }}
            <br class="md:hidden" />
            <span class="text-xs text-slate-400">{{ expo.hint }}</span>
          </span>
        </label>
      </div>
    </div>
  </div>
</template>
