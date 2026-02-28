<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { EmportRow, EmportCategory } from "@/types/emport";

const isLoading = ref(true);
const error = ref<string | null>(null);
const allRows = ref<EmportRow[]>([]);

const selectedCategory = ref<EmportCategory>("all");
const selectedSub = ref<string>("all");

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

// Sous-options disponibles pour le 2e select (compagnies GV ou régions TER)
const availableSubOptions = computed(() => {
  const cat = selectedCategory.value;
  if (cat === "all" || cat === "Intercité") return [];
  const opts = new Set<string>();
  for (const row of allRows.value) {
    if (getCategory(row.type_train) === cat) {
      opts.add(row.compagnie_region);
    }
  }
  return [...opts].sort();
});

// Label du 2e select
const subSelectLabel = computed(() => {
  if (selectedCategory.value === "GV") return "Compagnie";
  return "Région";
});

// Le 2e select est-il nécessaire ?
const needsSubSelect = computed(() => {
  return (
    selectedCategory.value === "GV" ||
    selectedCategory.value === "Régional"
  );
});

// Lignes filtrées
const filteredRows = computed(() => {
  if (selectedCategory.value === "all") return allRows.value;
  return allRows.value.filter((r) => {
    const cat = getCategory(r.type_train);
    if (cat !== selectedCategory.value) return false;
    if (needsSubSelect.value && selectedSub.value !== "all") {
      if (r.compagnie_region !== selectedSub.value) return false;
    }
    return true;
  });
});

// Mobile : prêt à afficher ?
const mobileReady = computed(() => {
  if (selectedCategory.value === "all") return false;
  if (selectedCategory.value === "Intercité") return true;
  if (selectedSub.value !== "all") return true;
  return false;
});

function onCategoryChange(cat: EmportCategory) {
  selectedCategory.value = cat;
  selectedSub.value = "all";
}

function isUrl(s: string | null): boolean {
  return !!s && s.startsWith("http");
}

const categories: { key: EmportCategory; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "GV", label: "Grande vitesse" },
  { key: "Intercité", label: "Intercités" },
  { key: "Régional", label: "Régional / TER" },
];
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

    <div v-else>
      <!-- ===== FILTRES DESKTOP (boutons) ===== -->
      <div
        class="hidden md:flex bg-base-200 rounded-lg p-4 shadow mb-6 flex-row gap-3 items-center"
      >
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="cat in categories"
            :key="cat.key"
            class="btn btn-sm"
            :class="
              selectedCategory === cat.key ? 'btn-primary' : 'btn-ghost'
            "
            @click="onCategoryChange(cat.key)"
          >
            {{ cat.label }}
          </button>
        </div>

        <div v-if="needsSubSelect" class="flex items-center gap-2">
          <label class="text-sm font-medium" for="sub-select-desktop">
            {{ subSelectLabel }} :
          </label>
          <select
            id="sub-select-desktop"
            v-model="selectedSub"
            class="select select-primary select-sm"
          >
            <option value="all">
              {{ needsSubSelect ? "Toutes" : "–" }}
            </option>
            <option
              v-for="opt in availableSubOptions"
              :key="opt"
              :value="opt"
            >
              {{ opt }}
            </option>
          </select>
        </div>
      </div>

      <!-- ===== FILTRES MOBILE (2 selects) ===== -->
      <div class="md:hidden flex flex-col gap-3 mb-6">
        <label class="form-control w-full">
          <div class="label">
            <span class="label-text font-medium">Type de train</span>
          </div>
          <select
            v-model="selectedCategory"
            class="select select-bordered w-full"
            @change="selectedSub = 'all'"
          >
            <option value="all" disabled>Choisir un type</option>
            <option value="GV">Grande vitesse</option>
            <option value="Intercité">Intercités</option>
            <option value="Régional">Régional / TER</option>
          </select>
        </label>

        <label class="form-control w-full">
          <div class="label">
            <span
              class="label-text font-medium"
              :class="{ 'opacity-40': !needsSubSelect }"
            >
              {{ needsSubSelect ? subSelectLabel : "Compagnie / Région" }}
            </span>
          </div>
          <select
            v-model="selectedSub"
            class="select select-bordered w-full"
            :disabled="!needsSubSelect"
          >
            <option value="all" disabled>
              Choisir {{ subSelectLabel === "Compagnie" ? "une compagnie" : "une région" }}
            </option>
            <option
              v-for="opt in availableSubOptions"
              :key="opt"
              :value="opt"
            >
              {{ opt }}
            </option>
          </select>
        </label>
      </div>

      <!-- ===== VUE MOBILE (cards) ===== -->
      <div class="md:hidden">
        <div
          v-if="!mobileReady"
          class="text-center text-base-content/60 py-8"
        >
          <p class="text-sm">
            Sélectionnez un type de train
            <span v-if="needsSubSelect">
              puis {{ subSelectLabel === "Compagnie" ? "une compagnie" : "une région" }}
            </span>
          </p>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div
            v-for="row in filteredRows"
            :key="row.emport_id"
            class="border border-base-300 rounded-lg p-4"
          >
            <h3 class="font-semibold text-base mb-3">
              {{ row.compagnie_region }}
            </h3>
            <div class="flex flex-col gap-3">
              <div v-if="row.regle_demonte" class="border border-base-300 rounded p-3">
                <div class="text-xs font-semibold text-base-content/60 uppercase mb-1">
                  Vélo démonté / plié
                </div>
                <p class="text-sm" v-html="row.regle_demonte"></p>
              </div>
              <div v-if="row.regle_nondemonte" class="border border-base-300 rounded p-3">
                <div class="text-xs font-semibold text-base-content/60 uppercase mb-1">
                  Vélo non démonté
                </div>
                <p class="text-sm" v-html="row.regle_nondemonte"></p>
              </div>
            </div>
            <div
              v-if="row.source1 || row.source2"
              class="flex gap-2 mt-3 pt-2 border-t border-base-300"
            >
              <template v-if="row.source1">
                <a
                  v-if="isUrl(row.source1)"
                  :href="row.source1"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link text-xs"
                >Source 1</a>
                <span v-else class="text-xs text-base-content/60">{{ row.source1 }}</span>
              </template>
              <template v-if="row.source2">
                <a
                  v-if="isUrl(row.source2)"
                  :href="row.source2"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link text-xs"
                >Source 2</a>
                <span v-else class="text-xs text-base-content/60">{{ row.source2 }}</span>
              </template>
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
              <th>Type</th>
              <th>Compagnie / Région</th>
              <th>Vélo démonté / plié</th>
              <th>Vélo non démonté</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.emport_id">
              <td class="font-medium whitespace-nowrap">
                {{ row.type_train }}
              </td>
              <td>{{ row.compagnie_region }}</td>
              <td class="text-sm" v-html="row.regle_demonte ?? '–'"></td>
              <td class="text-sm" v-html="row.regle_nondemonte ?? '–'"></td>
              <td class="whitespace-nowrap">
                <div class="flex gap-1">
                  <template v-if="row.source1">
                    <a
                      v-if="isUrl(row.source1)"
                      :href="row.source1"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="tooltip tooltip-left badge badge-outline badge-sm cursor-pointer"
                      :data-tip="row.source1"
                    >1</a>
                    <span
                      v-else
                      class="tooltip tooltip-left badge badge-outline badge-sm"
                      :data-tip="row.source1"
                    >1</span>
                  </template>
                  <template v-if="row.source2">
                    <a
                      v-if="isUrl(row.source2)"
                      :href="row.source2"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="tooltip tooltip-left badge badge-outline badge-sm cursor-pointer"
                      :data-tip="row.source2"
                    >2</a>
                    <span
                      v-else
                      class="tooltip tooltip-left badge badge-outline badge-sm"
                      :data-tip="row.source2"
                    >2</span>
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRows.length === 0">
              <td colspan="5" class="text-center text-base-content/60 py-8">
                Aucune donnée
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
