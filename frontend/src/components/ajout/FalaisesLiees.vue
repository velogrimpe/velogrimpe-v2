<script setup lang="ts">
/**
 * Liste des falaises liées à un arrêt de bus (formulaire ajout_bus.php).
 *
 * Alternative à la carte : une ligne par falaise liée (avec « délier »), et un
 * autocomplete pour en ajouter une sans avoir à la retrouver sur la carte.
 * Le composant ne tient aucun état de liaison : `linkedIds` lui est fourni et
 * les actions remontent en événements, l'état vivant dans le script carte de la
 * page (cf. `velogrimpe:bus-falaises-changed` dans ajout_bus.php).
 */
import { computed, nextTick, ref } from "vue";
import FormAutocomplete, {
  type FormAutocompleteItem,
} from "@/components/shared/FormAutocomplete.vue";
import Icon from "@/components/shared/Icon.vue";

interface FalaiseItem extends FormAutocompleteItem {
  id: number;
  nom: string;
}

const props = withDefaults(
  defineProps<{
    falaises?: FalaiseItem[];
    linkedIds?: number[];
  }>(),
  { falaises: () => [], linkedIds: () => [] },
);

const emit = defineEmits<{
  link: [id: number];
  unlink: [id: number];
  center: [id: number];
}>();

const adding = ref(false);
const query = ref("");
const autocompleteRef = ref<{ focus: () => void } | null>(null);

const catalog = computed<Map<number, FalaiseItem>>(() => {
  const m = new Map<number, FalaiseItem>();
  for (const f of props.falaises) m.set(Number(f.id), f);
  return m;
});

const linked = computed<FalaiseItem[]>(() =>
  props.linkedIds.map(
    (id) => catalog.value.get(Number(id)) ?? { id, nom: `Falaise #${id}` },
  ),
);

// Une falaise déjà liée n'a pas à être proposée à l'ajout.
const options = computed<FalaiseItem[]>(() =>
  props.falaises.filter((f) => !props.linkedIds.includes(Number(f.id))),
);

async function openAdd() {
  adding.value = true;
  query.value = "";
  await nextTick();
  autocompleteRef.value?.focus();
}

function cancelAdd() {
  adding.value = false;
  query.value = "";
}

function onSelect(item: FormAutocompleteItem | null) {
  const falaise = item as FalaiseItem | null;
  if (!falaise) return;
  emit("link", Number(falaise.id));
  adding.value = false;
  query.value = "";
}
</script>

<template>
  <div class="not-prose flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <b class="text-sm">Falaises liées à cet arrêt</b>
      <span class="badge badge-sm badge-primary badge-outline">{{
        linked.length
      }}</span>
    </div>

    <p v-if="!linked.length" class="text-sm italic text-slate-400 my-0">
      Aucune falaise liée pour l'instant. Cliquez une falaise sur la carte, ou
      ajoutez-la ci-dessous.
    </p>

    <ul v-else class="flex flex-col gap-1 list-none pl-0 my-0">
      <li
        v-for="falaise in linked"
        :key="falaise.id"
        class="flex items-center gap-2 py-1 pl-2 pr-1 rounded-lg border border-base-200 bg-base-100"
      >
        <Icon name="map-pin" class="w-4 h-4 text-primary shrink-0" />
        <button
          type="button"
          class="grow text-left text-sm hover:underline"
          title="Centrer la carte sur cette falaise"
          @click="emit('center', falaise.id)"
        >
          {{ falaise.nom }}
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-circle text-error"
          :aria-label="`Délier ${falaise.nom}`"
          title="Délier cette falaise"
          @click="emit('unlink', falaise.id)"
        >
          <Icon name="close" class="w-4 h-4" />
        </button>
      </li>
    </ul>

    <div v-if="!adding">
      <button
        type="button"
        class="btn btn-sm btn-outline btn-primary"
        @click="openAdd"
      >
        + Lier une falaise
      </button>
    </div>
    <div v-else class="flex items-start gap-2">
      <div class="relative grow">
        <FormAutocomplete
          ref="autocompleteRef"
          v-model="query"
          :items="options"
          :accept-new-value="false"
          placeholder="Rechercher une falaise…"
          @select="onSelect"
        />
      </div>
      <button type="button" class="btn btn-sm btn-ghost" @click="cancelAdd">
        Annuler
      </button>
    </div>
  </div>
</template>
