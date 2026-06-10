<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from "vue";
import FormAutocomplete, {
  type FormAutocompleteItem,
} from "@/components/shared/FormAutocomplete.vue";
import RichTextField from "@/components/shared/RichTextField.vue";

interface ArretItem extends FormAutocompleteItem {
  id: number;
  nom: string;
}
interface LigneItem extends FormAutocompleteItem {
  id: number;
  nom: string;
  description?: string;
  lien?: string;
}
interface LiaisonRow {
  uid: number;
  persistedId: number | null;
  arret2Id: number | null;
  arret2Nom: string;
  ligneId: number | null;
  ligneNom: string;
  description: string;
}
interface LigneRow {
  key: string;
  id: number | null;
  nom: string;
  description: string;
  lien: string;
}

const props = withDefaults(
  defineProps<{
    arrets?: ArretItem[];
    lignes?: LigneItem[];
    excludeArretId?: number | null;
  }>(),
  { arrets: () => [], lignes: () => [], excludeArretId: null },
);

let uidCounter = 1;
const liaisons = ref<LiaisonRow[]>([]);
// Source de vérité des données éditables des lignes, indexée par clé de ligne.
const ligneMap = reactive<Record<string, LigneRow>>({});

// Refs des éditeurs RichText (pour l'hydratation en mode édition).
const liaisonDescRefs = reactive<
  Record<number, { setContent: (h: string) => void } | null>
>({});
const ligneDescRefs = reactive<
  Record<string, { setContent: (h: string) => void } | null>
>({});

// Catalogue des lignes existantes (utilisé pour préremplir nom/description/lien).
const ligneCatalog = computed<Record<number, LigneItem>>(() => {
  const m: Record<number, LigneItem> = {};
  for (const l of props.lignes) m[l.id] = l;
  return m;
});

const arretOptions = computed<ArretItem[]>(() =>
  props.arrets.filter((a) => a.id !== props.excludeArretId),
);

function ligneKeyOf(row: LiaisonRow): string {
  if (row.ligneId != null) return `id:${row.ligneId}`;
  const n = row.ligneNom.trim().toLowerCase();
  return n ? `new:${n}` : "";
}

// Clés de lignes référencées par au moins une liaison.
const referencedKeys = computed<string[]>(() => {
  const set = new Set<string>();
  for (const r of liaisons.value) {
    const k = ligneKeyOf(r);
    if (k) set.add(k);
  }
  return Array.from(set);
});

const visibleLignes = computed<LigneRow[]>(() =>
  referencedKeys.value.map((k) => ligneMap[k]).filter(Boolean),
);

// Réconcilie ligneMap avec les lignes effectivement référencées.
watch(
  referencedKeys,
  (keys) => {
    const keySet = new Set(keys);
    // Créer les entrées manquantes
    for (const k of keys) {
      if (ligneMap[k]) continue;
      if (k.startsWith("id:")) {
        const id = Number(k.slice(3));
        const cat = ligneCatalog.value[id];
        ligneMap[k] = {
          key: k,
          id,
          nom: cat?.nom ?? "",
          description: cat?.description ?? "",
          lien: cat?.lien ?? "",
        };
      } else {
        // new:<nom>
        const row = liaisons.value.find((r) => ligneKeyOf(r) === k);
        ligneMap[k] = {
          key: k,
          id: null,
          nom: row?.ligneNom ?? "",
          description: "",
          lien: "",
        };
      }
    }
    // Supprimer les entrées orphelines
    for (const k of Object.keys(ligneMap)) {
      if (!keySet.has(k)) delete ligneMap[k];
    }
  },
  { deep: true },
);

function addLiaison() {
  liaisons.value.push({
    uid: uidCounter++,
    persistedId: null,
    arret2Id: null,
    arret2Nom: "",
    ligneId: null,
    ligneNom: "",
    description: "",
  });
}

async function removeLiaison(row: LiaisonRow) {
  if (row.persistedId != null) {
    const nom_prenom =
      (document.getElementById("nom_prenom") as HTMLInputElement)?.value ?? "";
    const email =
      (document.getElementById("email") as HTMLInputElement)?.value ?? "";
    try {
      const res = await fetch("/api/delete_bus_liaison.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liaison_id: row.persistedId,
          nom_prenom,
          email,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(
          "Erreur lors de la suppression de la liaison : " +
            (err.error || res.status),
        );
        return;
      }
    } catch (e) {
      alert("Erreur réseau lors de la suppression de la liaison.");
      return;
    }
  }
  const idx = liaisons.value.indexOf(row);
  if (idx >= 0) liaisons.value.splice(idx, 1);
}

function onArretSelect(row: LiaisonRow, item: FormAutocompleteItem | null) {
  const a = item as ArretItem | null;
  row.arret2Id = a ? a.id : null;
  row.arret2Nom = a ? a.nom : "";
}

function onLigneSelect(
  row: LiaisonRow,
  item: FormAutocompleteItem | null,
  value: string,
) {
  const l = item as LigneItem | null;
  if (l) {
    row.ligneId = l.id;
    row.ligneNom = l.nom;
  } else {
    row.ligneId = null;
    row.ligneNom = value;
  }
}

// --- API exposée à ajout-bus.ts ---
function getLignes() {
  return visibleLignes.value.map((l) => ({
    id: l.id,
    key: l.key,
    nom: l.nom,
    description: l.description,
    lien: l.lien,
  }));
}

function getLiaisons() {
  return liaisons.value
    .filter((r) => r.arret2Id && ligneKeyOf(r))
    .map((r) => ({
      id: r.persistedId,
      arret_2_id: r.arret2Id,
      ligne_key: ligneKeyOf(r),
      description: r.description,
    }));
}

interface HydrateData {
  lignes: { id: number; nom: string; description: string; lien: string }[];
  liaisons: {
    id: number;
    arret_2_id: number;
    arret_2_nom: string;
    ligne_id: number;
    ligne_nom: string;
    description: string;
  }[];
}

async function hydrate(data: HydrateData) {
  // Pré-charger les données éditables des lignes existantes.
  for (const l of data.lignes || []) {
    const k = `id:${l.id}`;
    ligneMap[k] = {
      key: k,
      id: l.id,
      nom: l.nom,
      description: l.description || "",
      lien: l.lien || "",
    };
  }
  liaisons.value = (data.liaisons || []).map((li) => ({
    uid: uidCounter++,
    persistedId: li.id,
    arret2Id: li.arret_2_id,
    arret2Nom: li.arret_2_nom,
    ligneId: li.ligne_id,
    ligneNom: li.ligne_nom,
    description: li.description || "",
  }));
  // Injecter le contenu HTML dans les éditeurs RichText une fois rendus.
  await nextTick();
  for (const r of liaisons.value) {
    liaisonDescRefs[r.uid]?.setContent(r.description);
  }
  for (const l of visibleLignes.value) {
    ligneDescRefs[l.key]?.setContent(l.description);
  }
}

defineExpose({ getLignes, getLiaisons, hydrate, addLiaison });
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- ===== Section Liaisons ===== -->
    <div>
      <div class="relative flex items-center mb-3">
        <hr class="my-0 grow border-[#2e8b57]" />
        <span class="px-2 text-primary italic"
          >Arrêts reliés (terminus, gares)</span
        >
        <hr class="my-0 grow border-[#2e8b57]" />
      </div>

      <div class="flex flex-col gap-4">
        <div
          v-for="row in liaisons"
          :key="row.uid"
          class="relative bg-base-100 p-4 rounded-lg border border-base-200 shadow-xs"
        >
          <button
            type="button"
            class="btn btn-xs btn-ghost btn-circle absolute top-2 right-2 text-error"
            title="Supprimer cette liaison"
            @click="removeLiaison(row)"
          >
            <svg
              class="w-4 h-4 fill-none stroke-current"
              viewBox="0 0 24 24"
              stroke-width="2"
            >
              <use href="#trash" />
            </svg>
          </button>

          <div class="flex flex-col gap-3 pr-6">
            <div class="flex flex-col md:flex-row md:items-end gap-2 flex-wrap">
              <span class="font-bold">Cet arrêt est relié à</span>
              <div class="relative not-prose grow min-w-[12rem]">
                <FormAutocomplete
                  :model-value="row.arret2Nom"
                  :items="arretOptions"
                  :accept-new-value="false"
                  placeholder="Arrêt existant…"
                  @update:model-value="(v: string) => (row.arret2Nom = v)"
                  @select="
                    (item: FormAutocompleteItem | null) =>
                      onArretSelect(row, item)
                  "
                />
              </div>
              <span class="font-bold">par la ligne</span>
              <div class="relative not-prose grow min-w-[12rem]">
                <FormAutocomplete
                  :model-value="row.ligneNom"
                  :items="props.lignes"
                  :accept-new-value="true"
                  placeholder="Ligne (ex: Zou! L12)…"
                  @update:model-value="(v: string) => (row.ligneNom = v)"
                  @select="
                    (item: FormAutocompleteItem | null, value: string) =>
                      onLigneSelect(row, item, value)
                  "
                />
              </div>
            </div>
            <div class="form-control">
              <span class="text-sm font-bold"
                >Détail sur la liaison
                <i class="opacity-50 font-normal">(optionnel)</i></span
              >
              <RichTextField
                :ref="(el: any) => (liaisonDescRefs[row.uid] = el)"
                :name="`liaison_desc_${row.uid}`"
                v-model="row.description"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-sm btn-outline btn-primary mt-3"
        @click="addLiaison"
      >
        + Ajouter une autre liaison
      </button>
    </div>

    <!-- ===== Section Lignes de bus ===== -->
    <div v-if="visibleLignes.length">
      <div class="relative flex items-center mb-3">
        <hr class="my-0 grow border-[#2e8b57]" />
        <span class="px-2 text-primary italic">Lignes de bus</span>
        <hr class="my-0 grow border-[#2e8b57]" />
      </div>

      <div class="flex flex-col gap-4">
        <div
          v-for="ligne in visibleLignes"
          :key="ligne.key"
          class="bg-base-100 p-4 rounded-lg border border-base-200 shadow-xs flex flex-col gap-3"
        >
          <div class="flex items-center gap-2">
            <span class="badge badge-primary badge-sm">{{
              ligne.id ? "Ligne existante" : "Nouvelle ligne"
            }}</span>
          </div>
          <label class="form-control">
            <span class="text-sm font-bold">Nom de la ligne</span>
            <input
              type="text"
              class="input input-primary input-sm"
              v-model="ligne.nom"
              placeholder="ex: Zou! L12"
            />
          </label>
          <div class="form-control">
            <span class="text-sm font-bold"
              >Description
              <i class="opacity-50 font-normal">(optionnel)</i></span
            >
            <RichTextField
              :ref="(el: any) => (ligneDescRefs[ligne.key] = el)"
              :name="`ligne_desc_${ligne.key}`"
              v-model="ligne.description"
            />
          </div>
          <label class="form-control">
            <span class="text-sm font-bold"
              >Lien vers les horaires
              <i class="opacity-50 font-normal">(optionnel)</i></span
            >
            <input
              type="url"
              class="input input-primary input-sm"
              v-model="ligne.lien"
              placeholder="https://…"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
