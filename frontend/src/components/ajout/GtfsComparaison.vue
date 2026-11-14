<script setup lang="ts">
/**
 * Aperçu de mise à jour des arrêts d'une ligne depuis un GTFS rechargé (ajout_ligne.php, mode édition) :
 * toujours desservis / nouveaux / absents du GTFS. Rien n'est écrit ici : « Appliquer » remonte la
 * sélection, le formulaire la répercute sur les liaisons, et tout est enregistré à l'envoi du formulaire.
 */
import { reactive } from "vue";
import { describePlanItem, type GtfsDiff } from "@/utils/gtfs-match";

const props = defineProps<{ diff: GtfsDiff }>();
const emit = defineEmits<{
  apply: [sel: { added: number[]; removed: number[] }];
  close: [];
}>();

// Nouveaux : cochés par défaut (ajoutés) ; absents : décochés par défaut (retrait à confirmer)
const addedChecked = reactive(props.diff.added.map(() => true));
const removedChecked = reactive(props.diff.removed.map(() => false));

const apply = () =>
  emit("apply", {
    added: addedChecked.flatMap((c, i) => (c ? [i] : [])),
    removed: removedChecked.flatMap((c, i) => (c ? [i] : [])),
  });
</script>

<template>
  <div class="flex flex-col gap-3 rounded-lg border border-base-300 p-3 text-sm" data-testid="gtfs-diff">
    <b>Comparaison avec le GTFS</b>

    <details>
      <summary class="cursor-pointer">Toujours desservis ({{ diff.served.length }})</summary>
      <ul class="mt-1 ml-4 list-disc">
        <li v-for="s in diff.served" :key="s.arret.id">
          {{ s.arret.nom }}
          <span v-if="s.arret.nom !== s.stop.nom" class="opacity-60">(GTFS : {{ s.stop.nom }})</span>
        </li>
      </ul>
    </details>

    <div>
      <b class="text-success">Nouveaux ({{ diff.added.length }})</b>
      <p v-if="!diff.added.length" class="opacity-60">Aucun nouvel arrêt.</p>
      <label v-for="(a, i) in diff.added" :key="a.stop.id" class="flex items-center gap-2 py-0.5 cursor-pointer">
        <input v-model="addedChecked[i]" type="checkbox" class="checkbox checkbox-xs" />
        <span>{{ a.stop.nom }}</span>
        <span class="badge badge-xs" :class="a.arret ? 'badge-ghost' : 'badge-success'">
          {{ a.arret ? `lier à « ${a.arret.nom} » (#${a.arret.id})` : describePlanItem(a.item) }}
        </span>
      </label>
    </div>

    <div :class="diff.removed.length ? 'rounded-md bg-warning/20 p-2' : ''">
      <b class="text-warning-content">Absents du GTFS ({{ diff.removed.length }})</b>
      <p v-if="!diff.removed.length" class="opacity-60">Tous les arrêts de la ligne sont dans le GTFS.</p>
      <p v-else class="opacity-70">
        Probablement plus desservis. Cochez ceux à retirer de la ligne (l'arrêt lui-même n'est pas supprimé).
      </p>
      <label v-for="(a, i) in diff.removed" :key="a.id" class="flex items-center gap-2 py-0.5 cursor-pointer">
        <input v-model="removedChecked[i]" type="checkbox" class="checkbox checkbox-xs checkbox-warning" />
        <span>{{ a.nom }}</span>
        <span class="opacity-60">#{{ a.id }}</span>
      </label>
    </div>

    <div class="flex gap-2">
      <button type="button" class="btn btn-sm btn-primary" @click="apply">Appliquer au formulaire</button>
      <button type="button" class="btn btn-sm btn-ghost" @click="emit('close')">Fermer</button>
    </div>
    <i class="opacity-70">Rien n'est enregistré avant « Modifier la ligne ».</i>
  </div>
</template>
