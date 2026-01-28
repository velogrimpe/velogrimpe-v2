<script setup lang="ts">
import { computed } from "vue";
import { useSortiesStore } from "@/stores/sorties";
import SortieCard from "./SortieCard.vue";

const store = useSortiesStore();

// Group sorties by date and sort
const sortiesByDate = computed(() => {
  const grouped = new Map<string, typeof store.sortiesForMonth>();

  store.sortiesForMonth.forEach((sortie) => {
    const dateKey = sortie.date_debut;
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(sortie);
  });

  // Convert to array and sort by date
  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, sorties]) => ({
      date,
      dateFormatted: new Date(date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      sorties,
    }));
});
</script>

<template>
  <div class="bg-base-100 rounded-lg shadow-lg p-4">
    <!-- Sorties list grouped by date -->
    <div v-if="sortiesByDate.length > 0" class="flex flex-col gap-6">
      <div v-for="group in sortiesByDate" :key="group.date" class="space-y-2">
        <h3
          class="text-lg font-semibold capitalize sticky top-0 bg-base-100 py-2"
        >
          {{ group.dateFormatted }}
        </h3>
        <div class="space-y-2">
          <SortieCard
            v-for="sortie in group.sorties"
            :key="sortie.sortie_id"
            :sortie="sortie"
          />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-8 text-base-content/60">
      <p class="text-lg">Aucune sortie prévue ce mois-ci</p>
      <p class="text-sm mt-2">
        <a href="/ajout/ajout_sortie.php" class="link link-primary"
          >Proposez la première !</a
        >
      </p>
    </div>
  </div>
</template>
