import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { FilterState, Exposition, Cotation } from "@/types";
import { defaultFilters } from "@/types";

export const useFiltersStore = defineStore("filters", () => {
  // State - deep copy to avoid mutating defaultFilters
  const filters = ref<FilterState>(JSON.parse(JSON.stringify(defaultFilters)));

  // Getters
  const hasActiveFilters = computed(() => {
    const f = filters.value;
    return (
      f.exposition.length > 0 ||
      f.cotations.length > 0 ||
      f.typeVoies.couenne ||
      f.typeVoies.grandeVoie ||
      f.typeVoies.bloc ||
      f.typeVoies.psychobloc ||
      f.nbVoiesMin > 0 ||
      f.villeId !== null ||
      f.velo.tempsMax !== null ||
      f.velo.distMax !== null ||
      f.velo.denivMax !== null ||
      f.velo.apiedPossible ||
      f.approche.tempsMax !== null
    );
  });

  const hasVilleSelected = computed(() => filters.value.villeId !== null);

  // Actions
  function setExposition(expositions: Exposition[]) {
    filters.value.exposition = expositions;
  }

  function toggleExposition(expo: Exposition) {
    const idx = filters.value.exposition.indexOf(expo);
    if (idx === -1) {
      filters.value.exposition.push(expo);
    } else {
      filters.value.exposition.splice(idx, 1);
    }
  }

  function setCotations(cotations: Cotation[]) {
    filters.value.cotations = cotations;
  }

  function toggleCotation(cot: Cotation) {
    const idx = filters.value.cotations.indexOf(cot);
    if (idx === -1) {
      filters.value.cotations.push(cot);
    } else {
      filters.value.cotations.splice(idx, 1);
    }
  }

  function setTypeVoie(type: keyof FilterState["typeVoies"], value: boolean) {
    filters.value.typeVoies[type] = value;
  }

  function setNbVoiesMin(value: number) {
    filters.value.nbVoiesMin = value;
  }

  function setVilleId(villeId: string | null) {
    filters.value.villeId = villeId;
    // Reset train/total filters when no ville selected
    if (villeId === null) {
      filters.value.train = { ...defaultFilters.train };
      filters.value.total = { ...defaultFilters.total };
    }
  }

  function setTrainTempsMax(value: number | null) {
    filters.value.train.tempsMax = value;
  }

  function setTrainCorrespMax(value: number | null) {
    filters.value.train.correspMax = value;
  }

  function setTrainTerOnly(value: boolean) {
    filters.value.train.terOnly = value;
  }

  function setVeloTempsMax(value: number | null) {
    filters.value.velo.tempsMax = value;
  }

  function setVeloDistMax(value: number | null) {
    filters.value.velo.distMax = value;
  }

  function setVeloDenivMax(value: number | null) {
    filters.value.velo.denivMax = value;
  }

  function setVeloApiedPossible(value: boolean) {
    filters.value.velo.apiedPossible = value;
  }

  function setApprocheTempsMax(value: number | null) {
    filters.value.approche.tempsMax = value;
  }

  function setTotalTempsTV(value: number | null) {
    filters.value.total.tempsTV = value;
  }

  function setTotalTempsTVA(value: number | null) {
    filters.value.total.tempsTVA = value;
  }

  function resetFilters() {
    // Deep copy to avoid mutating defaultFilters
    filters.value = JSON.parse(JSON.stringify(defaultFilters));
  }

  // Emit changes to non-Vue code via custom event
  watch(
    filters,
    (newFilters) => {
      window.dispatchEvent(
        new CustomEvent("velogrimpe:filters", {
          detail: JSON.parse(JSON.stringify(newFilters)),
        }),
      );
    },
    { deep: true },
  );

  return {
    // State
    filters,
    // Getters
    hasActiveFilters,
    hasVilleSelected,
    // Actions
    setExposition,
    toggleExposition,
    setCotations,
    toggleCotation,
    setTypeVoie,
    setNbVoiesMin,
    setVilleId,
    setTrainTempsMax,
    setTrainCorrespMax,
    setTrainTerOnly,
    setVeloTempsMax,
    setVeloDistMax,
    setVeloDenivMax,
    setVeloApiedPossible,
    setApprocheTempsMax,
    setTotalTempsTV,
    setTotalTempsTVA,
    resetFilters,
  };
});
