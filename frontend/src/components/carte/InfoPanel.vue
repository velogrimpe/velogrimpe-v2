<script setup lang="ts">
import { computed } from 'vue'
import { useCarteStore, type CarteFalaise, type CarteGare } from '../../stores/carte'
import { formatTime, calculateVeloTime } from '../../utils'

const store = useCarteStore()

const selected = computed(() => store.selected)
const isFalaise = computed(() => store.isFalaiseSelected)
const isGare = computed(() => store.isGareSelected)
const hasFilters = computed(() => store.hasFiltersApplied)

const selectedFalaise = computed(() =>
  isFalaise.value ? (selected.value as CarteFalaise) : null
)

const selectedGare = computed(() =>
  isGare.value ? (selected.value as CarteGare) : null
)

function getColorClass(index: number): string {
  return store.getColorForIndex(index)
}

function formatDescription(text: string | null): string {
  if (!text) return ''
  return text.replace(/\n/g, '<br>')
}
</script>

<template>
  <div class="info-panel bg-base-100 rounded-lg shadow-lg p-3 text-sm max-h-[300px] overflow-y-auto">
    <!-- Header: Filter stats (when nothing selected) -->
    <div v-if="!selected" class="flex gap-1 items-center justify-center font-bold text-primary border-b border-base-300 pb-1 mb-1">
      <svg class="w-4 h-4 fill-current">
        <use href="/symbols/icons.svg#ri-filter-line"></use>
      </svg>
      <span v-if="hasFilters">
        {{ store.filteredFalaises }} falaises correspondent aux filtres
      </span>
      <span v-else>
        {{ store.totalFalaises }} falaises
      </span>
    </div>

    <!-- No selection content -->
    <div v-if="!selected" class="flex flex-col gap-1 items-center text-center">
      <div>Cliquez sur une falaise pour voir ses informations</div>
    </div>

    <!-- Falaise selected -->
    <div v-else-if="selectedFalaise" class="flex flex-col gap-1">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 class="text-xl font-bold">
          <a :href="`/falaise.php?falaise_id=${selectedFalaise.falaise_id}`">
            {{ selectedFalaise.falaise_nom }}
          </a>
        </h3>
        <a
          class="btn btn-primary btn-xs text-base-100! hover:text-base-100!"
          :href="`/falaise.php?falaise_id=${selectedFalaise.falaise_id}`"
        >
          Voir la fiche falaise
        </a>
      </div>

      <p
        v-if="selectedFalaise.falaise_fermee"
        class="text-wrap text-error"
        v-html="formatDescription(selectedFalaise.falaise_fermee)"
      />
      <p
        v-else
        class="text-wrap"
        v-html="formatDescription(selectedFalaise.falaise_voletcarto)"
      />

      <details>
        <summary><i>Liste des accès</i></summary>
        <ul>
          <li
            v-for="(it, i) in selectedFalaise.access"
            :key="it.velo_id"
            class="relative ml-8"
          >
            <div
              class="absolute top-[6px] -left-2 w-6 h-1 -translate-x-full"
              :class="getColorClass(i)"
            />
            <div>
              <b>{{ it.gare?.gare_nom }} ({{ formatTime(calculateVeloTime(it)) }})</b> :
              {{ it.velo_km }} km, {{ it.velo_dplus }} D+
              <span v-if="it.velo_apieduniquement === '1'"> (à pied)</span>
            </div>
          </li>
        </ul>
      </details>
    </div>

    <!-- Gare selected -->
    <div v-else-if="selectedGare" class="flex flex-col gap-1">
      <h3 class="text-xl font-bold">Gare de {{ selectedGare.gare_nom }}</h3>

      <details>
        <summary><i>Falaises accessibles depuis la gare</i></summary>
        <ul>
          <li
            v-for="(it, i) in selectedGare.access"
            :key="it.velo_id"
            class="relative ml-8"
          >
            <div
              class="absolute top-2 -left-2 w-6 h-1 -translate-x-full"
              :class="getColorClass(i)"
            />
            <div>
              <a class="link" :href="`/falaise.php?falaise_id=${it.falaise?.falaise_id}`">
                {{ it.falaise?.falaise_nom }}
              </a> :
              <b>{{ formatTime(calculateVeloTime(it)) }}</b>
              {{ it.velo_apieduniquement === '1' ? 'à pied' : 'à vélo' }}
              ({{ it.velo_km }} km, {{ it.velo_dplus }} D+).
            </div>
          </li>
        </ul>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Color classes for itineraire markers - must match store colors */
.indianRed { background-color: indianred; }
.tomato { background-color: tomato; }
.teal { background-color: teal; }
.paleVioletRed { background-color: palevioletred; }
.mediumSlateBlue { background-color: mediumslateblue; }
.lightSalmon { background-color: lightsalmon; }
.fireBrick { background-color: firebrick; }
.crimson { background-color: crimson; }
.purple { background-color: purple; }
.hotPink { background-color: hotpink; }
.mediumOrchid { background-color: mediumorchid; }

details[open] summary {
  margin-bottom: 0.5rem;
}
</style>
