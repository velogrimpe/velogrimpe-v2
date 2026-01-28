<script setup lang="ts">
import { onMounted } from "vue";
import { useSortiesStore } from "@/stores/sorties";
import type { Ville } from "@/types/sortie";
import SortiesFilter from "./SortiesFilter.vue";
import SortiesCalendar from "./SortiesCalendar.vue";
import SortiesList from "./SortiesList.vue";
import SortieDrawer from "./SortieDrawer.vue";
import ToastContainer from "@/components/shared/ToastContainer.vue";

const props = defineProps<{
  villes: Ville[];
}>();

const store = useSortiesStore();

onMounted(() => {
  store.initialize(props.villes);
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Filter Section -->
    <SortiesFilter />

    <!-- Loading State -->
    <div v-if="store.isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Mobile: List view -->
      <div class="md:hidden">
        <SortiesList />
      </div>

      <!-- Desktop: Calendar view -->
      <div class="hidden md:block">
        <SortiesCalendar />
      </div>
    </div>
  </div>
  <SortieDrawer />
  <ToastContainer />
</template>
