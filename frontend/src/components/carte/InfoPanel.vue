<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  useCarteStore,
  type CarteFalaise,
  type CarteArret,
} from "../../stores/carte";
import { formatTime, calculateVeloTime } from "../../utils";
import Icon from "../shared/Icon.vue";

const store = useCarteStore();

const selected = computed(() => store.selected);
const isFalaise = computed(() => store.isFalaiseSelected);
const isArret = computed(() => store.isArretSelected);
const hasFilters = computed(() => store.hasFiltersApplied);

const selectedFalaise = computed(() =>
  isFalaise.value ? (selected.value as CarteFalaise) : null,
);

const selectedArret = computed(() =>
  isArret.value ? (selected.value as CarteArret) : null,
);

const isGare = (arret: CarteArret) =>
  arret.types.includes("ter") || arret.types.includes("tgv");
const libelleArret = (arret: CarteArret) =>
  isGare(arret) ? "Gare" : arret.types.includes("tram") ? "Arrêt de tram" : arret.types.includes("telepherique") ? "Téléphérique" : "Arrêt de bus";

// Lignes BTT desservant l'arrêt sélectionné (bouton « voir la ligne »).
// Le tracé lui-même est dessiné par les cartes, qui écoutent
// `velogrimpe:voir-ligne` (detail = { ligne } ou null pour effacer).
interface LigneBtt {
  id: number;
  nom: string;
  numero: string | null;
  operateur: string | null;
  couleur: string | null;
}
const lignes = ref<LigneBtt[]>([]);
const ligneActiveId = ref<number | null>(null);
let lignesComplete: Array<LigneBtt & Record<string, unknown>> = [];

watch(
  selectedArret,
  async (arret) => {
    lignes.value = [];
    lignesComplete = [];
    ligneActiveId.value = null;
    if (!arret) return;
    const id = arret.arret_id;
    try {
      const res = await fetch(`/api/fetch_lignes.php?arret_id=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      // L'arrêt sélectionné a pu changer pendant la requête.
      if (selectedArret.value?.arret_id !== id) return;
      lignesComplete = data.lignes ?? [];
      lignes.value = lignesComplete;
    } catch {
      /* pas de ligne affichable : le bouton n'apparaît simplement pas */
    }
  },
  { immediate: true },
);

function toggleLigne(l: LigneBtt) {
  const activer = ligneActiveId.value !== l.id;
  ligneActiveId.value = activer ? l.id : null;
  const ligne = lignesComplete.find((x) => x.id === l.id);
  window.dispatchEvent(
    new CustomEvent("velogrimpe:voir-ligne", {
      detail: activer && ligne ? { ligne } : null,
    }),
  );
}

// Les cartes effacent la ligne à chaque changement de sélection (teardown) :
// on s'aligne sur leur état.
function onVoirLigne(e: Event) {
  if (!(e as CustomEvent).detail) ligneActiveId.value = null;
}
onMounted(() => window.addEventListener("velogrimpe:voir-ligne", onVoirLigne));
onBeforeUnmount(() =>
  window.removeEventListener("velogrimpe:voir-ligne", onVoirLigne),
);

function getColorClass(index: number): string {
  return store.getColorForIndex(index);
}

function formatDescription(text: string | null): string {
  if (!text) return "";
  return text.replace(/\n/g, "<br>");
}

// Using inline reference since SVG sprite is inlined in footer
</script>

<template>
  <div>
    <!-- Header: Filter stats (when nothing selected) -->
    <div
      v-if="!selected"
      class="flex gap-1 items-center justify-center font-bold text-primary border-b border-base-300 pb-1 mb-1"
    >
      <Icon name="filter" class="w-4 h-4" />
      <span v-if="hasFilters">
        {{ store.filteredFalaises }} falaises correspondent aux filtres
      </span>
      <span v-else> {{ store.totalFalaises }} falaises </span>
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
              <b
                >{{ it.arret?.arret_nom }} ({{
                  formatTime(calculateVeloTime(it))
                }})</b
              >
              : {{ it.velo_km }} km, {{ it.velo_dplus }} D+
            </div>
          </li>
          <li
            v-for="p in selectedFalaise.pieton"
            :key="`pieton-${p.arret.arret_id}`"
            class="relative ml-8"
          >
            <div>
              <b>{{ p.arret.arret_nom }}</b> : accès à pied
            </div>
          </li>
        </ul>
      </details>
    </div>

    <!-- Arrêt selected -->
    <div v-else-if="selectedArret" class="flex flex-col gap-1">
      <h3 class="text-xl font-bold">
        {{ libelleArret(selectedArret) }} : {{ selectedArret.arret_nom }}
      </h3>

      <div v-if="lignes.length" class="flex flex-wrap gap-1">
        <button
          v-for="l in lignes"
          :key="l.id"
          type="button"
          class="btn btn-xs btn-outline btn-primary"
          :class="{ 'btn-active': ligneActiveId === l.id }"
          :aria-pressed="ligneActiveId === l.id"
          :title="l.operateur ?? undefined"
          @click="toggleLigne(l)"
        >
          {{ ligneActiveId === l.id ? "Masquer la ligne" : "Voir la ligne" }}
          {{ l.numero ?? l.nom }}
        </button>
      </div>

      <details>
        <summary><i>Falaises accessibles depuis cet arrêt</i></summary>
        <ul>
          <li
            v-for="(it, i) in selectedArret.access"
            :key="it.velo_id"
            class="relative ml-8"
          >
            <div
              class="absolute top-2 -left-2 w-6 h-1 -translate-x-full"
              :class="getColorClass(i)"
            />
            <div>
              <a
                class="link"
                :href="`/falaise.php?falaise_id=${it.falaise?.falaise_id}`"
              >
                {{ it.falaise?.falaise_nom }}
              </a>
              :
              <b>{{ formatTime(calculateVeloTime(it)) }}</b>
              à vélo
              ({{ it.velo_km }} km, {{ it.velo_dplus }} D+).
            </div>
          </li>
          <li
            v-for="f in selectedArret.pieton"
            :key="`pieton-${f.falaise_id}`"
            class="relative ml-8"
          >
            <div>
              <a class="link" :href="`/falaise.php?falaise_id=${f.falaise_id}`">
                {{ f.falaise_nom }}
              </a>
              : à pied
            </div>
          </li>
        </ul>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* Color classes for itineraire markers - must match store colors */
.indianRed {
  background-color: indianred;
}
.tomato {
  background-color: tomato;
}
.teal {
  background-color: teal;
}
.paleVioletRed {
  background-color: palevioletred;
}
.mediumSlateBlue {
  background-color: mediumslateblue;
}
.lightSalmon {
  background-color: lightsalmon;
}
.fireBrick {
  background-color: firebrick;
}
.crimson {
  background-color: crimson;
}
.purple {
  background-color: purple;
}
.hotPink {
  background-color: hotpink;
}
.mediumOrchid {
  background-color: mediumorchid;
}

details[open] summary {
  margin-bottom: 0.5rem;
}
</style>
