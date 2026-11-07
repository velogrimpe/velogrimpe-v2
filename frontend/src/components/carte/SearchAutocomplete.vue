<script setup lang="ts">
import { ref, computed } from "vue";
import Autocomplete from "@/components/shared/Autocomplete.vue";
import type { AutocompleteOption } from "@/types/autocomplete";
import Icon from "../shared/Icon.vue";

export interface SearchItem {
  id: number | string;
  type: "falaise" | "arret";
  name: string;
}

const props = defineProps<{
  falaises: Array<{ falaise_id: number; falaise_nom: string }>;
  arrets: Array<{ arret_id: number; arret_nom: string; types: string[] }>;
}>();

const emit = defineEmits<{
  select: [item: SearchItem];
}>();

const autocompleteRef = ref<InstanceType<typeof Autocomplete> | null>(null);
const searchValue = defineModel<string>({ default: "" });

function focus() {
  autocompleteRef.value?.focus();
}

defineExpose({ focus });

// Modalité affichée dans la liste : gare (ter/tgv) > tram > téléphérique > bus
const libelleModalite = (types: string[]) =>
  types.includes("ter") || types.includes("tgv")
    ? "gare"
    : types.includes("tram")
      ? "tram"
      : types.includes("telepherique")
        ? "téléphérique"
        : "bus";

const options = computed<AutocompleteOption[]>(() => {
  const falaiseOptions: AutocompleteOption[] = props.falaises.map((f) => ({
    value: `${f.falaise_nom} (falaise)`,
    label: `${f.falaise_nom} (falaise)`,
    data: { id: f.falaise_id, type: "falaise" as const, name: f.falaise_nom },
  }));

  const arretOptions: AutocompleteOption[] = props.arrets.map((a) => {
    const label = `${a.arret_nom} (${libelleModalite(a.types)})`;
    return {
      value: label,
      label,
      data: { id: a.arret_id, type: "arret" as const, name: a.arret_nom },
    };
  });

  return [...falaiseOptions, ...arretOptions];
});

function onSelect(option: AutocompleteOption) {
  if (option.data) {
    const item = option.data as SearchItem;
    emit("select", item);

    // Also dispatch a custom event for vanilla JS interop
    window.dispatchEvent(
      new CustomEvent("velogrimpe:search-select", {
        detail: item,
      }),
    );
  }
}
</script>

<template>
  <Autocomplete
    ref="autocompleteRef"
    v-model="searchValue"
    :options="options"
    placeholder="falaise/arrêt"
    @select="onSelect"
  >
    <template #icon>
      <Icon name="search" class="w-4 h-4" />
    </template>
  </Autocomplete>
</template>
