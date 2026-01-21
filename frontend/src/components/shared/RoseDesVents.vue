<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    expo1: string; // e.g., "'N','S','E'" or "N,S,E"
    expo2?: string;
    size?: number;
  }>(),
  {
    expo2: "",
    size: 60,
  },
);

// Direction order matching the SVG sectors (starting from East, going clockwise)
const directions = [
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSO",
  "SO",
  "OSO",
  "O",
  "ONO",
  "NO",
  "NNO",
  "N",
  "NNE",
  "NE",
  "ENE",
];

// Parse exposition string to array of directions
function parseExpo(expoStr: string): Set<string> {
  if (!expoStr) return new Set();
  const items = expoStr
    .replace(/'/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(items);
}

// Find implicit sub-sectors (e.g., if N and NE are selected, NNE is implicit)
function findImplicitSubSectors(expoSet: Set<string>): Set<string> {
  const subsectors = [
    { name: "ESE", needs: ["E", "SE"] },
    { name: "SSE", needs: ["SE", "S"] },
    { name: "SSO", needs: ["S", "SO"] },
    { name: "OSO", needs: ["SO", "O"] },
    { name: "ONO", needs: ["O", "NO"] },
    { name: "NNO", needs: ["NO", "N"] },
    { name: "NNE", needs: ["N", "NE"] },
    { name: "ENE", needs: ["NE", "E"] },
  ];
  const implicit = new Set<string>();
  for (const sub of subsectors) {
    if (sub.needs.every((n) => expoSet.has(n))) {
      implicit.add(sub.name);
    }
  }
  return implicit;
}

const expo1Set = computed(() => {
  const base = parseExpo(props.expo1);
  const implicit = findImplicitSubSectors(base);
  return new Set([...base, ...implicit]);
});

const expo2Set = computed(() => {
  const base = parseExpo(props.expo2);
  const implicit = findImplicitSubSectors(base);
  return new Set([...base, ...implicit]);
});

// Pre-computed sector paths (static geometry)
// Each sector is a triangle from center to two points on the outer edge
const radius = 120;
const innerRadius = radius * 0.6;
const numSectors = 16;
const angleStep = (2 * Math.PI) / numSectors;

interface SectorPath {
  direction: string;
  path1: string; // First half of sector
  path2: string; // Second half of sector
}

const sectors = computed<SectorPath[]>(() => {
  const result: SectorPath[] = [];

  for (let i = 0; i < numSectors; i++) {
    const angle = i * angleStep;
    const midAngle = angle + angleStep / 2;
    const nextAngle = angle + angleStep;

    // Radius varies based on cardinal/intercardinal direction
    const r = i % 4 === 0 ? radius : i % 2 === 0 ? radius * 0.9 : radius * 0.75;
    const rNext =
      (i + 1) % 4 === 0
        ? radius
        : (i + 1) % 2 === 0
          ? radius * 0.9
          : radius * 0.75;

    const x1 = Math.cos(angle) * r;
    const y1 = Math.sin(angle) * r;
    const xMid = Math.cos(midAngle) * innerRadius;
    const yMid = Math.sin(midAngle) * innerRadius;
    const x2 = Math.cos(nextAngle) * rNext;
    const y2 = Math.sin(nextAngle) * rNext;

    result.push({
      direction: directions[i],
      path1: `0,0 ${x1.toFixed(2)},${y1.toFixed(2)} ${xMid.toFixed(2)},${yMid.toFixed(2)}`,
      path2: `0,0 ${x2.toFixed(2)},${y2.toFixed(2)} ${xMid.toFixed(2)},${yMid.toFixed(2)}`,
    });
  }

  return result;
});

// Colors matching the original D3 implementation
const colors = {
  primary: "#1e5d3e",
  primaryStroke: "#2e8b57",
  secondary: "rgba(30, 93, 62, 0.5)",
  secondaryStroke: "rgba(46, 139, 87, 0.5)",
  inactive: "#eee",
  inactiveStroke: "#bbb",
};

function getSectorFill(direction: string, isSecondHalf: boolean): string {
  const checkDir = isSecondHalf
    ? directions[(directions.indexOf(direction) + 1) % 16]
    : direction;

  if (expo1Set.value.has(checkDir)) return colors.primary;
  if (expo2Set.value.has(checkDir)) return colors.secondary;
  return colors.inactive;
}

function getSectorStroke(direction: string, isSecondHalf: boolean): string {
  const checkDir = isSecondHalf
    ? directions[(directions.indexOf(direction) + 1) % 16]
    : direction;

  if (expo1Set.value.has(checkDir)) return colors.primaryStroke;
  if (expo2Set.value.has(checkDir)) return colors.secondaryStroke;
  return colors.inactiveStroke;
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="-150 -150 300 300"
    class="rose-des-vents"
  >
    <!-- Sectors -->
    <template v-for="sector in sectors" :key="sector.direction">
      <!-- First half of sector -->
      <polygon
        :points="sector.path1"
        :fill="getSectorFill(sector.direction, false)"
        :stroke="getSectorStroke(sector.direction, false)"
        stroke-width="1"
      />
      <!-- Second half of sector -->
      <polygon
        :points="sector.path2"
        :fill="getSectorFill(sector.direction, true)"
        :stroke="getSectorStroke(sector.direction, true)"
        stroke-width="1"
      />
    </template>

    <!-- Center circle -->
    <circle cx="0" cy="0" :r="innerRadius * 0.1" :fill="colors.primaryStroke" />
  </svg>
</template>

<style scoped>
.rose-des-vents polygon {
  transition: fill 0.2s ease;
}
</style>
