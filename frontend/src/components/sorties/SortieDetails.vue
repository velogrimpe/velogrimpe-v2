<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { Sortie, VeloRoute } from "@/types/sortie";
import ParticipationModal from "./ParticipationModal.vue";
import ToastContainer from "@/components/shared/ToastContainer.vue";
import SortieDetailsContent from "./SortieDetailsContent.vue";
import { useSortieActions } from "@/composables/useSortieActions";

const props = defineProps<{
  sortie: Sortie;
}>();

const veloRoutes = ref<VeloRoute[]>([]);
const isLoadingVelos = ref(false);

const {
  isParticipationModalOpen,
  dateDisplay,
  openParticipationModal,
  closeParticipationModal,
  copyLink,
  handleGroupLinkClick,
} = useSortieActions(() => props.sortie);

async function fetchVeloRoutes(falaiseId: number) {
  isLoadingVelos.value = true;
  try {
    const response = await fetch(
      `/api/fetch_sortie_velos.php?falaise_id=${falaiseId}`,
    );
    const data = await response.json();

    if (data.success) {
      veloRoutes.value = data.velos;
    } else {
      console.error("Failed to fetch velo routes:", data.error);
      veloRoutes.value = [];
    }
  } catch (error) {
    console.error("Error fetching velo routes:", error);
    veloRoutes.value = [];
  } finally {
    isLoadingVelos.value = false;
  }
}

function handleParticipationSubmitted() {
  // Reload page to show updated nb_interesses
  window.location.reload();
}

onMounted(() => {
  // Fetch velo routes if sortie has a falaise_principale_id
  if (props.sortie.falaise_principale_id) {
    fetchVeloRoutes(props.sortie.falaise_principale_id);
  }
});
</script>

<template>
  <div class="card bg-base-100 shadow-lg">
    <div class="card-body">
      <SortieDetailsContent
        :sortie="sortie"
        :date-display="dateDisplay"
        :on-group-link-click="handleGroupLinkClick"
        :on-participation-click="openParticipationModal"
        :on-copy-link="copyLink"
      />
    </div>
  </div>

  <!-- Participation Modal -->
  <ParticipationModal
    :sortie="sortie"
    :is-open="isParticipationModalOpen"
    @close="closeParticipationModal"
    @submitted="handleParticipationSubmitted"
  />

  <ToastContainer />
</template>
