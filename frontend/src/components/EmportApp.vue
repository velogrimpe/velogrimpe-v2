<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Icon from "@/components/shared/Icon.vue";
import type { EmportRow, EmportCategory } from "@/types/emport";

const isLoading = ref(true);
const error = ref<string | null>(null);
const allRows = ref<EmportRow[]>([]);

const selectedCategory = ref<EmportCategory>("all");
const selectedSub = ref<string[]>([]);

// Reset sub-filters when category changes
watch(selectedCategory, () => {
  selectedSub.value = [];
  selectedSubMobile.value = "";
});

onMounted(async () => {
  try {
    const res = await fetch("/api/fetch_emport.php");
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? "Erreur API");
    allRows.value = json.data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Erreur inconnue";
  } finally {
    isLoading.value = false;
  }
});

function getCategory(typeTrain: string): "GV" | "Intercité" | "Régional" {
  if (typeTrain === "GRANDE VITESSE") return "GV";
  if (typeTrain === "INTERCITÉS") return "Intercité";
  return "Régional";
}

function typeLabel(typeTrain: string): string {
  if (typeTrain === "GRANDE VITESSE") return "Grande vitesse";
  if (typeTrain === "INTERCITÉS") return "Interrégionaux";
  return "Régional / TER";
}

function typeBgClass(typeTrain: string): string {
  const cat = getCategory(typeTrain);
  if (cat === "GV") return "bg-violet-300/10";
  if (cat === "Intercité") return "bg-amber-300/10";
  return "bg-emerald-300/10";
}

// Sous-options disponibles pour le 2e select (compagnies GV, lignes Intercité, régions TER)
// Ordre préservé depuis l'API (pas de tri alphabétique)
const availableSubOptions = computed(() => {
  const cat = selectedCategory.value;
  if (cat === "all") return [];
  const seen = new Set<string>();
  const opts: string[] = [];
  for (const row of allRows.value) {
    if (
      getCategory(row.type_train) === cat &&
      !seen.has(row.compagnie_region)
    ) {
      seen.add(row.compagnie_region);
      opts.push(row.compagnie_region);
    }
  }
  return opts;
});

// Label du 2e select
const subSelectLabel = computed(() => {
  if (selectedCategory.value === "GV") return "Compagnie";
  if (selectedCategory.value === "Intercité") return "Ligne";
  return "Région";
});

// Label du dropdown multi-select (desktop)
const subDropdownLabel = computed(() => {
  const cat = selectedCategory.value;
  const allLabel =
    cat === "GV"
      ? "toutes compagnies"
      : cat === "Intercité"
        ? "toutes lignes"
        : "toutes régions";
  if (
    selectedSub.value.length === 0 ||
    selectedSub.value.length === availableSubOptions.value.length
  )
    return allLabel;
  if (selectedSub.value.length <= 2)
    return selectedSub.value.map(firstLine).join(", ");
  return `${selectedSub.value.length} sélectionnés`;
});

// Mobile : valeur unique du 2e select
const selectedSubMobile = ref("");

watch(selectedSubMobile, (val) => {
  selectedSub.value = val ? [val] : [];
});

// Lignes filtrées
const filteredRows = computed(() => {
  if (selectedCategory.value === "all") return allRows.value;
  return allRows.value.filter((r) => {
    const cat = getCategory(r.type_train);
    if (cat !== selectedCategory.value) return false;
    if (selectedSub.value.length > 0) {
      if (!selectedSub.value.includes(r.compagnie_region)) return false;
    }
    return true;
  });
});

// Desktop : lignes avec info de rowspan pour fusionner la colonne Type
interface DesktopRow extends EmportRow {
  isFirstInGroup: boolean;
  rowspan: number;
}

const desktopTableRows = computed<DesktopRow[]>(() => {
  const rows = filteredRows.value;
  const result: DesktopRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const typeTrain = rows[i].type_train;
    let count = 1;
    while (
      i + count < rows.length &&
      rows[i + count].type_train === typeTrain
    ) {
      count++;
    }
    for (let j = 0; j < count; j++) {
      result.push({
        ...rows[i + j],
        isFirstInGroup: j === 0,
        rowspan: count,
      });
    }
    i += count;
  }
  return result;
});

// Mobile : prêt à afficher ? (les deux niveaux de filtre sont requis)
const mobileReady = computed(() => {
  return selectedCategory.value !== "all" && selectedSubMobile.value !== "";
});

function isUrl(s: string | null): boolean {
  return !!s && s.startsWith("http");
}

function hasMultipleSources(row: EmportRow): boolean {
  return !!(row.source1 && row.source2);
}

// Première ligne d'une chaîne (pour les libellés de filtre)
function firstLine(s: string): string {
  return s.split("\n")[0];
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <div v-else class="rounded-lg p-4 shadow bg-base-200 not-prose">
      <!-- ===== FILTRE DESKTOP (phrase à trous) ===== -->
      <div
        class="hidden md:flex mb-2 font-bold items-center gap-2 text-base flex-wrap"
      >
        <span>Je vais prendre un train</span>
        <select
          v-model="selectedCategory"
          class="select select-bordered w-content"
        >
          <option value="all">(choisir un type de train)</option>
          <option value="GV">Grande vitesse</option>
          <option value="Intercité">Trains type Intercités</option>
          <option value="Régional">Régional / TER</option>
        </select>
        <template v-if="selectedCategory === 'GV'">
          <span>via</span>
          <details class="dropdown">
            <summary
              class="select select-bordered flex items-center cursor-pointer font-bold"
            >
              {{ subDropdownLabel }}
            </summary>
            <div
              class="dropdown-content z-[1] bg-base-100 rounded-box shadow-lg p-2 w-64 mt-1"
            >
              <label
                v-for="opt in availableSubOptions"
                :key="opt"
                class="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-base-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="opt"
                  v-model="selectedSub"
                  class="checkbox checkbox-sm"
                />
                <span class="text-sm font-normal">{{ firstLine(opt) }}</span>
              </label>
            </div>
          </details>
        </template>
        <template v-if="selectedCategory === 'Intercité'">
          <span>ligne</span>
          <details class="dropdown">
            <summary
              class="select select-bordered flex items-center cursor-pointer font-bold"
            >
              {{ subDropdownLabel }}
            </summary>
            <div
              class="dropdown-content z-[1] bg-base-100 rounded-box shadow-lg p-2 w-64 mt-1"
            >
              <label
                v-for="opt in availableSubOptions"
                :key="opt"
                class="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-base-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="opt"
                  v-model="selectedSub"
                  class="checkbox checkbox-sm"
                />
                <span class="text-sm font-normal">{{ firstLine(opt) }}</span>
              </label>
            </div>
          </details>
        </template>
        <template v-if="selectedCategory === 'Régional'">
          <span>en région</span>
          <details class="dropdown">
            <summary
              class="select select-bordered flex items-center cursor-pointer font-bold"
            >
              {{ subDropdownLabel }}
            </summary>
            <div
              class="dropdown-content z-[1] bg-base-100 rounded-box shadow-lg p-2 w-64 mt-1"
            >
              <label
                v-for="opt in availableSubOptions"
                :key="opt"
                class="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-base-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="opt"
                  v-model="selectedSub"
                  class="checkbox checkbox-sm"
                />
                <span class="text-sm font-normal">{{ firstLine(opt) }}</span>
              </label>
            </div>
          </details>
        </template>
        <button
          v-if="selectedCategory !== 'all'"
          class="btn btn-ghost btn-square ml-2"
          @click="selectedCategory = 'all'"
        >
          <Icon name="x-circle" class="h-8 w-8" />
        </button>
      </div>

      <!-- ===== FILTRES MOBILE (deux selects) ===== -->
      <div class="md:hidden flex flex-col gap-3 mb-6">
        <label class="form-control w-full">
          <div class="label">
            <span class="label-text font-medium">Type de train</span>
          </div>
          <select
            v-model="selectedCategory"
            class="select select-bordered w-full"
          >
            <option value="all" disabled>Choisir un type</option>
            <option value="GV">Grande vitesse</option>
            <option value="Intercité">Interrégionaux</option>
            <option value="Régional">Régional / TER</option>
          </select>
        </label>

        <label v-if="selectedCategory !== 'all'" class="form-control w-full">
          <div class="label">
            <span class="label-text font-medium">{{ subSelectLabel }}</span>
          </div>
          <select
            v-model="selectedSubMobile"
            class="select select-bordered w-full"
          >
            <option value="" disabled>Choisir</option>
            <option v-for="opt in availableSubOptions" :key="opt" :value="opt">
              {{ firstLine(opt) }}
            </option>
          </select>
        </label>
      </div>

      <!-- ===== VUE MOBILE (cards) ===== -->
      <div class="md:hidden">
        <div v-if="!mobileReady"></div>
        <div v-else class="flex flex-col gap-4">
          <div v-for="row in filteredRows" :key="row.emport_id">
            <div class="flex flex-col gap-4">
              <div
                v-if="row.regle_demonte"
                class="border rounded-md border-base-content/20 overflow-hidden"
              >
                <div
                  class="w-full p-2 border-b border-base-content/20 text-xs font-semibold text-primary uppercase"
                >
                  Vélo démonté / plié
                </div>
                <p class="text-sm p-2" v-html="row.regle_demonte"></p>
              </div>
              <div
                v-if="row.regle_nondemonte"
                class="border rounded-md border-base-content/20 overflow-hidden"
              >
                <div
                  class="w-full p-2 border-b border-base-content/20 text-xs font-semibold text-primary uppercase"
                >
                  Vélo non démonté
                </div>
                <p class="text-sm p-2" v-html="row.regle_nondemonte"></p>
              </div>
              <div v-if="row.source1 || row.source2" class="text-xs text-right">
                <template v-if="row.source1">
                  <a
                    v-if="isUrl(row.source1)"
                    :href="row.source1"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link"
                    >{{ hasMultipleSources(row) ? "Source 1" : "Source" }}</a
                  >
                  <span v-else class="text-base-content/60">{{
                    row.source1
                  }}</span></template
                ><template v-if="row.source2"
                  >,
                  <a
                    v-if="isUrl(row.source2)"
                    :href="row.source2"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link"
                    >Source 2</a
                  >
                  <span v-else class="text-base-content/60">{{
                    row.source2
                  }}</span></template
                >
              </div>
            </div>
          </div>

          <div
            v-if="filteredRows.length === 0"
            class="text-center text-base-content/60 py-8"
          >
            Aucune donnée
          </div>
        </div>
      </div>

      <!-- ===== VUE DESKTOP (tableau) ===== -->
      <div class="hidden md:block overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th class="text-center">Type</th>
              <th class="text-center">Compagnie / Région</th>
              <th class="text-center">Vélo démonté / plié</th>
              <th class="text-center">Vélo non démonté</th>
              <th class="text-center">Sources</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in desktopTableRows" :key="row.emport_id">
              <td
                v-if="row.isFirstInGroup"
                :rowspan="row.rowspan"
                class="font-bold whitespace-nowrap uppercase align-middle text-center"
                :class="typeBgClass(row.type_train)"
              >
                <span
                  class="inline-block [writing-mode:vertical-rl] rotate-180"
                  >{{ typeLabel(row.type_train) }}</span
                >
              </td>
              <td
                class="font-bold align-middle whitespace-pre-line"
                :class="typeBgClass(row.type_train)"
              >
                {{ row.compagnie_region }}
              </td>
              <td class="text-sm" v-html="row.regle_demonte ?? '–'"></td>
              <td class="text-sm" v-html="row.regle_nondemonte ?? '–'"></td>
              <td>
                <div class="flex flex-col gap-1 items-center text-primary">
                  <template v-if="row.source1">
                    <a
                      v-if="isUrl(row.source1)"
                      :href="row.source1"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link link-hover text-sm font-normal tooltip tooltip-left"
                      :data-tip="row.source1"
                      >{{ hasMultipleSources(row) ? "Source 1" : "Source" }}</a
                    >
                    <span v-else class="text-sm text-base-content/60">{{
                      row.source1
                    }}</span>
                  </template>
                  <template v-if="row.source2">
                    <a
                      v-if="isUrl(row.source2)"
                      :href="row.source2"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link link-hover text-sm font-normal tooltip tooltip-left"
                      :data-tip="row.source2"
                      >Source 2</a
                    >
                    <span v-else class="text-sm text-base-content/60">{{
                      row.source2
                    }}</span>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="desktopTableRows.length === 0">
              <td colspan="5" class="text-center text-base-content/60 py-8">
                Aucune donnée
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- <div class="text-sm text-base-content/60 -mb-2 mt-4">
        Dernière mise à jour: Mars 2026.
      </div> -->
    </div>
  </div>
</template>
