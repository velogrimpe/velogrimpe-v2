<script setup lang="ts">
import { ref, computed } from "vue";
import type { Sortie } from "@/types/sortie";
import { useToast } from "@/composables/useToast";

const props = defineProps<{
  sortie: Sortie | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submitted"): void;
}>();

const { showToast } = useToast();

const formData = ref({
  participant_nom: "",
  participant_email: "",
  participant_telephone: "",
  preferences_contact: {
    signal: false,
    whatsapp: false,
    email: true,
    telephone: false,
  },
  message: "",
});

const errors = ref<Record<string, string>>({});
const isSubmitting = ref(false);

// Retrieve saved contributor data
if (typeof window !== "undefined" && window.contribStorage) {
  const saved = window.contribStorage.getContribInfo();
  if (saved.nom) formData.value.participant_nom = saved.nom;
  if (saved.email) formData.value.participant_email = saved.email;
}

const hasContactPreference = computed(() => {
  const prefs = formData.value.preferences_contact;
  return prefs.signal || prefs.whatsapp || prefs.email || prefs.telephone;
});

function validateForm(): boolean {
  errors.value = {};

  if (!formData.value.participant_nom.trim()) {
    errors.value.participant_nom = "Votre nom est requis";
  }

  if (!formData.value.participant_email.trim()) {
    errors.value.participant_email = "Votre email est requis";
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.participant_email)
  ) {
    errors.value.participant_email = "Email invalide";
  }

  if (!hasContactPreference.value) {
    errors.value.preferences_contact =
      "Sélectionnez au moins un moyen de contact";
  }

  if (
    formData.value.preferences_contact.telephone &&
    !formData.value.participant_telephone.trim()
  ) {
    errors.value.participant_telephone =
      "Le numéro de téléphone est requis si vous le sélectionnez comme moyen de contact";
  }

  return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
  if (!props.sortie || !validateForm()) {
    return;
  }

  isSubmitting.value = true;

  try {
    // Save contributor data
    if (typeof window !== "undefined" && window.contribStorage) {
      window.contribStorage.saveContribInfo(
        formData.value.participant_nom,
        formData.value.participant_email,
      );
    }

    const formDataToSend = new FormData();
    formDataToSend.append("sortie_id", props.sortie.sortie_id.toString());
    formDataToSend.append("participant_nom", formData.value.participant_nom);
    formDataToSend.append(
      "participant_email",
      formData.value.participant_email,
    );
    if (formData.value.participant_telephone) {
      formDataToSend.append(
        "participant_telephone",
        formData.value.participant_telephone,
      );
    }
    formDataToSend.append(
      "preferences_contact",
      JSON.stringify(formData.value.preferences_contact),
    );
    if (formData.value.message) {
      formDataToSend.append("message", formData.value.message);
    }

    const response = await fetch("/api/add_participation.php", {
      method: "POST",
      body: formDataToSend,
    });

    const data = await response.json();

    if (data.success) {
      showToast(
        "Votre demande de participation a été envoyée ! L'admin validera votre demande et transférera vos coordonnées à l'organisateur.",
        "success",
      );
      emit("submitted");
      emit("close");
      resetForm();
    } else {
      showToast(`Erreur : ${data.error}`, "error");
    }
  } catch (error) {
    console.error("Error submitting participation:", error);
    showToast(
      "Une erreur est survenue lors de l'envoi de votre demande",
      "error",
    );
  } finally {
    isSubmitting.value = false;
  }
}

function resetForm() {
  formData.value.participant_telephone = "";
  formData.value.preferences_contact = {
    signal: false,
    whatsapp: false,
    email: true,
    telephone: false,
  };
  formData.value.message = "";
  errors.value = {};
}

function handleClose() {
  emit("close");
  resetForm();
}
</script>

<template>
  <dialog :class="{ 'modal modal-open': isOpen }" class="modal">
    <div class="modal-box w-11/12 max-w-2xl">
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        @click="handleClose"
      >
        ✕
      </button>

      <h3 class="font-bold text-lg mb-4">
        Je suis intéressé(e) par cette sortie
      </h3>

      <form @submit.prevent="handleSubmit">
        <!-- Sortie info -->
        <div v-if="sortie" class="alert alert-info mb-4">
          <div>
            <div class="font-semibold">{{ sortie.falaise_principale_nom }}</div>
            <div class="text-sm">
              {{
                new Date(sortie.date_debut).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              }}
              - Organisée par {{ sortie.organisateur_nom }}
            </div>
          </div>
        </div>

        <!-- Participant info -->
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text"
              >Votre nom <span class="text-error">*</span></span
            >
          </label>
          <input
            v-model="formData.participant_nom"
            type="text"
            placeholder="Prénom Nom"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.participant_nom }"
            required
          />
          <label v-if="errors.participant_nom" class="label">
            <span class="label-text-alt text-error">{{
              errors.participant_nom
            }}</span>
          </label>
        </div>

        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text"
              >Votre email <span class="text-error">*</span></span
            >
          </label>
          <input
            v-model="formData.participant_email"
            type="email"
            placeholder="email@example.com"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.participant_email }"
            required
          />
          <label v-if="errors.participant_email" class="label">
            <span class="label-text-alt text-error">{{
              errors.participant_email
            }}</span>
          </label>
        </div>

        <!-- Contact preferences -->
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text"
              >Moyens de contact préférés
              <span class="text-error">*</span></span
            >
          </label>
          <div class="flex flex-col gap-2">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="formData.preferences_contact.signal"
                type="checkbox"
                class="checkbox"
              />
              <span class="label-text">Signal</span>
            </label>
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="formData.preferences_contact.whatsapp"
                type="checkbox"
                class="checkbox"
              />
              <span class="label-text">WhatsApp</span>
            </label>
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="formData.preferences_contact.email"
                type="checkbox"
                class="checkbox"
              />
              <span class="label-text">Email</span>
            </label>
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="formData.preferences_contact.telephone"
                type="checkbox"
                class="checkbox"
              />
              <span class="label-text">Téléphone</span>
            </label>
          </div>
          <label v-if="errors.preferences_contact" class="label">
            <span class="label-text-alt text-error">{{
              errors.preferences_contact
            }}</span>
          </label>
        </div>

        <!-- Phone number if telephone/whatsapp/signal are selected -->
        <div
          v-if="
            formData.preferences_contact.telephone ||
            formData.preferences_contact.whatsapp ||
            formData.preferences_contact.signal
          "
          class="form-control w-full mb-4"
        >
          <label class="label">
            <span class="label-text"
              >Numéro de téléphone <span class="text-error">*</span></span
            >
          </label>
          <input
            v-model="formData.participant_telephone"
            type="tel"
            placeholder="06 12 34 56 78"
            class="input input-bordered w-full"
            :class="{ 'input-error': errors.participant_telephone }"
          />
          <label v-if="errors.participant_telephone" class="label">
            <span class="label-text-alt text-error">{{
              errors.participant_telephone
            }}</span>
          </label>
        </div>

        <!-- Message -->
        <div class="form-control w-full mb-4">
          <label class="label">
            <span class="label-text">Message à l'organisateur (optionnel)</span>
          </label>
          <textarea
            v-model="formData.message"
            class="textarea textarea-bordered h-24"
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="modal-action">
          <button type="button" class="btn" @click="handleClose">
            Annuler
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting" class="loading loading-spinner"></span>
            <span v-else>Envoyer ma demande</span>
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="handleClose">close</button>
    </form>
  </dialog>
</template>
