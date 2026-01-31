<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useFiltersStore } from "@/stores";
import type { Exposition, Cotation, Ville } from "@/types";
import Icon from "@/components/shared/Icon.vue";
import SearchAutocomplete from "./SearchAutocomplete.vue";
import type { SearchItem } from "./SearchAutocomplete.vue";

const props = defineProps<{
  falaises: Array<{ falaise_id: number; falaise_nom: string }>;
  gares: Array<{ gare_id: number; gare_nom: string }>;
  villes: Ville[];
}>();

const store = useFiltersStore();

// Fix dropdown positioning for overflow containers
// When a dropdown trigger gets focus, we position its content with fixed positioning
function handleDropdownFocus(event: FocusEvent) {
  const trigger = event.target as HTMLElement;
  if (!trigger.matches('[role="button"][tabindex="0"]')) return;

  const dropdown = trigger.closest(".dropdown");
  if (!dropdown) return;

  const content = dropdown.querySelector(
    ".dropdown-content",
  ) as HTMLElement | null;
  if (!content) return;

  // Calculate position relative to viewport
  const rect = trigger.getBoundingClientRect();
  const isMobile = window.innerWidth < 768;

  content.style.position = "fixed";
  content.style.top = `${rect.bottom + 6}px`;
  content.style.left = "auto";

  if (isMobile) {
    // On mobile: always align to the right edge with a small margin
    content.style.right = "34px";
  } else {
    // On desktop: align to the right edge of the trigger button
    content.style.right = `${window.innerWidth - rect.right}px`;
  }
}

// Filters expanded state - expanded by default on desktop
const isDesktop = () => window.innerWidth >= 768;
const isFiltersExpanded = ref(isDesktop());

onMounted(() => {
  document.addEventListener("focusin", handleDropdownFocus);
});

onUnmounted(() => {
  document.removeEventListener("focusin", handleDropdownFocus);
});

function expandFilters() {
  isFiltersExpanded.value = true;
}

function collapseFilters() {
  isFiltersExpanded.value = false;
}

// Search state
const isSearchExpanded = ref(false);

function expandSearch() {
  isSearchExpanded.value = true;
}

function collapseSearch() {
  isSearchExpanded.value = false;
}

function onSearchSelect(_item: SearchItem) {
  collapseSearch();
}

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

// Nb voies options
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
const hasVilleFilter = computed(() => store.filters.villeId !== null);

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
  <div class="leaflet-filters-control flex flex-col max-w-[80vw]">
    <!-- Filters row - collapsible -->
    <div class="flex items-center gap-1 justify-end max-w-full">
      <button
        v-if="!isFiltersExpanded"
        type="button"
        class="btn btn-sm md:btn-md max-md:btn-square shadow-md border-0"
        :class="store.hasActiveFilters ? 'btn-primary' : 'bg-base-100'"
        title="Filtrer les falaises"
        @click="expandFilters"
      >
        <span class="hidden md:inline">Filtres</span
        ><Icon name="filter" class="w-4 h-4 stroke-2" />
      </button>
      <template v-else>
        <!-- Scrollable filters container -->
        <div class="flex flex-nowrap gap-1 overflow-x-auto snap-x noscrollbar">
          <!-- Ville Dropdown -->
          <div class="dropdown dropdown-end w-fit shrink-0 snap-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm md:btn-md text-nowrap focus:pointer-events-none shadow-md border-0"
              :class="hasVilleFilter ? 'btn-primary' : 'bg-base-100'"
            >
              Ville 🏙️
            </div>
            <div
              class="dropdown-content menu bg-base-200 rounded-box z-[1001] m-1 w-56 p-2 shadow-lg"
              tabindex="1"
            >
              <div class="flex flex-col gap-2">
                <div class="font-bold">Ville de départ</div>
                <select
                  class="select select-sm border-base-300 focus:outline-base-300 w-full"
                  :value="store.filters.villeId ?? ''"
                  @change="
                    store.setVilleId(
                      ($event.target as HTMLSelectElement).value || null,
                    )
                  "
                >
                  <option value="">Toutes les villes</option>
                  <option
                    v-for="ville in props.villes"
                    :key="ville.ville_id"
                    :value="ville.ville_id"
                  >
                    {{ ville.ville_nom }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Voies Dropdown -->
          <div class="dropdown dropdown-end w-fit shrink-0 snap-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm md:btn-md text-nowrap focus:pointer-events-none shadow-md border-0"
              :class="hasVoiesFilter ? 'btn-primary' : 'bg-base-100'"
            >
              Voies 🧗‍♀️
            </div>
            <div
              class="dropdown-content menu gap-1 bg-base-200 rounded-box z-[1001] m-1 w-64 p-2 shadow-lg"
              tabindex="1"
            >
              <div class="flex flex-col gap-2">
                <div class="flex flex-col gap-3">
                  <div>
                    <span class="font-bold">Cotations</span> (ex: 5+ ET 6+)
                  </div>
                  <div class="flex flex-col gap-1">
                    <template
                      v-for="group in cotationGroups"
                      :key="group[0].id"
                    >
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
          <div class="dropdown dropdown-end w-fit shrink-0 snap-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm md:btn-md text-nowrap focus:pointer-events-none shadow-md border-0"
              :class="hasExpoFilter ? 'btn-primary' : 'bg-base-100'"
            >
              Exposition 🔅
            </div>
            <div
              class="dropdown-content menu bg-base-200 rounded-box z-[1001] m-1 w-40 p-2 shadow-lg"
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
                      <span class="text-xs text-slate-400">{{
                        expo.hint
                      }}</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Train Dropdown -->
          <div class="dropdown w-fit dropdown-end shrink-0 snap-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm md:btn-md text-nowrap focus:pointer-events-none shadow-md border-0"
              :class="{
                'btn-primary': hasTrainFilter,
                'bg-base-100': !hasTrainFilter && hasVilleFilter,
                'bg-base-200 opacity-50': !hasVilleFilter,
              }"
              :title="
                hasVilleFilter
                  ? 'Filtrer par train'
                  : 'Sélectionnez une ville pour filtrer par train'
              "
            >
              Train 🚞
            </div>
            <div
              v-if="hasVilleFilter"
              class="dropdown-content menu bg-base-200 rounded-box z-[1001] m-1 w-64 p-2 shadow-lg"
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
                      parseNumberInput(
                        ($event.target as HTMLInputElement).value,
                      ),
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
                    @change="
                      store.setTrainTerOnly(!store.filters.train.terOnly)
                    "
                  />
                  <span class="label-text text-sm">TER uniquement</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Velo Dropdown -->
          <div class="dropdown w-fit dropdown-end shrink-0 snap-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm md:btn-md text-nowrap focus:pointer-events-none shadow-md border-0"
              :class="hasVeloFilter ? 'btn-primary' : 'bg-base-100'"
            >
              Vélo 🚲
            </div>
            <div
              class="dropdown-content menu bg-base-200 rounded-box z-[1001] m-1 w-64 p-2 shadow-lg"
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
                      store.setVeloApiedPossible(
                        !store.filters.velo.apiedPossible,
                      )
                    "
                  />
                  <div>Accessible à pied</div>
                </label>
              </div>
            </div>
          </div>

          <!-- Approche Dropdown -->
          <div class="dropdown w-fit dropdown-end shrink-0 snap-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm md:btn-md text-nowrap focus:pointer-events-none shadow-md border-0"
              :class="hasApprocheFilter ? 'btn-primary' : 'bg-base-100'"
            >
              Marche 🥾
            </div>
            <div
              class="dropdown-content menu bg-base-200 rounded-box z-[1001] m-1 w-56 p-2 shadow-lg"
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
                      parseNumberInput(
                        ($event.target as HTMLInputElement).value,
                      ),
                    )
                  "
                />
                <div>minutes</div>
              </label>
            </div>
          </div>

          <!-- Total Dropdown -->
          <div class="dropdown w-fit dropdown-end shrink-0 snap-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm md:btn-md text-nowrap focus:pointer-events-none shadow-md border-0"
              :class="{
                'btn-primary': hasTotalFilter,
                'bg-base-100': !hasTotalFilter && hasVilleFilter,
                'bg-base-200 opacity-50': !hasVilleFilter,
              }"
              :title="
                hasVilleFilter
                  ? 'Filtrer par temps total'
                  : 'Sélectionnez une ville pour filtrer par temps total'
              "
            >
              Total ⏱️
            </div>
            <div
              v-if="hasVilleFilter"
              class="dropdown-content menu bg-base-200 rounded-box z-[1001] m-1 p-2 shadow-lg"
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
                        parseNumberInput(
                          ($event.target as HTMLInputElement).value,
                        ),
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
                        parseNumberInput(
                          ($event.target as HTMLInputElement).value,
                        ),
                      )
                    "
                  />
                  <div>minutes</div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Fixed buttons outside scroll container -->
        <button
          type="button"
          class="btn btn-sm md:btn-md btn-square bg-base-100 shadow-md border-0 shrink-0"
          :disabled="!store.hasActiveFilters"
          title="Réinitialiser les filtres"
          @click="store.resetFilters()"
        >
          <Icon name="refresh" class="w-3 h-3 stroke-2" />
        </button>

        <button
          type="button"
          class="btn btn-sm md:btn-md max-md:btn-square bg-base-100 shadow-md border-0 shrink-0"
          title="Fermer les filtres"
          @click="collapseFilters"
        >
          <span class="hidden md:inline">Filtres</span
          ><Icon name="close" class="w-4 h-4 stroke-2" />
        </button>
      </template>
    </div>

    <!-- Search row - collapsible -->
    <div class="flex items-center gap-1 justify-end mt-2.5">
      <button
        v-if="!isSearchExpanded"
        type="button"
        class="btn btn-sm md:btn-md max-md:btn-square bg-base-100 shadow-md border-0"
        title="Rechercher une falaise ou une gare"
        @click="expandSearch"
      >
        <span class="hidden md:inline">Rechercher</span
        ><Icon name="search" class="w-4 h-4 stroke-2" />
      </button>
      <template v-else>
        <div
          class="flex items-center gap-1 bg-base-100 rounded-lg shadow-md p-1"
        >
          <div class="flex-1 min-w-48">
            <SearchAutocomplete
              :falaises="props.falaises"
              :gares="props.gares"
              @select="onSearchSelect"
            />
          </div>
          <button
            type="button"
            class="btn btn-sm md:btn-md btn-ghost"
            title="Fermer la recherche"
            @click="collapseSearch"
          >
            <Icon name="close" class="w-4 h-4 stroke-2" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.noscrollbar::-webkit-scrollbar {
  display: none;
}
.noscrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.leaflet-filters-control {
  pointer-events: auto;
}

.leaflet-filters-control :deep(.dropdown-content) {
  z-index: 1001;
  margin-right: 20px;
}

.leaflet-filters-control :deep(.autocomplete-list) {
  z-index: 1002;
}

/* Ensure dropdown content doesn't get cut off on mobile */
@media (max-width: 768px) {
  .leaflet-filters-control :deep(.dropdown-content) {
    max-height: 60vh;
    overflow-y: auto;
  }
}
</style>
