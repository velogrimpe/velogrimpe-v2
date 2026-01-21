<script setup lang="ts">
import { computed } from "vue";
import type { TableauFalaise, TableauItinerary } from "@/types/tableau";
import { formatTime, calculateVeloTime } from "@/utils";
import RoseDesVents from "@/components/shared/RoseDesVents.vue";

const props = defineProps<{
  falaise: TableauFalaise;
  villeId: number;
}>();

const common = computed(() => props.falaise[0]);

function formatCorrespondances(it: TableauItinerary): string {
  const min = it.train_correspmin === 0 ? "D" : `${it.train_correspmin}C`;
  const max =
    it.train_correspmax === 0 || it.train_correspmax === it.train_correspmin
      ? ""
      : `/${it.train_correspmax}C`;
  return min + max;
}
</script>

<template>
  <a
    :href="`/falaise.php?falaise_id=${common.falaise_id}&ville_id=${villeId}`"
    class="card-link text-base-content hover:no-underline font-normal"
  >
    <div class="flex flex-col rounded-lg shadow-xl bg-base-100 p-2 text-sm">
      <div class="flex flex-row justify-between gap-1">
        <h3 class="text-xl font-bold text-primary hover:underline">
          {{ common.falaise_nom }}
          <span v-if="common.falaise_fermee" class="text-error font-normal"
            >Falaise Interdite</span
          >
        </h3>
        <div class="font-bold text-xl">
          {{ formatTime(common.temps_total) }}
        </div>
      </div>
      <div class="w-full flex flex-row items-center justify-between gap-2">
        <div class="flex flex-col items-start justify-start grow">
          <div><b>Zone</b> : {{ common.zone_nom }}</div>
          <div>
            <b title="Cotations (6-: 6a à 6b, 6+: 6b+ à 6c+ etc.)">Cotations</b>
            :
            <span
              >de {{ common.falaise_cotmin }} à
              {{ common.falaise_cotmax }}</span
            >
          </div>
          <div v-if="common.falaise_gvnb" class="text-accent">
            {{ common.falaise_gvnb }}
          </div>
          <div v-if="common.falaise_bloc === 1" class="text-accent">
            Secteur de bloc
          </div>
          <div v-else-if="common.falaise_bloc === 2" class="text-accent">
            Psychobloc
          </div>
          <div>
            <b title="Marche d'approche">Marche d'approche</b> :
            <span v-if="common.falaise_maa > 0">{{
              formatTime(common.falaise_maa)
            }}</span>
            <span v-else>Aucune</span>
          </div>
        </div>
        <RoseDesVents
          :expo1="common.falaise_exposhort1"
          :expo2="common.falaise_exposhort2"
          :size="72"
        />
      </div>
      <div class="w-full">
        <div class="border-base-300">
          <b>Acces depuis {{ common.ville_nom }} :</b>
        </div>
        <ul class="list-disc list-inside">
          <li v-for="(row, idx) in falaise" :key="idx">
            <template v-if="row.train_temps > 0">
              <span
                v-if="row.train_tgv"
                class="badge badge-accent badge-sm"
                title="Trajet empruntant un segment TGV"
                >TGV</span
              >
              Train pour {{ row.train_arrivee }} ({{
                formatTime(row.train_temps)
              }},
              <span title="D=Direct / C=Correspondances">{{
                formatCorrespondances(row)
              }}</span
              >) +
            </template>
            {{ formatTime(calculateVeloTime(row)) }}
            {{ row.velo_apieduniquement === 1 ? "A pied" : "a velo" }}
            <template v-if="row.variante_a_pied === 1">
              <br /><span class="text-primary">Aussi accessible a pied</span>
            </template>
          </li>
        </ul>
      </div>
    </div>
  </a>
</template>
