<script setup lang="ts">
/**
 * Import GTFS depuis admin/arrets_lignes.php : zip GTFS → choix de la route → géométrie (shapes.txt) + plan
 * d'import des arrêts (mêmes règles que ajout_ligne.php : gtfs-match.ts), présenté en bilan (créés / regroupés /
 * liés / retirés) ; rien n'est écrit avant « Confirmer l'import », qui envoie l'ensemble à api/add_ligne.php.
 *  - mise à jour d'une ligne existante : remplace la géométrie et les arrêts liés, ses infos de base sont conservées ;
 *  - création (`ligneId` null, bouton « + » des lignes) : les infos de base viennent de la route GTFS choisie.
 *
 * Intégration PHP ↔ Vue : le JS de la page ouvre le dialog (`velogrimpe:gtfs-import-open`, detail.ligneId : id ou
 * null pour une création) et se recharge à la fin (`velogrimpe:gtfs-import-done`). Le catalogue d'arrêts vient du
 * JSON `#page-data`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import GtfsComparaison from "@/components/ajout/GtfsComparaison.vue";
import { compareGtfsStops, planItemEffect, type ArretGeo, type GtfsDiff } from "@/utils/gtfs-match";
import {
  MAX_GTFS_ZIP_BYTES,
  listRouteStopPairs,
  listRouteStops,
  listRoutes,
  readGtfs,
  routeModalites,
  routeToLigneFields,
  shapesToMultiLineString,
  type GtfsFeed,
  type GtfsRoute,
  type MultiLineString,
} from "@/utils/gtfs";

interface PageArret {
  id: number;
  nom: string;
  lat: number;
  lng: number;
  types: string[];
  deleted: boolean;
  nb_enfants: number;
  gtfsRefs: string[];
}
interface Ligne {
  id: number;
  nom: string;
  numero: string | null;
  operateur: string | null;
  operateur_url: string | null;
  horaire_url: string | null;
  ref: string | null;
  couleur: string | null;
  geometry: MultiLineString | null;
}

const page = JSON.parse(document.getElementById("page-data")!.textContent!) as { arrets: PageArret[]; token: string };
// Arrêts sélectionnables pour une ligne : orphelins et enfants, jamais les parents ni les supprimés
const catalog: ArretGeo[] = page.arrets
  .filter((a) => !a.deleted && a.nb_enfants === 0)
  .map((a) => ({ id: a.id, nom: a.nom, lat: a.lat, lng: a.lng, types: a.types, gtfsRefs: a.gtfsRefs }));

const dlg = ref<HTMLDialogElement | null>(null);
const ligne = ref<Ligne | null>(null); // null : création
const creation = ref(false);
const nouvelleLigne = ref<Omit<Ligne, "id" | "geometry"> | null>(null); // infos de base de la route GTFS (création)
const arretIds = ref<number[]>([]);
const feed = ref<GtfsFeed | null>(null);
const routes = ref<GtfsRoute[]>([]);
const routeIdx = ref("");
const error = ref<string | null>(null);
const diff = ref<GtfsDiff | null>(null);
const diffKey = ref(0); // nouvelle clé à chaque analyse : l'état des cases repart de zéro
const geometry = ref<MultiLineString | null>(null);
const types = ref<string[]>(["bus"]);
const busy = ref(false);
const reading = ref(false); // lecture du zip
const analysing = ref(false); // calcul du bilan
const fileInput = ref<HTMLInputElement | null>(null);

const libelle = (l: { numero: string | null; nom: string }) => `${l.numero ? l.numero + " — " : ""}${l.nom}`;
const titre = computed(() => (creation.value ? "nouvelle ligne" : ligne.value ? libelle(ligne.value) : ""));
const ready = computed(() => creation.value || !!ligne.value); // ligne chargée (mise à jour) ou création
const working = computed(() => busy.value || reading.value || analysing.value);

// Laisse le navigateur afficher le spinner avant un calcul synchrone lourd
const repaint = async () => {
  await nextTick();
  await new Promise<void>((r) => setTimeout(r, 30));
};

function reset() {
  feed.value = null;
  routes.value = [];
  routeIdx.value = "";
  error.value = null;
  diff.value = null;
  geometry.value = null;
  nouvelleLigne.value = null;
  busy.value = false;
  reading.value = false;
  analysing.value = false;
  if (fileInput.value) fileInput.value.value = "";
}

async function open(ligneId: number | null) {
  reset();
  ligne.value = null;
  arretIds.value = [];
  creation.value = ligneId === null;
  dlg.value?.showModal();
  if (ligneId === null) return;
  try {
    const r = await fetch(`/api/fetch_ligne.php?ligne_id=${ligneId}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    ligne.value = data.ligne;
    arretIds.value = data.arret_ids;
  } catch (e) {
    error.value = `Ligne illisible : ${e instanceof Error ? e.message : e}`;
  }
}
const onOpen = (e: Event) => open((e as CustomEvent<{ ligneId: number | null }>).detail.ligneId);
onMounted(() => document.addEventListener("velogrimpe:gtfs-import-open", onOpen));
onBeforeUnmount(() => document.removeEventListener("velogrimpe:gtfs-import-open", onOpen));

function close() {
  dlg.value?.close();
  reset();
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  feed.value = null;
  routes.value = [];
  routeIdx.value = "";
  diff.value = null;
  error.value = null;
  if (!file) return;
  if (file.size > MAX_GTFS_ZIP_BYTES) {
    error.value = `Ce fichier fait ${(file.size / 1024 / 1024).toFixed(1)} Mo : au-delà de ${MAX_GTFS_ZIP_BYTES / 1024 / 1024} Mo, l'analyse est trop lourde pour le navigateur. Prenez un GTFS plus restreint (transport.data.gouv.fr) ou filtrez-le à la ligne voulue.`;
    return;
  }
  reading.value = true;
  await repaint();
  try {
    feed.value = readGtfs(new Uint8Array(await file.arrayBuffer()));
    routes.value = listRoutes(feed.value);
  } catch (err) {
    feed.value = null;
    error.value = `Fichier GTFS illisible : ${err instanceof Error ? err.message : err}`;
    return;
  } finally {
    reading.value = false;
  }
  // Route du même numéro que la ligne, si elle est unique
  const memeNumero = routes.value.flatMap((r, i) => (ligne.value?.numero && r.numero === ligne.value.numero ? [i] : []));
  if (memeNumero.length === 1) routeIdx.value = String(memeNumero[0]);
}

async function analyser() {
  const route = routes.value[Number(routeIdx.value)];
  if (!feed.value || !route || !ready.value || working.value) return;
  analysing.value = true;
  diff.value = null;
  error.value = null;
  await repaint();
  try {
    const stops = listRouteStops(feed.value, route);
    if (!stops.length) {
      error.value = "Aucun arrêt trouvé pour cette ligne dans le GTFS (stops.txt / stop_times.txt).";
      return;
    }
    types.value = routeModalites(route);
    geometry.value = shapesToMultiLineString(feed.value.shapesText, route.shapeIds);
    const { nom, numero, operateur, operateur_url, horaire_url, ref, couleur } = routeToLigneFields(feed.value, route);
    nouvelleLigne.value = { nom, numero, operateur, operateur_url, horaire_url, ref, couleur };
    const linkedIds = new Set(arretIds.value);
    diffKey.value++;
    diff.value = compareGtfsStops(
      stops,
      catalog.filter((a) => linkedIds.has(a.id)),
      catalog,
      { stopTypes: types.value, consecutive: listRouteStopPairs(feed.value, route) },
    );
  } catch (err) {
    error.value = `Analyse impossible : ${err instanceof Error ? err.message : err}`;
  } finally {
    analysing.value = false;
  }
}

/** Applique la sélection au jeu d'arrêts de la ligne et envoie le tout à api/add_ligne.php (édition). */
async function confirmer(sel: { added: number[]; removed: number[] }) {
  const d = diff.value;
  // Création : infos de base de la route GTFS ; mise à jour : celles de la ligne, conservées
  const l = creation.value ? nouvelleLigne.value : ligne.value;
  if (!d || !l || busy.value) return;
  const ids = new Set(arretIds.value);
  const refs: Record<string, unknown>[] = [];
  const nouveaux: Record<string, unknown>[] = [];
  d.served.forEach((s) =>
    refs.push({ arret_id: s.arret.id, stop_id: s.stop.id, nom: s.stop.nom, ...(s.by === "id" ? { lat: s.stop.lat, lng: s.stop.lng } : {}) }),
  );
  sel.added.forEach((i) => {
    const e = planItemEffect(d.added[i]!.item, types.value);
    if (e.kind === "link") {
      ids.add(e.arretId);
      refs.push({ arret_id: e.arretId, stop_id: e.stopId, nom: e.nom, ...(e.pos ?? {}) });
    } else {
      nouveaux.push({ nom: e.nom, lat: e.lat, lng: e.lng, types: e.types, stop_id: e.key.slice("gtfs:".length), ...e.extra });
    }
  });
  sel.removed.forEach((i) => ids.delete(d.removed[i]!.id));

  busy.value = true;
  try {
    const res = await fetch("/api/add_ligne.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${page.token}` },
      body: JSON.stringify({
        ligne_id: ligne.value?.id ?? null,
        nom: l.nom,
        numero: l.numero ?? "",
        operateur: l.operateur ?? "",
        operateur_url: l.operateur_url ?? "",
        horaire_url: l.horaire_url ?? "",
        ref: l.ref ?? "",
        couleur: l.couleur ?? "",
        // Sans shapes.txt dans le GTFS, le tracé actuel est conservé
        geometry: geometry.value ?? ligne.value?.geometry ?? null,
        arret_ids: [...ids],
        nouveaux_arrets: nouveaux,
        gtfs_refs: refs,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) throw new Error(body.error || `HTTP ${res.status}`);
    document.dispatchEvent(new CustomEvent("velogrimpe:gtfs-import-done"));
  } catch (err) {
    error.value = `Import impossible : ${err instanceof Error ? err.message : err}`;
    busy.value = false;
  }
}
</script>

<template>
  <dialog ref="dlg" class="modal" @cancel.prevent="close">
    <div class="modal-box w-11/12 max-w-3xl flex flex-col gap-3">
      <h3 class="font-bold text-lg">Import GTFS<span v-if="titre"> : {{ titre }}</span></h3>
      <p v-if="creation" class="text-sm opacity-70">
        La ligne est créée à partir de la route GTFS choisie : nom, numéro, couleur, référence, opérateur, site et horaires,
        tracé et arrêts.
      </p>

      <label class="form-control">
        <b class="text-sm">Archive GTFS (.zip)</b>
        <input
          ref="fileInput"
          type="file"
          accept=".zip,application/zip"
          class="file-input file-input-sm file-input-primary w-full"
          :disabled="!ready || working"
          data-testid="gtfs-file"
          @change="onFile"
        />
        <span v-if="reading" class="text-sm flex items-center gap-2 mt-1" data-testid="gtfs-reading">
          <span class="loading loading-spinner loading-xs"></span> Lecture du fichier…
        </span>
      </label>

      <div v-if="error" class="alert alert-error text-sm" role="alert">{{ error }}</div>

      <div v-if="routes.length" class="flex gap-2 items-end">
        <label class="form-control grow">
          <b class="text-sm">Ligne du GTFS</b>
          <select v-model="routeIdx" class="select select-sm select-primary w-full" data-testid="gtfs-route">
            <option value="">Choisir une ligne…</option>
            <option v-for="(r, i) in routes" :key="r.id" :value="String(i)">{{ r.numero ? r.numero + " — " : "" }}{{ r.nom }}</option>
          </select>
        </label>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="routeIdx === '' || working"
          data-testid="gtfs-analyser"
          @click="analyser"
        >
          <span v-if="analysing" class="loading loading-spinner loading-xs"></span>
          {{ analysing ? "Analyse…" : "Analyser" }}
        </button>
      </div>

      <template v-if="diff">
        <p v-if="creation && nouvelleLigne" class="text-sm" data-testid="gtfs-nouvelle-ligne">
          <b>Ligne créée :</b> {{ libelle(nouvelleLigne) }}<template v-if="nouvelleLigne.operateur"> ({{ nouvelleLigne.operateur }})</template>.
        </p>
        <p class="text-sm" data-testid="gtfs-geometry">
          <b>Tracé :</b>
          <template v-if="geometry">remplacé par celui du GTFS ({{ geometry.coordinates.length }} segment(s)).</template>
          <template v-else>pas de shapes.txt pour cette ligne dans le GTFS : le tracé actuel est conservé.</template>
        </p>
        <GtfsComparaison
          :key="diffKey"
          :diff="diff"
          :apply-label="creation ? 'Créer la ligne' : 'Confirmer l\'import'"
          note="Rien n'est enregistré avant la confirmation. Les arrêts retirés ne sont pas supprimés, seulement déliés de la ligne."
          remove-by-default
          :busy="busy"
          @apply="confirmer"
          @close="close"
        />
      </template>

      <div class="modal-action mt-0">
        <button type="button" class="btn btn-sm" :disabled="busy" @click="close">Fermer</button>
      </div>
    </div>
  </dialog>
</template>
