<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useNewsletterStore } from "@/stores/newsletter";
import type { Newsletter } from "@/types/newsletter";

const props = defineProps<{
  newsletter: Newsletter;
}>();

const emit = defineEmits<{
  close: [];
}>();

const modal = ref<HTMLDialogElement | null>(null);
const store = useNewsletterStore();

const status = ref<{
  total: number;
  sent: number;
  errors: number;
  remaining: number;
} | null>(null);

const sendResult = ref<{
  success: number;
  error: number;
  sent_to: number;
} | null>(null);
const sending = ref(false);

onMounted(async () => {
  modal.value?.showModal();
  if (props.newsletter.slug) {
    status.value = await store.getSendStatus(props.newsletter.slug);
  }
});

async function confirmSend() {
  if (!props.newsletter.id) return;
  if (!confirm("Confirmer l'envoi de la newsletter à tous les abonnés ?"))
    return;

  sending.value = true;
  sendResult.value = await store.sendNewsletter(props.newsletter.id);
  sending.value = false;

  if (props.newsletter.slug) {
    status.value = await store.getSendStatus(props.newsletter.slug);
  }
}
</script>

<template>
  <dialog ref="modal" class="modal" @close="emit('close')">
    <div class="modal-box space-y-4">
      <h3 class="text-xl font-bold">Envoyer la newsletter</h3>
      <p class="font-medium">{{ newsletter.title }}</p>

      <div v-if="status" class="stats stats-vertical shadow w-full">
        <div class="stat">
          <div class="stat-title">Abonnés total</div>
          <div class="stat-value text-lg">{{ status.total }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Déjà envoyés</div>
          <div class="stat-value text-lg text-success">{{ status.sent }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Erreurs</div>
          <div class="stat-value text-lg text-error">{{ status.errors }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Restants</div>
          <div class="stat-value text-lg text-info">{{ status.remaining }}</div>
        </div>
      </div>

      <div v-if="sendResult" class="alert alert-success">
        Envoi terminé : {{ sendResult.success }} succès,
        {{ sendResult.error }} erreurs sur
        {{ sendResult.sent_to }} destinataires.
      </div>

      <div v-if="store.error" class="alert alert-error">{{ store.error }}</div>

      <div class="modal-action">
        <form method="dialog">
          <button class="btn btn-ghost">Fermer</button>
        </form>
        <button
          class="btn btn-error"
          :disabled="sending || status?.remaining === 0"
          @click="confirmSend"
        >
          <span
            v-if="sending"
            class="loading loading-spinner loading-xs"
          ></span>
          {{ sending ? "Envoi en cours..." : "Envoyer" }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
