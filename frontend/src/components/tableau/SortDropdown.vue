<script setup lang="ts">
import { useTableauStore } from '@/stores'
import type { SortKey, SortDir } from '@/types/tableau'

const store = useTableauStore()

interface SortOption {
  key: SortKey
  dir: SortDir
  label: string
}

const sortOptions: SortOption[] = [
  { key: 'total', dir: 'asc', label: 'Temps total' },
  { key: 'total', dir: 'desc', label: 'Temps total' },
  { key: 'train', dir: 'asc', label: 'Temps Train' },
  { key: 'train', dir: 'desc', label: 'Temps Train' },
  { key: 'velo', dir: 'asc', label: 'Temps Velo' },
  { key: 'velo', dir: 'desc', label: 'Temps Velo' },
  { key: 'voies', dir: 'asc', label: 'Nb voies' },
  { key: 'voies', dir: 'desc', label: 'Nb voies' },
  { key: 'approche', dir: 'asc', label: 'Approche' },
  { key: 'approche', dir: 'desc', label: 'Approche' },
]

function isActive(opt: SortOption): boolean {
  return store.sort.key === opt.key && store.sort.dir === opt.dir
}

function handleSort(opt: SortOption) {
  store.setSort(opt.key, opt.dir)
}
</script>

<template>
  <div class="dropdown dropdown-end w-fit">
    <div tabindex="0" role="button" class="btn btn-sm text-nowrap focus:pointer-events-none">
      Tri
    </div>
    <div class="dropdown-content menu bg-base-200 rounded-box z-1 m-1 w-48 p-2 shadow-lg items-start" tabindex="1">
      <div class="font-bold">Trier par</div>
      <hr class="w-1/2 bg-base-300 mb-1 mt-2 mx-auto" />
      <ul>
        <li v-for="opt in sortOptions" :key="`${opt.key}-${opt.dir}`">
          <a
            class="p-1 justify-start"
            :class="{
              'font-bold text-primary': isActive(opt),
              'font-normal text-base-content': !isActive(opt)
            }"
            @click="handleSort(opt)"
          >
            {{ opt.label }} {{ opt.dir === 'asc' ? '&nearr;' : '&searr;' }}
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>
