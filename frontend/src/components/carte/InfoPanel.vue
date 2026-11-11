<script setup lang="ts">
import { computed, watch } from "vue";
import {
  useCarteStore,
  type CarteFalaise,
  type CarteArret,
  type CarteAccesPied,
} from "../../stores/carte";
import { formatTime, calculateVeloTime, calculatePiedTime } from "../../utils";
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

// Lignes BTT desservant l'arrêt sélectionné : leur tracé et leurs arrêts sont
// affichés d'emblée par les cartes, qui écoutent `velogrimpe:voir-ligne`
// (detail = { lignes } ou null pour effacer ; les cartes effacent à chaque teardown).
watch(
  selectedArret,
  async (arret) => {
    if (!arret) return;
    const id = arret.arret_id;
    try {
      const res = await fetch(`/api/fetch_lignes.php?arret_id=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      // L'arrêt sélectionné a pu changer pendant la requête.
      if (selectedArret.value?.arret_id !== id) return;
      const lignes = data.lignes ?? [];
      if (lignes.length)
        window.dispatchEvent(new CustomEvent("velogrimpe:voir-ligne", { detail: { lignes } }));
    } catch {
      /* pas de ligne affichable */
    }
  },
  { immediate: true },
);

// Symbole du sprite pour la modalité dominante de l'arrêt (même priorité que arret-icon.js).
const SYMBOLES_ARRET: Record<string, string> = {
  ter: "train",
  tgv: "tgv",
  tram: "tram",
  telepherique: "aerial-tram",
  bus: "bus-stop",
};
function symboleArret(arret: CarteArret): string {
  const t = ["ter", "tgv", "tram", "telepherique", "bus"].find((x) =>
    (arret.types as string[]).includes(x),
  );
  return SYMBOLES_ARRET[t ?? "bus"];
}

// Accès à pied, formaté comme un itinéraire vélo : « (durée) » après le nom, puis
// « : ligne(s) · km, D+ » avec ce qui est renseigné. La durée exige km et D+.
function tempsPied(acces?: CarteAccesPied): string | null {
  const minutes = acces ? calculatePiedTime(acces) : null;
  return minutes !== null ? formatTime(minutes) : null;
}
function detailPied(arret: CarteArret, acces?: CarteAccesPied): string {
  const parts: string[] = [];
  if (arret.lignes?.length)
    parts.push(`${arret.lignes.length > 1 ? "lignes" : "ligne"} ${arret.lignes.join(", ")}`);
  const chiffres: string[] = [];
  if (acces?.km !== null && acces?.km !== undefined) chiffres.push(`${acces.km} km`);
  if (acces?.dplus !== null && acces?.dplus !== undefined) chiffres.push(`${acces.dplus} D+`);
  if (chiffres.length) parts.push(chiffres.join(", "));
  return parts.join(" · ");
}

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
        <!-- Chaque ligne : [icône mode] trait [icône vélo|piéton] texte. La zone de gauche a
             une largeur fixe : le trait raccourcit quand l'icône du mode est présente. -->
        <ul>
          <li
            v-for="(it, i) in selectedFalaise.access"
            :key="it.velo_id"
            class="flex items-start gap-1"
          >
            <div class="w-12 h-6 shrink-0 flex items-center gap-1">
              <svg
                v-if="it.arret && !isGare(it.arret)"
                class="w-4 h-4 shrink-0 fill-current"
                :aria-label="libelleArret(it.arret)"
              >
                <use :href="`#${symboleArret(it.arret)}`"></use>
              </svg>
              <div class="h-1 flex-1" :class="getColorClass(i)" />
            </div>
            <svg class="w-4 h-6 shrink-0 fill-current" aria-label="À vélo">
              <use href="#riding"></use>
            </svg>
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
            v-for="(p, j) in selectedFalaise.pieton"
            :key="`pieton-${p.arret.arret_id}-${j}`"
            class="flex items-start gap-1"
          >
            <div class="w-12 h-6 shrink-0 flex items-center gap-1">
              <svg
                class="w-4 h-4 shrink-0 fill-current"
                :aria-label="libelleArret(p.arret)"
              >
                <use :href="`#${symboleArret(p.arret)}`"></use>
              </svg>
              <!-- Trait de la couleur de la trace GPX à pied, seulement si elle existe -->
              <div v-if="p.acces?.has_gpx" class="h-1 flex-1 pieton" />
            </div>
            <svg class="w-4 h-6 shrink-0 fill-current" aria-label="À pied">
              <use href="#footprint"></use>
            </svg>
            <div>
              <b
                >{{ p.arret.arret_nom
                }}<template v-if="tempsPied(p.acces)">
                  ({{ tempsPied(p.acces) }})</template
                ></b
              >
              <template v-if="detailPied(p.arret, p.acces)">
                : {{ detailPied(p.arret, p.acces) }}
              </template>
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
.pieton {
  /* Même couleur que la trace GPX à pied sur la carte (carte.php : piedGpxOpts) */
  background-color: #334155;
}
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
