<script setup lang="ts">
import { computed } from "vue";
import { useSortiesStore } from "@/stores/sorties";
import SortieCard from "./SortieCard.vue";
import type { Sortie } from "@/types/sortie";
import Icon from "../shared/Icon.vue";

const store = useSortiesStore();

const monthName = computed(() => {
  const [year, month] = store.currentMonth.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
});

const calendarDays = computed(() => {
  const [year, month] = store.currentMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
  // Adjust so Monday = 0
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const days: Array<{
    date: number;
    dateString: string;
    isCurrentMonth: boolean;
    sorties: Sortie[];
  }> = [];

  // Add empty cells for days before month starts
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    days.push({
      date: dayNum,
      dateString: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`,
      isCurrentMonth: false,
      sorties: [],
    });
  }

  // Add days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const daySorties = store.sortiesForMonth.filter((sortie) => {
      // Show sortie if it starts on this day or spans across it
      const debutDate = sortie.date_debut;
      const finDate = sortie.date_fin || sortie.date_debut;
      return (
        debutDate === dateString ||
        (debutDate <= dateString && finDate >= dateString)
      );
    });

    days.push({
      date: day,
      dateString,
      isCurrentMonth: true,
      sorties: daySorties,
    });
  }

  // Add empty cells for days after month ends
  const remainingCells = 42 - days.length; // Always show 6 weeks
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    days.push({
      date: i,
      dateString: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
      isCurrentMonth: false,
      sorties: [],
    });
  }

  return days;
});

const isToday = (dateString: string) => {
  const today = new Date().toISOString().slice(0, 10);
  return dateString === today;
};
</script>

<template>
  <div class="bg-base-100 rounded-lg shadow-lg p-4">
    <!-- Month navigation -->
    <div class="flex items-center justify-between mb-4">
      <button
        class="btn btn-sm btn-circle btn-ghost"
        @click="store.navigateMonth('prev')"
        aria-label="Mois précédent"
      >
        <Icon name="chevron-left" />
      </button>

      <h2 class="text-xl font-bold capitalize">{{ monthName }}</h2>

      <button
        class="btn btn-sm btn-circle btn-ghost"
        @click="store.navigateMonth('next')"
        aria-label="Mois suivant"
      >
        <Icon name="chevron-right" />
      </button>
    </div>

    <!-- Day headers -->
    <div class="grid grid-cols-7 gap-1 mb-2">
      <div
        v-for="day in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']"
        :key="day"
        class="text-center font-semibold text-sm py-2"
      >
        {{ day }}
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7 gap-1">
      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="min-h-24 p-2 rounded border"
        :class="{
          'bg-base-200': !day.isCurrentMonth,
          'bg-base-100': day.isCurrentMonth,
          'border-primary border-2': isToday(day.dateString),
          'border-base-300': !isToday(day.dateString),
        }"
      >
        <!-- Day number -->
        <div
          class="text-sm font-semibold mb-1"
          :class="{
            'text-base-content/40': !day.isCurrentMonth,
            'text-primary': isToday(day.dateString),
          }"
        >
          {{ day.date }}
        </div>

        <!-- Sorties for this day -->
        <div v-if="day.sorties.length > 0" class="flex flex-col gap-1">
          <SortieCard
            v-for="sortie in day.sorties"
            :key="sortie.sortie_id"
            :sortie="sortie"
            compact
          />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="store.sortiesForMonth.length === 0"
      class="text-center py-8 text-base-content/60"
    >
      <p class="text-lg">Aucune sortie prévue ce mois-ci</p>
      <p class="text-sm mt-2">
        <a href="/ajout/ajout_sortie.php" class="link link-primary"
          >Proposez la première !</a
        >
      </p>
    </div>
  </div>
</template>
