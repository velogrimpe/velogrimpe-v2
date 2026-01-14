<script setup lang="ts">
import { computed } from 'vue'
import type { TableauFalaise, TableauItinerary } from '@/types/tableau'
import { formatTime, calculateVeloTime } from '@/utils'
import { getNbVoiesLabel } from './utils'
import RoseDesVents from '@/components/shared/RoseDesVents.vue'

const props = defineProps<{
  falaise: TableauFalaise
  villeId: number
}>()

const common = computed(() => props.falaise[0])

function formatCorrespondances(it: TableauItinerary): string {
  const min = it.train_correspmin === 0 ? 'D' : `${it.train_correspmin}C`
  const max = it.train_correspmax === 0 || it.train_correspmax === it.train_correspmin
    ? ''
    : `/${it.train_correspmax}C`
  return min + max
}

function getVeloTimeDisplay(it: TableauItinerary): string {
  return formatTime(calculateVeloTime(it))
}

function getVeloReturnTime(it: TableauItinerary): string {
  const { velo_km, velo_dmoins, velo_apieduniquement } = it
  let timeInHours: number
  if (velo_apieduniquement === 1) {
    timeInHours = velo_km / 4 + velo_dmoins / 500
  } else {
    timeInHours = velo_km / 20 + velo_dmoins / 500
  }
  return formatTime(Math.round(timeInHours * 60))
}
</script>

<template>
  <!-- Falaise name column -->
  <div class="bg-base-100 px-2 py-1 self-stretch font-bold flex flex-col items-center justify-center text-base">
    <div>
      <a :href="`/falaise.php?falaise_id=${common.falaise_id}&ville_id=${villeId}`">
        {{ common.falaise_nom }}
      </a>
      <div v-if="common.falaise_fermee" class="text-error text-sm font-normal">Falaise Interdite</div>
      <div v-if="common.zone_nom" class="font-normal text-xs">({{ common.zone_nom }})</div>
    </div>
  </div>

  <!-- Total time column -->
  <div class="font-bold bg-base-100 py-1 self-stretch grid divide-y divide-slate-200 items-center"
       :style="{ gridTemplateRows: `repeat(${falaise.length}, 1fr)` }">
    <div v-for="(row, idx) in falaise" :key="idx" class="self-stretch flex flex-col justify-center py-2 px-2">
      {{ formatTime(calculateVeloTime(row) + row.train_temps + common.falaise_maa) }}
    </div>
  </div>

  <!-- Train column -->
  <div class="bg-base-100 py-1 self-stretch grid divide-y divide-slate-200 items-center"
       :style="{ gridTemplateRows: `repeat(${falaise.length}, 1fr)` }">
    <div v-for="(row, idx) in falaise" :key="idx" class="self-stretch flex flex-col justify-center py-2 px-2">
      <template v-if="row.train_temps > 0">
        <div class="text-base font-bold">
          <span v-if="row.train_tgv" class="badge badge-accent badge-sm" title="Trajet empruntant un segment TGV">TGV</span>
          {{ formatTime(row.train_temps) }}
          <span title="D=Direct / C=Correspondances">({{ formatCorrespondances(row) }})</span>
        </div>
        <div class="text-nowrap">{{ row.train_arrivee }}</div>
      </template>
      <template v-else>
        Pas de train a prendre
      </template>
    </div>
  </div>

  <!-- Velo column -->
  <div class="bg-base-100 py-1 self-stretch grid divide-y divide-slate-200 items-center"
       :style="{ gridTemplateRows: `repeat(${falaise.length}, 1fr)` }">
    <div v-for="(row, idx) in falaise" :key="idx" class="self-stretch flex flex-col justify-center py-2 px-2">
      <div class="text-base font-bold">
        Aller : {{ getVeloTimeDisplay(row) }} - Retour : {{ getVeloReturnTime(row) }}
      </div>
      <div>{{ row.velo_km }} km, {{ row.velo_dplus }} D+, {{ row.velo_dmoins }} D-</div>
      <div v-if="row.velo_apieduniquement === 1" class="text-primary">A pied uniquement</div>
      <div v-if="row.variante_a_pied === 1" class="text-primary">Aussi accessible a pied</div>
    </div>
  </div>

  <!-- Falaise info column -->
  <div class="bg-base-100 px-2 py-1 self-stretch flex flex-row items-center justify-end gap-2">
    <div class="flex flex-col items-center justify-center gap-1 flex-grow">
      <div>
        <span title="Marche d'approche">Marche d'approche</span> :
        <span class="font-bold">
          <template v-if="common.falaise_maa > 0">{{ formatTime(common.falaise_maa) }}</template>
          <template v-else>Aucune</template>
        </span>
      </div>
      <div>
        <span class="font-bold">{{ getNbVoiesLabel(common.falaise_nbvoies) }}</span> de
        <span class="font-bold" title="Cotations (6-: 6a a 6b, 6+: 6b+ a 6c+ etc.)">
          {{ common.falaise_cotmin }} a {{ common.falaise_cotmax }}
        </span>
      </div>
      <div v-if="common.falaise_gvnb" class="text-accent">{{ common.falaise_gvnb }}</div>
      <div v-if="common.falaise_bloc === 1" class="text-accent">Secteur de bloc</div>
      <div v-else-if="common.falaise_bloc === 2" class="text-accent">Psychobloc</div>
    </div>
    <RoseDesVents
      :expo1="common.falaise_exposhort1"
      :expo2="common.falaise_exposhort2"
      :size="72"
    />
  </div>
</template>
