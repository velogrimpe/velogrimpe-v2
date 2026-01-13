<script setup lang="ts">
import { computed } from 'vue'
import { useFiltersStore } from '@/stores'
import type { Exposition, Cotation } from '@/types'

const store = useFiltersStore()

// Exposition
const expositions: { id: Exposition; label: string; hint: string }[] = [
  { id: 'N', label: 'Nord', hint: '(NO, N, NE)' },
  { id: 'E', label: 'Est', hint: '(NE, E, SE)' },
  { id: 'S', label: 'Sud', hint: '(SE, S, SO)' },
  { id: 'O', label: 'Ouest', hint: '(SO, O, NO)' },
]

// Cotations (IDs match the PHP filter IDs)
const cotationGroups: { id: Cotation; label: string }[][] = [
  [{ id: '40', label: '4 et -' }],
  [{ id: '50', label: '5-' }, { id: '59', label: '5+' }],
  [{ id: '60', label: '6-' }, { id: '69', label: '6+' }],
  [{ id: '70', label: '7-' }, { id: '79', label: '7+' }],
  [{ id: '80', label: '8 et +' }],
]

// Type voies
const types = [
  { id: 'couenne' as const, label: 'Couenne' },
  { id: 'grandeVoie' as const, label: 'Grandes voies' },
  { id: 'bloc' as const, label: 'Bloc' },
  { id: 'psychobloc' as const, label: 'Psychobloc' },
]

// Train options
const trainTempsOptions = [
  { value: null, label: 'Pas de maximum' },
  { value: 60, label: 'Moins de 1h' },
  { value: 120, label: 'Moins de 2h' },
  { value: 180, label: 'Moins de 3h' },
  { value: 240, label: 'Moins de 4h' },
]

const correspOptions = [
  { value: null, label: 'Peu importe' },
  { value: 0, label: 'Direct' },
  { value: 1, label: '1 max' },
  { value: 2, label: '2 max' },
]

// Velo options
const veloTempsOptions = [
  { value: null, label: 'Pas de maximum' },
  { value: 30, label: "Moins de 30'" },
  { value: 60, label: "Moins de 1h" },
  { value: 90, label: "Moins de 1h30" },
]

const veloDistOptions = [
  { value: null, label: 'Pas de maximum' },
  { value: 10, label: 'Moins de 10km' },
  { value: 20, label: 'Moins de 20km' },
  { value: 30, label: 'Moins de 30km' },
]

const veloDenivOptions = [
  { value: null, label: 'Pas de maximum' },
  { value: 200, label: 'Moins de 200m' },
  { value: 400, label: 'Moins de 400m' },
  { value: 600, label: 'Moins de 600m' },
]

// Approche options
const approcheOptions = [
  { value: null, label: 'Pas de maximum' },
  { value: 10, label: "Moins de 10'" },
  { value: 20, label: "Moins de 20'" },
  { value: 30, label: "Moins de 30'" },
]

// Total options
const totalOptions = [
  { value: null, label: 'Pas de maximum' },
  { value: 120, label: 'Moins de 2h' },
  { value: 180, label: 'Moins de 3h' },
  { value: 240, label: 'Moins de 4h' },
  { value: 300, label: 'Moins de 5h' },
]

// Nb voies options
const nbVoiesOptions = [
  { value: 0, label: 'Pas de minimum' },
  { value: 20, label: 'Plus de 20' },
  { value: 50, label: 'Plus de 50' },
  { value: 100, label: 'Plus de 100' },
  { value: 200, label: 'Plus de 200' },
]

// Active filter indicators
const hasExpoFilter = computed(() => store.filters.exposition.length > 0)
const hasVoiesFilter = computed(() =>
  store.filters.cotations.length > 0 ||
  store.filters.typeVoies.couenne ||
  store.filters.typeVoies.grandeVoie ||
  store.filters.typeVoies.bloc ||
  store.filters.typeVoies.psychobloc ||
  store.filters.nbVoiesMin > 0
)
const hasTrainFilter = computed(() =>
  store.filters.train.tempsMax !== null ||
  store.filters.train.correspMax !== null ||
  store.filters.train.terOnly
)
const hasVeloFilter = computed(() =>
  store.filters.velo.tempsMax !== null ||
  store.filters.velo.distMax !== null ||
  store.filters.velo.denivMax !== null ||
  store.filters.velo.apiedPossible
)
const hasApprocheFilter = computed(() => store.filters.approche.tempsMax !== null)
const hasTotalFilter = computed(() =>
  store.filters.total.tempsTV !== null ||
  store.filters.total.tempsTVA !== null
)

function isExpoChecked(id: Exposition): boolean {
  return store.filters.exposition.includes(id)
}

function isCotChecked(id: Cotation): boolean {
  return store.filters.cotations.includes(id)
}

</script>

<template>
  <div class="flex flex-col md:flex-row gap-1 items-center w-full max-w-full justify-center flex-wrap">
    <div class="flex gap-1 items-center">
      <!-- Voies Dropdown -->
      <div class="dropdown w-fit">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasVoiesFilter }"
        >
          Voies 🧗‍♀️
        </div>
        <div class="dropdown-content menu gap-1 bg-base-200 rounded-box z-[1] m-1 w-64 p-2 shadow-lg" tabindex="1">
          <div class="flex flex-col gap-2">
            <div class="flex flex-col gap-3">
              <div><span class="font-bold">Cotations</span> (ex: 5+ ET 6+)</div>
              <div class="flex flex-col gap-1">
                <template v-for="group in cotationGroups" :key="group[0].id">
                  <div class="flex flex-row gap-4">
                    <label
                      v-for="cot in group"
                      :key="cot.id"
                      class="label hover:bg-base-300 rounded-lg cursor-pointer gap-2 p-0 pr-1"
                      :class="{ 'w-16 justify-start': group.length > 1 }"
                    >
                      <input
                        type="checkbox"
                        :checked="isCotChecked(cot.id)"
                        class="checkbox border-base-300 bg-base-100 [--chkbg:oklch(var(--p))] checkbox-sm"
                        @change="store.toggleCotation(cot.id)"
                      />
                      <span class="label-text">{{ cot.label }}</span>
                    </label>
                  </div>
                </template>
                <span class="italic text-base-300 text-sm">(5- = de 5a à 5b, 5+ = de 5b+ à 5c+)</span>
              </div>
            </div>
          </div>
          <div class="font-bold">Nombre de voies</div>
          <div>
            <label class="label cursor-pointer gap-2 p-0 pr-1 w-full justify-start">
              <select
                class="select border-base-300 select-sm focus:outline-base-300"
                :value="store.filters.nbVoiesMin"
                @change="store.setNbVoiesMin(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="opt in nbVoiesOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </label>
          </div>
          <div class="font-bold">Types de voies</div>
          <div class="grid grid-cols-[auto_auto] gap-x-2 gap-y-1 w-full">
            <div v-for="type in types" :key="type.id" class="flex flex-row gap-2 items-center w-full">
              <label class="label hover:bg-base-300 rounded-lg cursor-pointer gap-2 p-0 pr-1 w-full justify-start">
                <input
                  type="checkbox"
                  :checked="store.filters.typeVoies[type.id]"
                  class="checkbox border-base-300 bg-base-100 [--chkbg:oklch(var(--p))] checkbox-sm"
                  @change="store.setTypeVoie(type.id, !store.filters.typeVoies[type.id])"
                />
                <span class="label-text">{{ type.label }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Exposition Dropdown -->
      <div class="dropdown w-fit">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasExpoFilter }"
        >
          Exposition 🔅
        </div>
        <div class="dropdown-content menu bg-base-200 rounded-box z-[1] m-1 w-40 p-2 shadow-lg" tabindex="1">
          <div class="flex flex-row gap-1 items-center">
            <div class="max-w-96 flex flex-col gap-1 w-full">
              <label
                v-for="expo in expositions"
                :key="expo.id"
                class="label hover:bg-base-300 rounded-lg cursor-pointer gap-2 p-0 pr-1 w-full justify-start"
              >
                <input
                  type="checkbox"
                  :checked="isExpoChecked(expo.id)"
                  class="checkbox border-base-300 bg-base-100 [--chkbg:oklch(var(--p))] checkbox-sm"
                  @change="store.toggleExposition(expo.id)"
                />
                <span class="label-text">
                  {{ expo.label }}
                  <span class="text-xs text-slate-400">{{ expo.hint }}</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Train Dropdown -->
      <div class="dropdown w-fit">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasTrainFilter }"
        >
          Train 🚞
        </div>
        <div class="dropdown-content menu bg-base-200 rounded-box z-[1] m-1 w-52 p-2 shadow-lg" tabindex="1">
          <div class="flex flex-col gap-2">
            <div class="font-bold">Temps de trajet</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.train.tempsMax ?? ''"
              @change="store.setTrainTempsMax(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in trainTempsOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
            <div class="font-bold">Correspondances</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.train.correspMax ?? ''"
              @change="store.setTrainCorrespMax(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in correspOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
            <label class="label hover:bg-base-300 rounded-lg cursor-pointer gap-2 p-0 pr-1 justify-start">
              <input
                type="checkbox"
                :checked="store.filters.train.terOnly"
                class="checkbox border-base-300 bg-base-100 [--chkbg:oklch(var(--p))] checkbox-sm"
                @change="store.setTrainTerOnly(!store.filters.train.terOnly)"
              />
              <span class="label-text">TER uniquement</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-1 items-center">
      <!-- Velo Dropdown -->
      <div class="dropdown w-fit">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasVeloFilter }"
        >
          Vélo 🚲
        </div>
        <div class="dropdown-content menu bg-base-200 rounded-box z-[1] m-1 w-52 p-2 shadow-lg" tabindex="1">
          <div class="flex flex-col gap-2">
            <div class="font-bold">Temps de trajet</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.velo.tempsMax ?? ''"
              @change="store.setVeloTempsMax(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in veloTempsOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
            <div class="font-bold">Distance</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.velo.distMax ?? ''"
              @change="store.setVeloDistMax(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in veloDistOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
            <div class="font-bold">Dénivelé</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.velo.denivMax ?? ''"
              @change="store.setVeloDenivMax(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in veloDenivOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
            <label class="label hover:bg-base-300 rounded-lg cursor-pointer gap-2 p-0 pr-1 justify-start">
              <input
                type="checkbox"
                :checked="store.filters.velo.apiedPossible"
                class="checkbox border-base-300 bg-base-100 [--chkbg:oklch(var(--p))] checkbox-sm"
                @change="store.setVeloApiedPossible(!store.filters.velo.apiedPossible)"
              />
              <span class="label-text">Accès à pied possible</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Approche Dropdown -->
      <div class="dropdown w-fit">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasApprocheFilter }"
        >
          Marche 🥾
        </div>
        <div class="dropdown-content menu bg-base-200 rounded-box z-[1] m-1 w-48 p-2 shadow-lg" tabindex="1">
          <div class="flex flex-col gap-2">
            <div class="font-bold">Temps de marche</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.approche.tempsMax ?? ''"
              @change="store.setApprocheTempsMax(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in approcheOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Total Dropdown -->
      <div class="dropdown w-fit">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasTotalFilter }"
        >
          Total ⏱️
        </div>
        <div class="dropdown-content menu bg-base-200 rounded-box z-[1] m-1 w-52 p-2 shadow-lg" tabindex="1">
          <div class="flex flex-col gap-2">
            <div class="font-bold">Train + Vélo</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.total.tempsTV ?? ''"
              @change="store.setTotalTempsTV(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in totalOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
            <div class="font-bold">Train + Vélo + Approche</div>
            <select
              class="select border-base-300 select-sm focus:outline-base-300 w-full"
              :value="store.filters.total.tempsTVA ?? ''"
              @change="store.setTotalTempsTVA(($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option v-for="opt in totalOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Reset Button -->
      <button
        v-if="store.hasActiveFilters"
        type="button"
        class="btn btn-sm btn-ghost text-primary"
        @click="store.resetFilters()"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4C14.7486 4 17.1749 5.38626 18.6156 7.5H16V9.5H22V3.5H20V5.99936C18.1762 3.57166 15.2724 2 12 2C6.47715 2 2 6.47715 2 12H4C4 7.58172 7.58172 4 12 4ZM20 12C20 16.4183 16.4183 20 12 20C9.25144 20 6.82508 18.6137 5.38443 16.5H8V14.5H2V20.5H4V18.0006C5.82381 20.4283 8.72764 22 12 22C17.5228 22 22 17.5228 22 12H20Z"></path>
        </svg>
        Réinitialiser
      </button>
    </div>
  </div>
</template>
