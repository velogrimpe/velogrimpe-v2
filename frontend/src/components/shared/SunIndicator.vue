<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import SunCalc from "suncalc";
import Icon from "@/components/shared/Icon.vue";

const props = defineProps<{
  lat: number;
  lng: number;
}>();

// --- État temporel ---------------------------------------------------------
const now = new Date();

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const selectedDate = ref(toDateInput(now));
const minutes = ref(now.getHours() * 60 + now.getMinutes());

// Panneau rétractable (rétracté par défaut).
const collapsed = ref(true);

// Date complète (heure locale du navigateur) construite depuis date + minutes.
const currentDate = computed(() => {
  const [y, m, d] = selectedDate.value.split("-").map(Number);
  const h = Math.floor(minutes.value / 60);
  const min = minutes.value % 60;
  return new Date(y, m - 1, d, h, min);
});

// --- Position du soleil / de la lune ---------------------------------------
// suncalc : azimut mesuré depuis le sud, positif vers l'ouest.
// Cap boussole (0 = nord, 90 = est) = (180 + azimut°) mod 360.
function toCompassDeg(azimuthRad: number): number {
  return (((180 + (azimuthRad * 180) / Math.PI) % 360) + 360) % 360;
}

const sun = computed(() => {
  const pos = SunCalc.getPosition(currentDate.value, props.lat, props.lng);
  return {
    altitudeDeg: (pos.altitude * 180) / Math.PI,
    compassDeg: toCompassDeg(pos.azimuth),
  };
});

const isNight = computed(() => sun.value.altitudeDeg <= 0);

// On suit toujours la position du soleil ; sous l'horizon, seule l'icône change.
const compassDeg = computed(() => sun.value.compassDeg);

// Hauteur du soleil dans le ciel (0° = horizon, 90° = zénith).
const altitudeLabel = computed(() => `${Math.round(sun.value.altitudeDeg)}°`);

// Heures de lever / coucher pour le contexte.
const times = computed(() =>
  SunCalc.getTimes(currentDate.value, props.lat, props.lng),
);

function minutesOfDay(d: Date | undefined): number | null {
  if (!d || isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

// Segment de la frise (en %) entre deux instants de la journée, ou null.
function bandSegment(
  start: Date | undefined,
  end: Date | undefined,
): { left: string; width: string } | null {
  const a = minutesOfDay(start);
  const b = minutesOfDay(end);
  if (a === null || b === null || b <= a) return null;
  return {
    left: `${(a / 1439) * 100}%`,
    width: `${((b - a) / 1439) * 100}%`,
  };
}

// Crépuscule du matin (dawn → sunrise) : dégradé violet → orange.
const dawnStyle = computed(() =>
  bandSegment(times.value.dawn, times.value.sunrise),
);
// Plein jour (sunrise → sunset) : orange.
const dayStyle = computed(() =>
  bandSegment(times.value.sunrise, times.value.sunset),
);
// Crépuscule du soir (sunset → dusk) : dégradé orange → violet.
const duskStyle = computed(() =>
  bandSegment(times.value.sunset, times.value.dusk),
);

// Période courante selon l'heure choisie (pour colorer l'icône comme la frise).
type Period = "night" | "dawn" | "day" | "dusk";
const period = computed<Period>(() => {
  const dawnM = minutesOfDay(times.value.dawn);
  const srM = minutesOfDay(times.value.sunrise);
  const ssM = minutesOfDay(times.value.sunset);
  const duskM = minutesOfDay(times.value.dusk);
  const m = minutes.value;
  if (srM !== null && ssM !== null && m >= srM && m < ssM) return "day";
  if (dawnM !== null && srM !== null && m >= dawnM && m < srM) return "dawn";
  if (ssM !== null && duskM !== null && m >= ssM && m < duskM) return "dusk";
  if (dawnM !== null && duskM !== null) return "night";
  return isNight.value ? "night" : "day"; // repli (latitudes extrêmes)
});

// Icône de l'astre (sprite) + couleur selon le fond.
const astreIconName = computed(() => (isNight.value ? "moon-star" : "sun"));
// Sur la carte : ambre sur fond clair (jour), blanc sinon (nuit / crépuscule).
const markerIconColor = computed(() =>
  period.value === "day" ? "#f59e0b" : "#ffffff",
);
// Dans le panneau (fond clair) : ambre le jour, ardoise la nuit.
const panelIconColor = computed(() => (isNight.value ? "#334155" : "#f59e0b"));

// Fond de l'icône, mêmes couleurs que la frise.
const markerBgStyle = computed(() => {
  switch (period.value) {
    case "day":
      return { backgroundColor: "#ffffff" };
    case "dawn":
      return { backgroundImage: "linear-gradient(to right, #8b5cf6, #fb923c)" };
    case "dusk":
      return { backgroundImage: "linear-gradient(to right, #fb923c, #8b5cf6)" };
    default:
      return { backgroundColor: "#1e293b" };
  }
});

function fmtTime(d: Date | undefined): string {
  if (!d || isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

const currentTimeLabel = computed(() => {
  const h = Math.floor(minutes.value / 60);
  const m = minutes.value % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const CARDINALS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
const cardinalLabel = computed(() => {
  const idx = Math.round(compassDeg.value / 45) % 8;
  return CARDINALS[idx];
});

const markerTitle = computed(() => {
  const etat = isNight.value ? " (sous l'horizon)" : "";
  return `Soleil${etat} — ${cardinalLabel.value} (${Math.round(compassDeg.value)}°)`;
});

// --- Taille du conteneur (carte) -------------------------------------------
const root = ref<HTMLElement | null>(null);
const width = ref(0);
const height = ref(0);
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!root.value) return;
  const update = () => {
    width.value = root.value?.clientWidth ?? 0;
    height.value = root.value?.clientHeight ?? 0;
  };
  update();
  observer = new ResizeObserver(update);
  observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());

// --- Position de l'icône sur la bordure ------------------------------------
const MARGIN = 26; // garde l'icône à l'intérieur du cadre
const markerStyle = computed(() => {
  const w = width.value;
  const h = height.value;
  if (!w || !h) return { display: "none" };
  const rad = (compassDeg.value * Math.PI) / 180;
  const dx = Math.sin(rad); // est = +x
  const dy = -Math.cos(rad); // nord = -y (haut)
  const halfW = w / 2 - MARGIN;
  const halfH = h / 2 - MARGIN;
  const t = Math.min(
    halfW / (Math.abs(dx) || 1e-9),
    halfH / (Math.abs(dy) || 1e-9),
  );
  const x = w / 2 + t * dx;
  const y = h / 2 + t * dy;
  return {
    left: `${x}px`,
    top: `${y}px`,
  };
});

// Flèche radiale : décalée vers l'intérieur pour que toute la flèche (queue
// comprise) dépasse de l'icône, tête pointant vers le centre (la falaise).
const arrowStyle = computed(() => ({
  transform: `rotate(${(compassDeg.value + 180) % 360}deg) translateY(-40px)`,
}));
</script>

<template>
  <div ref="root" class="pointer-events-none absolute inset-0 overflow-hidden">
    <!-- Icône soleil/lune + flèche, sur la bordure -->
    <div
      class="absolute -translate-x-1/2 -translate-y-1/2"
      :style="markerStyle"
    >
      <!-- Flèche radiale (hampe + tête), queue ancrée au centre de l'icône,
           tête vers l'intérieur, halo blanc 1px. -->
      <div
        class="absolute left-1/2 top-1/2 -ml-2.5 -mt-5 origin-center"
        :style="arrowStyle"
      >
        <svg width="20" height="40" viewBox="0 0 24 48" aria-hidden="true">
          <path
            d="M12,2 L20,15 L14.5,15 L14.5,46 L9.5,46 L9.5,15 L4,15 Z"
            :fill="isNight ? '#cbd5e1' : '#f5b301'"
            stroke="#ffffff"
            stroke-width="2"
            stroke-linejoin="round"
            paint-order="stroke"
          />
        </svg>
      </div>
      <!-- Astre (fond bleu nuit quand le soleil est couché) + hauteur dans le ciel -->
      <div
        class="relative flex h-9 w-9 items-center justify-center rounded-full shadow ring-1 ring-white/70"
        :style="markerBgStyle"
        :title="markerTitle"
      >
        <Icon
          :name="astreIconName"
          class="h-5 w-5 stroke-2"
          :style="{ color: markerIconColor }"
        />
        <span
          class="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded bg-base-100/95 px-1 text-[10px] font-semibold leading-tight tabular-nums shadow ring-1 ring-base-300"
        >
          {{ altitudeLabel }}
        </span>
      </div>
    </div>

    <!-- Panneau de contrôle (haut-droite), rétractable. On stoppe la propagation
         des events pointer/molette pour éviter que Leaflet ne pan/zoome la carte. -->
    <div
      class="pointer-events-auto absolute top-2 right-2"
      @pointerdown.stop
      @mousedown.stop
      @touchstart.stop
      @dblclick.stop
      @click.stop
      @wheel.stop
    >
      <!-- Rétracté : bouton icône -->
      <button
        v-if="collapsed"
        type="button"
        class="btn btn-circle btn-sm bg-base-100/95 shadow-lg ring-1 ring-base-300"
        :title="`Simulateur d'ensoleillement — ${currentTimeLabel}`"
        @click="collapsed = false"
      >
        <Icon
          :name="astreIconName"
          class="h-5 w-5 stroke-2"
          :style="{ color: panelIconColor }"
        />
      </button>

      <!-- Déployé : panneau complet -->
      <div
        v-else
        class="w-56 rounded-lg bg-base-100/95 p-3 shadow-lg ring-1 ring-base-300"
      >
        <div
          class="mb-1 flex items-center justify-between"
          title="Position estimée à la position de la falaise et à l'heure choisie"
        >
          <span class="flex items-center gap-1 text-sm font-semibold">
            <Icon
              :name="astreIconName"
              class="h-4 w-4 stroke-2"
              :style="{ color: panelIconColor }"
            />
            Position du soleil
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle"
            title="Réduire"
            @click="collapsed = true"
          >
            ✕
          </button>
        </div>

        <input
          type="date"
          class="input input-bordered input-xs mb-2 w-full"
          v-model="selectedDate"
        />

        <input
          type="range"
          class="range range-primary range-xs"
          min="0"
          max="1439"
          step="5"
          v-model.number="minutes"
        />

        <!-- Frise des périodes : nuit (bleu nuit) → crépuscule matin (violet→orange)
             → jour (orange) → crépuscule soir (orange→violet) → nuit -->
        <div
          class="relative mt-1 h-1.5 w-full overflow-hidden rounded-full"
          style="background-color: #1e293b"
          title="Périodes : nuit, crépuscules, jour"
        >
          <div
            v-if="dawnStyle"
            class="absolute inset-y-0"
            style="
              background-image: linear-gradient(to right, #8b5cf6, #fb923c);
            "
            :style="dawnStyle"
          ></div>
          <div
            v-if="dayStyle"
            class="absolute inset-y-0"
            style="background-color: #f5b301"
            :style="dayStyle"
          ></div>
          <div
            v-if="duskStyle"
            class="absolute inset-y-0"
            style="
              background-image: linear-gradient(to right, #fb923c, #8b5cf6);
            "
            :style="duskStyle"
          ></div>
        </div>

        <div class="mt-1 text-center text-sm font-medium tabular-nums">
          {{ currentTimeLabel }}
        </div>

        <div class="mt-1 flex justify-between text-xs opacity-80">
          <span class="flex items-center gap-1">
            <Icon
              name="sunrise"
              class="h-4 w-4 stroke-2"
              style="color: #f59e0b"
            />
            {{ fmtTime(times.sunrise) }}
          </span>
          <span class="flex items-center gap-1">
            <Icon
              name="sunset"
              class="h-4 w-4 stroke-2"
              style="color: #fb923c"
            />
            {{ fmtTime(times.sunset) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
