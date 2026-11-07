<script setup lang="ts">
/**
 * Liste des arrêts liés à une ligne BTT (formulaire ajout_ligne.php).
 *
 * Alternative à la carte : une ligne par arrêt lié (avec « retirer »), et un
 * autocomplete pour en ajouter une sans avoir à la retrouver sur la carte.
 * Le composant ne tient aucun état de liaison : `linkedIds` lui est fourni et
 * les actions remontent en événements, l'état vivant dans le script carte de la
 * page (cf. `velogrimpe:ligne-arrets-changed` dans ajout_ligne.php).
 */
import { computed, nextTick, ref } from "vue";
import FormAutocomplete, {
  type FormAutocompleteItem,
} from "@/components/shared/FormAutocomplete.vue";
import Icon from "@/components/shared/Icon.vue";

interface ArretItem extends FormAutocompleteItem {
  id: number;
  nom: string;
}

const props = withDefaults(
  defineProps<{
    arrets?: ArretItem[];
    linkedIds?: number[];
    /** Arrêts à créer à l'envoi (import GTFS), pas encore en base. */
    nouveaux?: Array<{ key: string; nom: string }>;
    /** Libellés propres au formulaire hôte (par défaut : ceux d'une ligne). */
    titre?: string;
    vide?: string;
  }>(),
  {
    arrets: () => [],
    linkedIds: () => [],
    nouveaux: () => [],
    titre: "Arrêts desservis par cette ligne",
    vide: "Aucun arrêt lié pour l'instant. Cliquez un arrêt sur la carte, ou ajoutez-le ci-dessous.",
  },
);

const emit = defineEmits<{
  link: [id: number];
  unlink: [id: number];
  unlinkNouveau: [key: string];
  center: [id: number];
}>();

const adding = ref(false);
const query = ref("");
const autocompleteRef = ref<{ focus: () => void } | null>(null);

const catalog = computed<Map<number, ArretItem>>(() => {
  const m = new Map<number, ArretItem>();
  for (const f of props.arrets) m.set(Number(f.id), f);
  return m;
});

const linked = computed<ArretItem[]>(() =>
  props.linkedIds.map(
    (id) => catalog.value.get(Number(id)) ?? { id, nom: `Arrêt #${id}` },
  ),
);

// Un arrêt déjà lié n'a pas à être proposé à l'ajout.
const options = computed<ArretItem[]>(() =>
  props.arrets.filter((f) => !props.linkedIds.includes(Number(f.id))),
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
  const arret = item as ArretItem | null;
  if (!arret) return;
  emit("link", Number(arret.id));
  adding.value = false;
  query.value = "";
}
</script>

<template>
  <div class="not-prose flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <b class="text-sm">{{ titre }}</b>
      <span class="badge badge-sm badge-primary badge-outline">{{
        linked.length + nouveaux.length
      }}</span>
    </div>

    <p v-if="!linked.length && !nouveaux.length" class="text-sm italic text-slate-400 my-0">
      {{ vide }}
    </p>

    <ul v-else class="flex flex-col gap-1 list-none pl-0 my-0">
      <li
        v-for="n in nouveaux"
        :key="n.key"
        class="flex items-center gap-2 py-1 pl-2 pr-1 rounded-lg border border-dashed border-primary bg-base-100"
      >
        <Icon name="map-pin" class="w-4 h-4 text-primary shrink-0" />
        <span class="grow text-sm">{{ n.nom }}</span>
        <span class="badge badge-sm badge-primary">nouvel arrêt</span>
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-circle text-error"
          :aria-label="`Retirer ${n.nom}`"
          title="Retirer cet arrêt"
          @click="emit('unlinkNouveau', n.key)"
        >
          <Icon name="close" class="w-4 h-4" />
        </button>
      </li>
      <li
        v-for="arret in linked"
        :key="arret.id"
        class="flex items-center gap-2 py-1 pl-2 pr-1 rounded-lg border border-base-200 bg-base-100"
      >
        <Icon name="map-pin" class="w-4 h-4 text-primary shrink-0" />
        <button
          type="button"
          class="grow text-left text-sm hover:underline"
          title="Centrer la carte sur cet arrêt"
          @click="emit('center', arret.id)"
        >
          {{ arret.nom }}
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-circle text-error"
          :aria-label="`Retirer ${arret.nom}`"
          title="Retirer cet arrêt"
          @click="emit('unlink', arret.id)"
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
        + Lier un arrêt
      </button>
    </div>
    <div v-else class="flex items-start gap-2">
      <div class="relative grow">
        <FormAutocomplete
          ref="autocompleteRef"
          v-model="query"
          :items="options"
          :accept-new-value="false"
          placeholder="Rechercher un arrêt…"
          @select="onSelect"
        />
      </div>
      <button type="button" class="btn btn-sm btn-ghost" @click="cancelAdd">
        Annuler
      </button>
    </div>
  </div>
</template>
