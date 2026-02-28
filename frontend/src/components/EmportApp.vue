<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { EmportRow, EmportCategory } from "@/types/emport";

const isLoading = ref(true);
const error = ref<string | null>(null);
const allRows = ref<EmportRow[]>([]);

const selectedCategory = ref<EmportCategory>("all");
const selectedRegion = ref<string>("all");

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

const availableRegions = computed(() => {
  const regions = new Set<string>();
  for (const row of allRows.value) {
    if (getCategory(row.type_train) === "Régional") {
      regions.add(row.compagnie_region);
    }
  }
  return [...regions].sort();
});

const filteredRows = computed(() => {
  if (selectedCategory.value === "all") return allRows.value;
  return allRows.value.filter((r) => {
    const cat = getCategory(r.type_train);
    if (cat !== selectedCategory.value) return false;
    if (
      selectedCategory.value === "Régional" &&
      selectedRegion.value !== "all" &&
      r.compagnie_region !== selectedRegion.value
    )
      return false;
    return true;
  });
});

const mobileReady = computed(() => {
  if (selectedCategory.value === "all") return false;
  if (selectedCategory.value === "Régional" && selectedRegion.value === "all")
    return false;
  return true;
});

function onCategoryChange(cat: EmportCategory) {
  selectedCategory.value = cat;
  selectedRegion.value = "all";
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
      <!-- ===== FILTRES ===== -->
      <div
        class="bg-base-200 rounded-lg p-4 shadow mb-6 flex flex-col md:flex-row gap-3 items-start md:items-center"
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

        <!-- Sous-filtre région -->
        <div
          v-if="selectedCategory === 'Régional'"
          class="flex items-center gap-2"
        >
          <label class="text-sm font-medium" for="region-select"
            >Région :</label
          >
          <select
            id="region-select"
            v-model="selectedRegion"
            class="select select-primary select-sm"
          >
            <option value="all">Toutes</option>
            <option
              v-for="region in availableRegions"
              :key="region"
              :value="region"
            >
              {{ region }}
            </option>
          </select>
        </div>
      </div>

      <!-- ===== VUE MOBILE ===== -->
      <div class="md:hidden">
        <!-- Invitation à filtrer -->
        <div
          v-if="!mobileReady"
          class="text-center text-base-content/60 py-8"
        >
          <p class="text-lg font-medium">
            Sélectionnez un type de train
          </p>
          <p
            v-if="selectedCategory === 'Régional'"
            class="text-sm mt-1"
          >
            puis une région
          </p>
        </div>

        <!-- Cards résultats -->
        <div v-else class="flex flex-col gap-4">
          <div
            v-for="row in filteredRows"
            :key="row.emport_id"
            class="card bg-base-100 shadow-lg"
          >
            <div class="card-body p-4">
              <h3 class="card-title text-base">
                {{ row.compagnie_region }}
              </h3>
              <div class="grid grid-cols-1 gap-3">
                <div v-if="row.regle_demonte" class="bg-success/10 rounded p-3">
                  <div class="font-semibold text-sm mb-1">
                    Vélo démonté / plié
                  </div>
                  <p class="text-sm" v-html="row.regle_demonte"></p>
                </div>
                <div v-if="row.regle_nondemonte" class="bg-info/10 rounded p-3">
                  <div class="font-semibold text-sm mb-1">
                    Vélo non démonté
                  </div>
                  <p class="text-sm" v-html="row.regle_nondemonte"></p>
                </div>
              </div>
              <!-- Sources -->
              <div
                v-if="row.source1 || row.source2"
                class="flex gap-2 mt-2"
              >
                <a
                  v-if="row.source1"
                  :href="row.source1"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link link-primary text-xs"
                >
                  Source 1
                </a>
                <a
                  v-if="row.source2"
                  :href="row.source2"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link link-primary text-xs"
                >
                  Source 2
                </a>
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
                  <a
                    v-if="row.source1"
                    :href="row.source1"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="tooltip tooltip-left badge badge-outline badge-sm cursor-pointer"
                    :data-tip="row.source1"
                  >
                    1
                  </a>
                  <a
                    v-if="row.source2"
                    :href="row.source2"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="tooltip tooltip-left badge badge-outline badge-sm cursor-pointer"
                    :data-tip="row.source2"
                  >
                    2
                  </a>
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
