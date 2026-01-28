import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Sortie, Ville, VeloRoute } from "@/types/sortie";

export const useSortiesStore = defineStore("sorties", () => {
  // State
  const sorties = ref<Sortie[]>([]);
  const villes = ref<Ville[]>([]);
  const selectedSortie = ref<Sortie | null>(null);
  const selectedSortieVelos = ref<VeloRoute[]>([]);
  const filterVilleId = ref<number | null>(null);
  const currentMonth = ref<string>(
    new Date().toISOString().slice(0, 7), // YYYY-MM format
  );
  const isLoading = ref(false);
  const isLoadingVelos = ref(false);

  // Helper to get drawer checkbox element
  function getDrawerCheckbox(): HTMLInputElement | null {
    return document.getElementById("sortie-drawer") as HTMLInputElement | null;
  }

  // Getters
  const filteredSorties = computed(() => {
    let filtered = sorties.value;

    // Filter by ville
    if (filterVilleId.value !== null) {
      filtered = filtered.filter((s) => s.ville_id === filterVilleId.value);
    }

    return filtered;
  });

  const sortiesForMonth = computed(() => {
    return filteredSorties.value.filter((sortie) => {
      const debutMonth = sortie.date_debut.slice(0, 7);
      const finMonth = sortie.date_fin?.slice(0, 7)!;

      // Check if sortie is in current month
      return (
        debutMonth === currentMonth.value ||
        finMonth === currentMonth.value ||
        // Or if it spans across the month
        (debutMonth <= currentMonth.value &&
          (!finMonth || finMonth >= currentMonth.value))
      );
    });
  });

  const selectedVilleName = computed(() => {
    if (filterVilleId.value === null) return null;
    const ville = villes.value.find((v) => v.ville_id === filterVilleId.value);
    return ville?.ville_nom || null;
  });

  // Actions
  async function initialize(villesData: Ville[]) {
    villes.value = villesData;
    await fetchSorties();
  }

  async function fetchSorties() {
    isLoading.value = true;
    try {
      const params = new URLSearchParams();
      if (filterVilleId.value !== null) {
        params.append("ville_id", filterVilleId.value.toString());
      }
      params.append("mois", currentMonth.value);

      const response = await fetch(`/api/fetch_sorties.php?${params}`);
      const data = await response.json();

      if (data.success) {
        sorties.value = data.sorties;
      } else {
        console.error("Failed to fetch sorties:", data.error);
      }
    } catch (error) {
      console.error("Error fetching sorties:", error);
    } finally {
      isLoading.value = false;
    }
  }

  async function selectSortie(sortie: Sortie | null) {
    selectedSortie.value = sortie;
    const checkbox = getDrawerCheckbox();
    if (checkbox) {
      checkbox.checked = sortie !== null;
    }

    // Fetch velo routes if sortie has a falaise_principale_id
    if (sortie && sortie.falaise_principale_id) {
      await fetchVeloRoutes(sortie.falaise_principale_id);
    } else {
      selectedSortieVelos.value = [];
    }
  }

  async function fetchVeloRoutes(falaiseId: number) {
    isLoadingVelos.value = true;
    try {
      const response = await fetch(
        `/api/fetch_sortie_velos.php?falaise_id=${falaiseId}`,
      );
      const data = await response.json();

      if (data.success) {
        selectedSortieVelos.value = data.velos;
      } else {
        console.error("Failed to fetch velo routes:", data.error);
        selectedSortieVelos.value = [];
      }
    } catch (error) {
      console.error("Error fetching velo routes:", error);
      selectedSortieVelos.value = [];
    } finally {
      isLoadingVelos.value = false;
    }
  }

  function closeDrawer() {
    const checkbox = getDrawerCheckbox();
    if (checkbox) {
      checkbox.checked = false;
    }
    selectedSortie.value = null;
    selectedSortieVelos.value = [];
  }

  function setFilterVille(villeId: number | null) {
    filterVilleId.value = villeId;
    fetchSorties();
  }

  function navigateMonth(direction: "prev" | "next") {
    const [year, month] = currentMonth.value.split("-").map(Number);
    const date = new Date(year, month, 1);

    if (direction === "prev") {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }

    currentMonth.value = date.toISOString().slice(0, 7);
    fetchSorties();
  }

  function setCurrentMonth(month: string) {
    currentMonth.value = month;
    fetchSorties();
  }

  return {
    // State
    sorties,
    villes,
    selectedSortie,
    selectedSortieVelos,
    filterVilleId,
    currentMonth,
    isLoading,
    isLoadingVelos,
    // Getters
    filteredSorties,
    sortiesForMonth,
    selectedVilleName,
    // Actions
    initialize,
    fetchSorties,
    selectSortie,
    closeDrawer,
    setFilterVille,
    navigateMonth,
    setCurrentMonth,
  };
});
