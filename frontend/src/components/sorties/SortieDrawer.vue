<script setup lang="ts">
import { computed } from "vue";
import { useSortiesStore } from "@/stores/sorties";
import ParticipationModal from "./ParticipationModal.vue";
import SortieDetailsContent from "./SortieDetailsContent.vue";
import { useSortieActions } from "@/composables/useSortieActions";

const store = useSortiesStore();

const sortie = computed(() => store.selectedSortie);

const {
  isParticipationModalOpen,
  dateDisplay,
  openParticipationModal,
  closeParticipationModal,
  copyLink,
  handleGroupLinkClick: baseHandleGroupLinkClick,
} = useSortieActions(() => sortie.value);

async function handleGroupLinkClick() {
  if (!sortie.value) return;

  // Call base function to increment
  await baseHandleGroupLinkClick();

  // Refresh sorties list to update count
  store.fetchSorties();
}

function handleParticipationSubmitted() {
  // Refresh sortie data to update nb_interesses
  store.fetchSorties();
}
</script>

<template>
  <!-- Teleport drawer side to PHP template target -->
  <Teleport to="#drawer-side-target">
    <div
      class="p-6 w-full md:w-[600px] bg-base-100 min-h-full overflow-y-auto relative"
    >
      <template v-if="sortie">
        <!-- Sortie details -->
        <div class="mt-8 drawer-content-wrapper">
          <SortieDetailsContent
            :sortie="sortie"
            :date-display="dateDisplay"
            :on-group-link-click="handleGroupLinkClick"
            :on-participation-click="openParticipationModal"
            :on-copy-link="copyLink"
            class="drawer-sortie-details"
          />
        </div>
      </template>
    </div>
  </Teleport>

  <!-- Participation Modal (outside drawer) -->
  <ParticipationModal
    :sortie="sortie"
    :is-open="isParticipationModalOpen"
    @close="closeParticipationModal"
    @submitted="handleParticipationSubmitted"
  />
</template>

<style scoped>
/* Hide breadcrumb in drawer */
.drawer-sortie-details :deep(.sortie-breadcrumb) {
  display: none;
}

/* Adjust title size in drawer */
.drawer-sortie-details :deep(h1) {
  font-size: 1.5rem;
}
</style>
