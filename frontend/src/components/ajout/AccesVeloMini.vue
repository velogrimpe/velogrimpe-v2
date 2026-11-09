<script setup lang="ts">
/**
 * Mini-formulaire « Ajouter un accès à vélo » du formulaire d'ajout de falaise : un itinéraire à vélo
 * depuis une gare ou un arrêt, créé avec la falaise (api/add_falaise.php, `acces_velo[...]`).
 *
 * Champs natifs du formulaire hôte (envoyés avec lui) : `acces_velo[actif|arret_id|km|dplus|dmoins|
 * variante|description]` et la trace GPX `acces_velo_gpx`. Distance, D+, D-, trace et arrêt sont
 * obligatoires (comme pour l'ajout d'un accès) ; variante et description facultatives. Tant que la case
 * « Ajouter un accès à vélo » est décochée (`enabled` faux), tous les champs sont désactivés : rien n'est
 * envoyé et rien ne bloque la validation du formulaire.
 */
import { ref, watch } from "vue";
import FormAutocomplete, {
  type FormAutocompleteItem,
} from "@/components/shared/FormAutocomplete.vue";
import Icon from "@/components/shared/Icon.vue";

interface ArretItem extends FormAutocompleteItem {
  id: number;
  nom: string;
}

const props = defineProps<{ arrets: ArretItem[]; enabled: boolean }>();

const query = ref("");
const arretId = ref("");

// Carte commune de la page (js/components/map/arrets-lies-map.js) : arrêt de départ et trace GPX choisis
const emitCarte = (kind: "changed" | "gpx", detail: unknown) =>
  document.dispatchEvent(new CustomEvent(`velogrimpe:acces-velo-${kind}`, { detail }));

function onSelect(item: FormAutocompleteItem | null) {
  arretId.value = item ? String(item.id) : "";
  emitCarte("changed", { id: item ? Number(item.id) : null });
}

// Aperçu de la trace : le texte du GPX choisi (la carte retire les <wpt>, comme le serveur)
function onGpxChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return emitCarte("gpx", { xml: null });
  const reader = new FileReader();
  reader.onload = () => emitCarte("gpx", { xml: String(reader.result) });
  reader.readAsText(file);
}

// Case décochée : plus rien à montrer sur la carte
watch(
  () => props.enabled,
  (actif) => {
    if (!actif) {
      emitCarte("changed", { id: null });
      emitCarte("gpx", { xml: null });
    } else if (arretId.value) {
      emitCarte("changed", { id: Number(arretId.value) });
    }
  },
);
</script>

<template>
  <div
    class="not-prose flex flex-col gap-3 p-3 rounded-lg border border-base-200 bg-base-100"
    data-testid="acces-velo-form"
  >
    <input type="hidden" name="acces_velo[actif]" value="1" :disabled="!enabled" />
    <input
      type="hidden"
      name="acces_velo[arret_id]"
      :value="arretId"
      :disabled="!enabled"
    />

    <label class="form-control">
      <b class="text-sm">Gare ou arrêt de départ</b>
      <!-- Rendu seulement quand la case est cochée : sinon sa liste de suggestions reste dans le DOM de la
           page et gêne tout autre autocomplete (la saisie reste conservée dans `query` / `arretId`). -->
      <FormAutocomplete
        v-if="enabled"
        v-model="query"
        :items="arrets"
        :accept-new-value="false"
        :required="true"
        placeholder="Rechercher une gare ou un arrêt…"
        @select="onSelect"
      >
        <template #icon>
          <Icon name="search" class="w-4 h-4 shrink-0" />
        </template>
      </FormAutocomplete>
    </label>

    <div class="flex flex-wrap gap-2">
      <label class="form-control grow basis-24">
        <b class="text-sm">Distance (km)</b>
        <input
          type="number"
          name="acces_velo[km]"
          step="0.01"
          min="0"
          placeholder="12.5"
          class="input input-sm input-primary"
          :disabled="!enabled"
          :required="enabled"
        />
      </label>
      <label class="form-control grow basis-24">
        <b class="text-sm">D+ (m)</b>
        <input
          type="number"
          name="acces_velo[dplus]"
          min="0"
          placeholder="650"
          class="input input-sm input-primary"
          :disabled="!enabled"
          :required="enabled"
        />
      </label>
      <label class="form-control grow basis-24">
        <b class="text-sm">D- (m)</b>
        <input
          type="number"
          name="acces_velo[dmoins]"
          min="0"
          placeholder="650"
          class="input input-sm input-primary"
          :disabled="!enabled"
          :required="enabled"
        />
      </label>
    </div>

    <label class="form-control">
      <b class="text-sm">Trace GPS</b>
      <input
        type="file"
        name="acces_velo_gpx"
        accept=".gpx"
        class="file-input file-input-sm file-input-primary"
        :disabled="!enabled"
        :required="enabled"
        @change="onGpxChange"
      />
      <i class="text-xs text-slate-500">Au format GPX. Les éventuels marqueurs (début, fin…) sont retirés à l'enregistrement.</i>
    </label>

    <label class="form-control">
      <b class="text-sm">Nom de la variante <span class="text-accent opacity-50">(optionnel)</span></b>
      <input
        type="text"
        name="acces_velo[variante]"
        maxlength="100"
        class="input input-sm"
        :disabled="!enabled"
      />
      <i class="text-xs text-slate-500">Utile s'il existera plusieurs itinéraires depuis cet arrêt. Ex : « Option par le Nord ».</i>
    </label>

    <label class="form-control">
      <b class="text-sm">Description <span class="text-accent opacity-50">(optionnel)</span></b>
      <textarea
        name="acces_velo[description]"
        rows="3"
        class="textarea textarea-sm leading-5"
        placeholder="Surface, trafic, montées raides, voie verte…"
        :disabled="!enabled"
      ></textarea>
    </label>
  </div>
</template>
