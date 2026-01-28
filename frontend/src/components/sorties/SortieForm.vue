<script setup lang="ts">
import { ref, computed } from "vue";
import FormAutocomplete, {
  type FormAutocompleteItem,
} from "@/components/shared/FormAutocomplete.vue";
import DatePicker from "@/components/shared/DatePicker.vue";

interface Ville {
  ville_id: number;
  ville_nom: string;
}

interface Falaise {
  falaise_id: number;
  falaise_nom: string;
}

interface Gare {
  gare_id: number;
  gare_nom: string;
}

interface VeloRoute {
  velo_id: number;
  velo_depart: string;
  velo_arrivee: string;
  velo_km: number;
  velo_dplus: number;
}

interface SortieData {
  sortie_id?: number;
  organisateur_nom: string;
  organisateur_email: string;
  ville_depart: string;
  ville_id: number | null;
  falaise_principale_nom: string;
  falaise_principale_id: number | null;
  falaises_alternatives: { nom: string; id?: number }[];
  velo_nom: string;
  velo_id: number | null | "autre";
  lien_groupe: string;
  description: string;
  date_debut: string;
  date_fin: string;
}

const props = withDefaults(
  defineProps<{
    villes: Ville[];
    falaises: Falaise[];
    gares: Gare[];
    editMode?: boolean;
    initialData?: SortieData;
    editToken?: string;
  }>(),
  {
    editMode: false,
    initialData: undefined,
    editToken: "",
  },
);

// Form state
const formData = ref<SortieData>({
  organisateur_nom: "",
  organisateur_email: "",
  ville_depart: "",
  ville_id: null,
  falaise_principale_nom: "",
  falaise_principale_id: null,
  falaises_alternatives: [],
  velo_nom: "",
  velo_id: null,
  lien_groupe: "",
  description: "",
  date_debut: "",
  date_fin: "",
});

const alternativeFalaise = ref("");
const alternativeFalaiseId = ref<number | null>(null);
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);
const veloRoutes = ref<VeloRoute[]>([]);
const isLoadingVelos = ref(false);

// Initialize form with existing data in edit mode
if (props.editMode && props.initialData) {
  formData.value = {
    sortie_id: props.initialData.sortie_id,
    organisateur_nom: props.initialData.organisateur_nom,
    organisateur_email: props.initialData.organisateur_email,
    ville_depart: props.initialData.ville_depart,
    ville_id: props.initialData.ville_id,
    falaise_principale_nom: props.initialData.falaise_principale_nom,
    falaise_principale_id: props.initialData.falaise_principale_id,
    falaises_alternatives: props.initialData.falaises_alternatives || [],
    velo_nom: props.initialData.velo_nom || "",
    velo_id: props.initialData.velo_id,
    lien_groupe: props.initialData.lien_groupe,
    description: props.initialData.description,
    date_debut: props.initialData.date_debut,
    date_fin: props.initialData.date_fin || "",
  };

  // Load velo routes for initial falaise
  if (props.initialData.falaise_principale_id) {
    fetchVeloRoutes(props.initialData.falaise_principale_id);
  }
}

// Convert data for autocomplete
const villeItems = computed<FormAutocompleteItem[]>(() =>
  props.villes.map((v) => ({ id: v.ville_id, nom: v.ville_nom })),
);

const falaiseItems = computed<FormAutocompleteItem[]>(() =>
  props.falaises.map((f) => ({ id: f.falaise_id, nom: f.falaise_nom })),
);


// Retrieve saved contributor data (only in create mode)
if (!props.editMode && typeof window !== "undefined" && window.contribStorage) {
  const saved = window.contribStorage.getContribInfo();
  if (saved.nom) formData.value.organisateur_nom = saved.nom;
  if (saved.email) formData.value.organisateur_email = saved.email;
}

// Today's date for min date validation
const today = new Date().toISOString().split("T")[0];

function handleVilleSelect(item: FormAutocompleteItem | null, value: string) {
  formData.value.ville_depart = value;
  formData.value.ville_id = item ? (item.id as number) : null;
}

async function handleFalaiseSelect(
  item: FormAutocompleteItem | null,
  value: string,
) {
  formData.value.falaise_principale_nom = value;
  formData.value.falaise_principale_id = item ? (item.id as number) : null;

  // Fetch velo routes for this falaise
  if (item && item.id) {
    await fetchVeloRoutes(item.id as number);
  } else {
    veloRoutes.value = [];
    formData.value.velo_nom = "";
    formData.value.velo_id = null;
  }
}

async function fetchVeloRoutes(falaiseId: number) {
  isLoadingVelos.value = true;
  try {
    const response = await fetch(
      `/api/fetch_sortie_velos.php?falaise_id=${falaiseId}`,
    );
    const data = await response.json();

    if (data.success) {
      veloRoutes.value = data.velos;
    } else {
      console.error("Failed to fetch velo routes:", data.error);
      veloRoutes.value = [];
    }
  } catch (error) {
    console.error("Error fetching velo routes:", error);
    veloRoutes.value = [];
  } finally {
    isLoadingVelos.value = false;
  }
}

function handleVeloSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const value = target.value;

  if (value === "autre") {
    formData.value.velo_id = "autre";
    formData.value.velo_nom = "";
  } else if (value === "") {
    formData.value.velo_id = null;
    formData.value.velo_nom = "";
  } else {
    const veloId = parseInt(value);
    const selectedVelo = veloRoutes.value.find((v) => v.velo_id === veloId);
    if (selectedVelo) {
      formData.value.velo_id = veloId;
      formData.value.velo_nom = `${selectedVelo.velo_depart} → ${selectedVelo.velo_arrivee} (${selectedVelo.velo_km} km, D+ ${selectedVelo.velo_dplus}m)`;
    }
  }
}

function handleAlternativeFalaiseSelect(
  item: FormAutocompleteItem | null,
  value: string,
) {
  alternativeFalaise.value = value;
  alternativeFalaiseId.value = item ? (item.id as number) : null;
}

function addAlternativeFalaise() {
  if (alternativeFalaise.value.trim()) {
    formData.value.falaises_alternatives.push({
      nom: alternativeFalaise.value.trim(),
      id: alternativeFalaiseId.value || undefined,
    });
    alternativeFalaise.value = "";
    alternativeFalaiseId.value = null;
  }
}

function removeAlternativeFalaise(index: number) {
  formData.value.falaises_alternatives.splice(index, 1);
}

function validateForm(): boolean {
  errors.value = {};

  if (!formData.value.organisateur_nom.trim()) {
    errors.value.organisateur_nom = "Votre nom est requis";
  }

  if (!formData.value.organisateur_email.trim()) {
    errors.value.organisateur_email = "Votre email est requis";
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.organisateur_email)
  ) {
    errors.value.organisateur_email = "Email invalide";
  }

  if (!formData.value.ville_depart.trim()) {
    errors.value.ville_depart = "Ville de départ requise";
  }

  if (!formData.value.falaise_principale_nom.trim()) {
    errors.value.falaise_principale_nom = "Falaise principale requise";
  }

  if (formData.value.lien_groupe.trim() && !/^https?:\/\/.+/.test(formData.value.lien_groupe)) {
    errors.value.lien_groupe = "Le lien doit commencer par http:// ou https://";
  }

  if (!formData.value.description.trim()) {
    errors.value.description = "Description requise";
  }

  if (!formData.value.date_debut) {
    errors.value.date_debut = "Date de début requise";
  }

  if (formData.value.date_fin && formData.value.date_debut) {
    if (formData.value.date_fin < formData.value.date_debut) {
      errors.value.date_fin = "La date de fin doit être après la date de début";
    }
  }

  return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
  if (!validateForm()) {
    return;
  }

  isLoading.value = true;

  try {
    // Save contributor data (only in create mode)
    if (
      !props.editMode &&
      typeof window !== "undefined" &&
      window.contribStorage
    ) {
      window.contribStorage.saveContribInfo(
        formData.value.organisateur_nom,
        formData.value.organisateur_email,
      );
    }

    const formDataToSend = new FormData();

    // Add edit token for edit mode
    if (props.editMode && props.editToken) {
      formDataToSend.append(
        "sortie_id",
        formData.value.sortie_id?.toString() || "",
      );
      formDataToSend.append("edit_token", props.editToken);
    }

    formDataToSend.append("organisateur_nom", formData.value.organisateur_nom);
    formDataToSend.append(
      "organisateur_email",
      formData.value.organisateur_email,
    );
    formDataToSend.append("ville_depart", formData.value.ville_depart);
    if (formData.value.ville_id) {
      formDataToSend.append("ville_id", formData.value.ville_id.toString());
    }
    formDataToSend.append(
      "falaise_principale_nom",
      formData.value.falaise_principale_nom,
    );
    if (formData.value.falaise_principale_id) {
      formDataToSend.append(
        "falaise_principale_id",
        formData.value.falaise_principale_id.toString(),
      );
    }
    formDataToSend.append(
      "falaises_alternatives",
      JSON.stringify(formData.value.falaises_alternatives),
    );
    if (formData.value.velo_nom) {
      formDataToSend.append("velo_nom", formData.value.velo_nom);
    }
    if (formData.value.velo_id && formData.value.velo_id !== "autre") {
      formDataToSend.append("velo_id", formData.value.velo_id.toString());
    }
    formDataToSend.append("lien_groupe", formData.value.lien_groupe);
    formDataToSend.append("description", formData.value.description);
    formDataToSend.append("date_debut", formData.value.date_debut);
    if (formData.value.date_fin) {
      formDataToSend.append("date_fin", formData.value.date_fin);
    }

    const apiUrl = props.editMode
      ? "/api/private/edit_sortie.php"
      : "/api/add_sortie.php";
    const response = await fetch(apiUrl, {
      method: "POST",
      body: formDataToSend,
    });

    const data = await response.json();

    if (data.success) {
      if (props.editMode) {
        alert("Sortie modifiée avec succès !");
        window.location.href = "/sorties.php";
      } else {
        // Redirect to confirmation page
        window.location.href = `/ajout/confirmation_sortie.php?sortie_id=${data.sortie_id}&token=${data.edit_token}`;
      }
    } else {
      alert(`Erreur : ${data.error}`);
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    alert("Une erreur est survenue lors de l'envoi du formulaire");
  } finally {
    isLoading.value = false;
  }
}

async function handleDelete() {
  if (!props.editMode || !props.editToken || !formData.value.sortie_id) {
    return;
  }

  if (
    !confirm(
      "Êtes-vous sûr de vouloir supprimer cette sortie ? Cette action est irréversible.",
    )
  ) {
    return;
  }

  isLoading.value = true;

  try {
    const formDataToSend = new FormData();
    formDataToSend.append("sortie_id", formData.value.sortie_id.toString());
    formDataToSend.append("edit_token", props.editToken);

    const response = await fetch("/api/private/delete_sortie_organizer.php", {
      method: "POST",
      body: formDataToSend,
    });

    const data = await response.json();

    if (data.success) {
      alert("Sortie supprimée avec succès");
      window.location.href = "/sorties.php";
    } else {
      alert(`Erreur : ${data.error}`);
    }
  } catch (error) {
    console.error("Error deleting sortie:", error);
    alert("Une erreur est survenue lors de la suppression");
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="card bg-base-100 shadow-lg">
    <div class="card-body gap-6">
      <!-- Section: Vos informations -->
      <div>
        <h2 class="text-xl font-bold mb-4">Vos informations</h2>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text"
              >Votre nom <span class="text-error">*</span></span
            >
          </label>
          <input
            v-model="formData.organisateur_nom"
            type="text"
            placeholder="Prénom Nom"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.organisateur_nom }"
            required
          />
          <label v-if="errors.organisateur_nom" class="label">
            <span class="label-text-alt text-error">{{
              errors.organisateur_nom
            }}</span>
          </label>
        </div>

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text"
              >Votre email <span class="text-error">*</span></span
            >
          </label>
          <input
            v-model="formData.organisateur_email"
            type="email"
            placeholder="email@example.com"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.organisateur_email }"
            required
          />
          <label v-if="errors.organisateur_email" class="label">
            <span class="label-text-alt text-error">{{
              errors.organisateur_email
            }}</span>
          </label>
          <label class="label">
            <span class="label-text-alt">
              Cet email ne sera pas visible publiquement
            </span>
          </label>
        </div>
      </div>

      <!-- Section: Détails de la sortie -->
      <div>
        <h2 class="text-xl font-bold mb-4">Détails de la sortie</h2>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text"
              >Ville de départ <span class="text-error">*</span></span
            >
          </label>
          <FormAutocomplete
            v-model="formData.ville_depart"
            :items="villeItems"
            placeholder="Rechercher une ville..."
            accept-new-value
            required
            @select="handleVilleSelect"
          />
          <label v-if="errors.ville_depart" class="label">
            <span class="label-text-alt text-error">{{
              errors.ville_depart
            }}</span>
          </label>
        </div>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text"
              >Falaise principale <span class="text-error">*</span></span
            >
          </label>
          <FormAutocomplete
            v-model="formData.falaise_principale_nom"
            :items="falaiseItems"
            placeholder="Rechercher une falaise..."
            accept-new-value
            required
            @select="handleFalaiseSelect"
          />
          <label v-if="errors.falaise_principale_nom" class="label">
            <span class="label-text-alt text-error">{{
              errors.falaise_principale_nom
            }}</span>
          </label>
        </div>

        <!-- Falaises alternatives -->
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Falaises alternatives (optionnel)</span>
          </label>
          <div class="flex gap-2">
            <FormAutocomplete
              v-model="alternativeFalaise"
              :items="falaiseItems"
              placeholder="Ajouter une falaise alternative"
              accept-new-value
              class="flex-1"
              @select="handleAlternativeFalaiseSelect"
              @keydown.enter.prevent="addAlternativeFalaise"
            />
            <button
              type="button"
              class="btn btn-outline"
              @click="addAlternativeFalaise"
            >
              Ajouter
            </button>
          </div>
          <div
            v-if="formData.falaises_alternatives.length > 0"
            class="mt-2 flex flex-wrap gap-2"
          >
            <span
              v-for="(falaise, index) in formData.falaises_alternatives"
              :key="index"
              class="badge badge-lg gap-2"
            >
              {{ falaise.nom }}
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-circle"
                @click="removeAlternativeFalaise(index)"
              >
                ✕
              </button>
            </span>
          </div>
        </div>

        <!-- Itinéraire vélo -->
        <div v-if="isLoadingVelos" class="text-sm text-base-content/60 mb-4">
          Chargement des itinéraires vélo...
        </div>

        <div
          v-if="!isLoadingVelos && formData.falaise_principale_nom"
          class="form-control w-full mb-4"
        >
          <label class="label">
            <span class="label-text">Itinéraire vélo prévu (optionnel)</span>
          </label>

          <select
            v-model="formData.velo_id"
            class="select select-bordered w-full"
            @change="handleVeloSelectChange"
          >
            <option :value="null" selected>Aucun itinéraire sélectionné</option>
            <option
              v-for="velo in veloRoutes"
              :key="velo.velo_id"
              :value="velo.velo_id"
            >
              {{ velo.velo_depart }} → {{ velo.velo_arrivee }} ({{
                velo.velo_km
              }}
              km, D+ {{ velo.velo_dplus }}m)
            </option>
            <option value="autre">Autre (préciser ci-dessous)</option>
          </select>

          <!-- Custom velo input if "Autre" is selected -->
          <div v-if="formData.velo_id === 'autre'" class="mt-2">
            <input
              v-model="formData.velo_nom"
              type="text"
              placeholder="Précisez votre itinéraire vélo..."
              class="input input-bordered w-full"
            />
          </div>

          <label v-if="veloRoutes.length > 0" class="label">
            <span class="label-text-alt">
              {{ veloRoutes.length }} itinéraire{{
                veloRoutes.length > 1 ? "s" : ""
              }}
              disponible{{ veloRoutes.length > 1 ? "s" : "" }} pour cette
              falaise
            </span>
          </label>
        </div>
      </div>

      <!-- Section: Dates -->
      <div>
        <h2 class="text-xl font-bold mb-4">Dates</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DatePicker
            v-model="formData.date_debut"
            label="Date de début"
            :min-date="today"
            required
            :error="errors.date_debut"
          />

          <DatePicker
            v-model="formData.date_fin"
            label="Date de fin (si plusieurs jours)"
            :min-date="formData.date_debut || today"
            :error="errors.date_fin"
          />
        </div>
      </div>

      <!-- Section: Informations complémentaires -->
      <div>
        <h2 class="text-xl font-bold mb-4">Informations complémentaires</h2>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">
              Lien du groupe (Signal, WhatsApp, etc.) (optionnel)
            </span>
          </label>
          <input
            v-model="formData.lien_groupe"
            type="url"
            placeholder="https://signal.group/..."
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.lien_groupe }"
          />
          <label v-if="errors.lien_groupe" class="label">
            <span class="label-text-alt text-error">{{
              errors.lien_groupe
            }}</span>
          </label>
          <label class="label">
            <span class="label-text-alt">
              Les personnes intéressées pourront rejoindre ce groupe
            </span>
          </label>
        </div>

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text"
              >Description <span class="text-error">*</span></span
            >
          </label>
          <textarea
            v-model="formData.description"
            class="textarea textarea-bordered h-32"
            :class="{ 'textarea-error': errors.description }"
            placeholder="Décrivez votre sortie : objectifs, niveau attendu, matériel nécessaire..."
            required
          ></textarea>
          <label v-if="errors.description" class="label">
            <span class="label-text-alt text-error">{{
              errors.description
            }}</span>
          </label>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="card-actions justify-between mt-4">
        <button
          v-if="editMode"
          type="button"
          class="btn btn-error btn-outline"
          :disabled="isLoading"
          @click="handleDelete"
        >
          Supprimer la sortie
        </button>
        <div v-else></div>

        <button type="submit" class="btn btn-primary" :disabled="isLoading">
          <span v-if="isLoading" class="loading loading-spinner"></span>
          <span v-else>{{
            editMode ? "Enregistrer les modifications" : "Publier la sortie"
          }}</span>
        </button>
      </div>
    </div>
  </form>
</template>
