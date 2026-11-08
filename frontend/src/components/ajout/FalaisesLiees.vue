<script setup lang="ts">
/**
 * Liste des falaises liées à un arrêt de bus (formulaire ajout_arret.php).
 *
 * Alternative à la carte : une ligne par falaise liée (avec « délier »), et un
 * autocomplete pour en ajouter une sans avoir à la retrouver sur la carte.
 * Le composant ne tient aucun état de liaison : `linkedIds` lui est fourni et
 * les actions remontent en événements, l'état vivant dans le script carte de la
 * page (cf. `velogrimpe:bus-falaises-changed` dans ajout_arret.php).
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
    /**
     * Champs facultatifs de l'accès à pied de chaque falaise liée (description, km, D+, D-) :
     * `acces_pieton[<id>][description|km|dplus|dmoins]`, lus au submit par ajout-bus.ts
     * (`falaises_acces`). Pas de GPX ici (envoi JSON) : à ajouter ensuite depuis la fiche falaise.
     */
    accesDetails?: boolean;
  }>(),
  { falaises: () => [], linkedIds: () => [], accesDetails: false },
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
        class="flex flex-wrap items-center gap-2 py-1 pl-2 pr-1 rounded-lg border border-base-200 bg-base-100"
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
        <details v-if="accesDetails" class="basis-full pb-1 pr-1" :data-testid="`acces-details-${falaise.id}`">
          <summary class="text-xs cursor-pointer text-primary">
            Détails de l'accès à pied (optionnel)
          </summary>
          <div class="flex flex-col gap-2 mt-2">
            <textarea
              :name="`acces_pieton[${falaise.id}][description]`"
              rows="2"
              class="textarea textarea-sm leading-5 w-full"
              placeholder="Description : durée, sentier balisé ou non, passages délicats…"
            ></textarea>
            <div class="flex flex-wrap gap-2">
              <input
                type="number"
                :name="`acces_pieton[${falaise.id}][km]`"
                step="0.1"
                min="0"
                placeholder="km"
                aria-label="Distance (km)"
                class="input input-sm w-24"
              />
              <input
                type="number"
                :name="`acces_pieton[${falaise.id}][dplus]`"
                min="0"
                placeholder="D+ (m)"
                aria-label="D+ (m)"
                class="input input-sm w-24"
              />
              <input
                type="number"
                :name="`acces_pieton[${falaise.id}][dmoins]`"
                min="0"
                placeholder="D- (m)"
                aria-label="D- (m)"
                class="input input-sm w-24"
              />
            </div>
            <p class="text-xs text-slate-500 my-0">
              Une trace GPS peut être ajoutée ensuite depuis la fiche de la falaise.
            </p>
          </div>
        </details>
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
