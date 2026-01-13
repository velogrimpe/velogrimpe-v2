<script setup lang="ts">
import { useFiltersStore } from '@/stores'

const store = useFiltersStore()

const types = [
  { id: 'couenne' as const, label: 'Couenne' },
  { id: 'grandeVoie' as const, label: 'Grande Voie' },
  { id: 'bloc' as const, label: 'Bloc' },
  { id: 'psychobloc' as const, label: 'Psychobloc' },
]

function isChecked(id: keyof typeof store.filters.typeVoies): boolean {
  return store.filters.typeVoies[id]
}

function toggle(id: keyof typeof store.filters.typeVoies) {
  store.setTypeVoie(id, !store.filters.typeVoies[id])
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div>&bull; Pour faire :</div>
    <div class="flex flex-row gap-1 items-center ml-4">
      <div class="h-16 md:h-20 flex items-center w-3">
        <div class="h-full bg-base-300 rounded-full w-1 relative">
          <div
            class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-1/2 bg-base-100 rounded-full w-6 h-6 border-2 border-base-300 flex items-center justify-center text-xs text-slate-600 font-bold"
          >
            OU
          </div>
        </div>
      </div>
      <div class="max-w-96 grid grid-cols-[auto_auto] md:grid-cols-[auto] gap-x-2 gap-y-2 md:gap-y-1">
        <label
          v-for="type in types"
          :key="type.id"
          class="label cursor-pointer justify-start gap-x-2 py-0"
        >
          <input
            type="checkbox"
            :checked="isChecked(type.id)"
            class="checkbox checkbox-primary checkbox-sm"
            @change="toggle(type.id)"
          />
          <span class="label-text">{{ type.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
