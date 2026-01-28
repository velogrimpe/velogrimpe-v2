<script setup lang="ts">
import { computed } from "vue";
import Autocomplete from "@/components/shared/Autocomplete.vue";
import type { AutocompleteOption } from "@/types/autocomplete";
import Icon from "../shared/Icon.vue";

export interface SearchItem {
  id: number | string;
  type: "falaise" | "gare";
  name: string;
}

const props = defineProps<{
  falaises: Array<{ falaise_id: number; falaise_nom: string }>;
  gares: Array<{ gare_id: number; gare_nom: string }>;
}>();

const emit = defineEmits<{
  select: [item: SearchItem];
}>();

const searchValue = defineModel<string>({ default: "" });

const options = computed<AutocompleteOption[]>(() => {
  const falaiseOptions: AutocompleteOption[] = props.falaises.map((f) => ({
    value: `${f.falaise_nom} (falaise)`,
    label: `${f.falaise_nom} (falaise)`,
    data: { id: f.falaise_id, type: "falaise" as const, name: f.falaise_nom },
  }));

  const gareOptions: AutocompleteOption[] = props.gares.map((g) => ({
    value: `${g.gare_nom} (gare)`,
    label: `${g.gare_nom} (gare)`,
    data: { id: g.gare_id, type: "gare" as const, name: g.gare_nom },
  }));

  return [...falaiseOptions, ...gareOptions];
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
    v-model="searchValue"
    :options="options"
    placeholder="falaise/gare"
    @select="onSelect"
  >
    <template #icon>
      <Icon name="search" class="w-4 h-4" />
    </template>
  </Autocomplete>
</template>
