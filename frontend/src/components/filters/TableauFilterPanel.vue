<script setup lang="ts">
import { computed } from "vue";
import { useFiltersStore } from "@/stores";
import type { Exposition, Cotation } from "@/types";
import SortDropdown from "@/components/tableau/SortDropdown.vue";
import Icon from "@/components/shared/Icon.vue";

const store = useFiltersStore();

// Exposition
const expositions: { id: Exposition; label: string; hint: string }[] = [
  { id: "N", label: "Nord", hint: "(NO, N, NE)" },
  { id: "E", label: "Est", hint: "(NE, E, SE)" },
  { id: "S", label: "Sud", hint: "(SE, S, SO)" },
  { id: "O", label: "Ouest", hint: "(SO, O, NO)" },
];

// Cotations (IDs match the PHP filter IDs)
const cotationGroups: { id: Cotation; label: string }[][] = [
  [{ id: "40", label: "4 et -" }],
  [
    { id: "50", label: "5-" },
    { id: "59", label: "5+" },
  ],
  [
    { id: "60", label: "6-" },
    { id: "69", label: "6+" },
  ],
  [
    { id: "70", label: "7-" },
    { id: "79", label: "7+" },
  ],
  [{ id: "80", label: "8 et +" }],
];

// Type voies
const types = [
  { id: "couenne" as const, label: "Couenne" },
  { id: "grandeVoie" as const, label: "Grandes voies" },
  { id: "bloc" as const, label: "Bloc" },
  { id: "psychobloc" as const, label: "Psychobloc" },
];

// Nb voies options (keep as select)
const nbVoiesOptions = [
  { value: 0, label: "Pas de minimum" },
  { value: 20, label: "Plus de 20" },
  { value: 50, label: "Plus de 50" },
  { value: 100, label: "Plus de 100" },
  { value: 200, label: "Plus de 200" },
];

// Active filter indicators
const hasExpoFilter = computed(() => store.filters.exposition.length > 0);
const hasVoiesFilter = computed(
  () =>
    store.filters.cotations.length > 0 ||
    store.filters.typeVoies.couenne ||
    store.filters.typeVoies.grandeVoie ||
    store.filters.typeVoies.bloc ||
    store.filters.typeVoies.psychobloc ||
    store.filters.nbVoiesMin > 0,
);
const hasTrainFilter = computed(
  () =>
    store.filters.train.tempsMax !== null ||
    store.filters.train.correspMax !== null ||
    store.filters.train.terOnly,
);
const hasVeloFilter = computed(
  () =>
    store.filters.velo.tempsMax !== null ||
    store.filters.velo.distMax !== null ||
    store.filters.velo.denivMax !== null ||
    store.filters.velo.apiedPossible,
);
const hasApprocheFilter = computed(
  () => store.filters.approche.tempsMax !== null,
);
const hasTotalFilter = computed(
  () =>
    store.filters.total.tempsTV !== null ||
    store.filters.total.tempsTVA !== null,
);

function isExpoChecked(id: Exposition): boolean {
  return store.filters.exposition.includes(id);
}

function isCotChecked(id: Cotation): boolean {
  return store.filters.cotations.includes(id);
}

// Helper to parse number input (empty string -> null)
function parseNumberInput(value: string): number | null {
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}
</script>

<template>
  <div
    class="flex flex-col md:flex-row gap-1 items-center w-full max-w-full justify-center flex-wrap"
  >
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
        <div
          class="dropdown-content menu gap-1 bg-base-200 rounded-box z-1 m-1 w-64 p-2 shadow-lg"
          tabindex="1"
        >
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
                        class="checkbox checkbox-primary checkbox-sm"
                        @change="store.toggleCotation(cot.id)"
                      />
                      <span class="label-text">{{ cot.label }}</span>
                    </label>
                  </div>
                </template>
                <span class="italic text-base-300 text-sm"
                  >(5- = de 5a à 5b, 5+ = de 5b+ à 5c+)</span
                >
              </div>
            </div>
          </div>
          <div class="font-bold">Nombre de voies</div>
          <div>
            <label
              class="label cursor-pointer gap-2 p-0 pr-1 w-full justify-start"
            >
              <select
                class="select border-base-300 select-sm focus:outline-base-300"
                :value="store.filters.nbVoiesMin"
                @change="
                  store.setNbVoiesMin(
                    Number(($event.target as HTMLSelectElement).value),
                  )
                "
              >
                <option
                  v-for="opt in nbVoiesOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </label>
          </div>
          <div class="font-bold">Types de voies</div>
          <div class="grid grid-cols-[auto_auto] gap-x-2 gap-y-1 w-full">
            <div
              v-for="type in types"
              :key="type.id"
              class="flex flex-row gap-2 items-center w-full"
            >
              <label
                class="label hover:bg-base-300 rounded-lg cursor-pointer gap-2 p-0 pr-1 w-full justify-start"
              >
                <input
                  type="checkbox"
                  :checked="store.filters.typeVoies[type.id]"
                  class="checkbox checkbox-primary checkbox-sm"
                  @change="
                    store.setTypeVoie(
                      type.id,
                      !store.filters.typeVoies[type.id],
                    )
                  "
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
        <div
          class="dropdown-content menu bg-base-200 rounded-box z-1 m-1 w-40 p-2 shadow-lg"
          tabindex="1"
        >
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
                  class="checkbox checkbox-primary checkbox-sm"
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
      <div class="dropdown w-fit dropdown-end">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasTrainFilter }"
        >
          Train 🚞
        </div>
        <div
          class="dropdown-content menu bg-base-200 rounded-box z-1 m-1 w-64 p-2 shadow-lg"
          tabindex="1"
        >
          <label class="flex flex-row gap-2 items-center">
            <div class="font-bold">Durée</div>
            <div class="text-normal font-bold">≤</div>
            <input
              type="number"
              step="1"
              min="0"
              class="input input-sm w-14"
              :value="store.filters.train.tempsMax ?? ''"
              @input="
                store.setTrainTempsMax(
                  parseNumberInput(($event.target as HTMLInputElement).value),
                )
              "
            />
            <div>minutes</div>
          </label>
          <div class="flex flex-row items-center gap-1 mt-2">
            <div>Nb. Corresp. Max</div>
            <div class="flex flex-row gap-2 items-center">
              <label class="label cursor-pointer gap-1">
                <input
                  type="radio"
                  name="nbCorrespMax"
                  value="0"
                  class="radio radio-primary radio-xs"
                  :checked="store.filters.train.correspMax === 0"
                  @change="store.setTrainCorrespMax(0)"
                />
                <span class="label-text">0</span>
              </label>
              <label class="label cursor-pointer gap-1">
                <input
                  type="radio"
                  name="nbCorrespMax"
                  value="1"
                  class="radio radio-primary radio-xs"
                  :checked="store.filters.train.correspMax === 1"
                  @change="store.setTrainCorrespMax(1)"
                />
                <span class="label-text">≤1</span>
              </label>
              <button
                v-if="store.filters.train.correspMax !== null"
                type="button"
                class="btn btn-ghost btn-xs p-0"
                title="Réinitialiser"
                @click="store.setTrainCorrespMax(null)"
              >
                ✕
              </button>
            </div>
          </div>
          <div class="divider my-1"></div>
          <label class="form-control cursor-pointer">
            <div class="label gap-2 p-0 justify-start">
              <span class="label-text text-sm">TGV OK</span>
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                :checked="store.filters.train.terOnly"
                @change="store.setTrainTerOnly(!store.filters.train.terOnly)"
              />
              <span class="label-text text-sm">TER uniquement</span>
            </div>
          </label>
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
        <div
          class="dropdown-content menu bg-base-200 rounded-box z-1 m-1 w-64 p-2 shadow-lg"
          tabindex="1"
        >
          <div class="flex flex-row gap-3 items-center">
            <div>Trajet vélo</div>
            <div class="flex flex-col gap-1">
              <label class="flex flex-row gap-2 flex-wrap items-center">
                <div class="text-normal font-bold">≤</div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  class="input input-sm w-14"
                  :value="store.filters.velo.tempsMax ?? ''"
                  @input="
                    store.setVeloTempsMax(
                      parseNumberInput(
                        ($event.target as HTMLInputElement).value,
                      ),
                    )
                  "
                />
                <div>minutes</div>
              </label>
              <label class="flex flex-row gap-2 items-center">
                <div class="text-normal font-bold">≤</div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  class="input input-sm w-14"
                  :value="store.filters.velo.distMax ?? ''"
                  @input="
                    store.setVeloDistMax(
                      parseNumberInput(
                        ($event.target as HTMLInputElement).value,
                      ),
                    )
                  "
                />
                <div>km</div>
              </label>
              <label class="flex flex-row gap-2 items-center">
                <div class="text-normal font-bold">≤</div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  class="input input-sm w-14"
                  :value="store.filters.velo.denivMax ?? ''"
                  @input="
                    store.setVeloDenivMax(
                      parseNumberInput(
                        ($event.target as HTMLInputElement).value,
                      ),
                    )
                  "
                />
                <div>D+</div>
              </label>
            </div>
          </div>
          <div class="flex flex-row gap-2 items-center mt-2">
            <div
              class="bg-base-100 rounded-full w-6 h-6 border-2 border-base-300 flex items-center justify-center text-xs text-slate-600 font-bold"
            >
              OU
            </div>
            <label
              class="flex flex-row gap-2 items-center hover:bg-base-300 rounded-lg cursor-pointer p-0 pr-1"
            >
              <input
                type="checkbox"
                :checked="store.filters.velo.apiedPossible"
                class="checkbox border-base-300 bg-base-100"
                @change="
                  store.setVeloApiedPossible(!store.filters.velo.apiedPossible)
                "
              />
              <div>Accessible à pied</div>
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
        <div
          class="dropdown-content menu bg-base-200 rounded-box z-1 m-1 w-56 p-2 shadow-lg"
          tabindex="1"
        >
          <label class="flex flex-row gap-2 items-center">
            <div class="font-bold">Approche</div>
            <div class="text-normal font-bold">≤</div>
            <input
              type="number"
              step="1"
              min="0"
              class="input input-sm w-14"
              :value="store.filters.approche.tempsMax ?? ''"
              @input="
                store.setApprocheTempsMax(
                  parseNumberInput(($event.target as HTMLInputElement).value),
                )
              "
            />
            <div>minutes</div>
          </label>
        </div>
      </div>

      <!-- Total Dropdown -->
      <div class="dropdown w-fit dropdown-end">
        <div
          tabindex="0"
          role="button"
          class="btn btn-sm text-nowrap focus:pointer-events-none"
          :class="{ 'btn-primary': hasTotalFilter }"
        >
          Total ⏱️
        </div>
        <div
          class="dropdown-content menu bg-base-200 rounded-box z-1 m-1 p-2 shadow-lg"
          tabindex="1"
        >
          <div class="flex flex-col gap-2 items-end">
            <label class="flex flex-row gap-1 items-center">
              <div>Train+Vélo</div>
              <div class="text-normal font-bold">≤</div>
              <input
                type="number"
                step="1"
                min="0"
                class="input input-sm w-14"
                :value="store.filters.total.tempsTV ?? ''"
                @input="
                  store.setTotalTempsTV(
                    parseNumberInput(($event.target as HTMLInputElement).value),
                  )
                "
              />
              <div>minutes</div>
            </label>
            <label class="flex flex-row gap-1 items-center">
              <div>Train+Vélo+Approche</div>
              <div class="text-normal font-bold">≤</div>
              <input
                type="number"
                step="1"
                min="0"
                class="input input-sm w-14"
                :value="store.filters.total.tempsTVA ?? ''"
                @input="
                  store.setTotalTempsTVA(
                    parseNumberInput(($event.target as HTMLInputElement).value),
                  )
                "
              />
              <div>minutes</div>
            </label>
          </div>
        </div>
      </div>

      <!-- Reset Button -->
      <button
        type="button"
        class="btn btn-sm btn-ghost text-primary"
        :disabled="!store.hasActiveFilters"
        @click="store.resetFilters()"
      >
        <Icon name="refresh" class="w-3 h-3" />
      </button>

      <!-- Sort Dropdown -->
      <SortDropdown />
    </div>
  </div>
</template>
