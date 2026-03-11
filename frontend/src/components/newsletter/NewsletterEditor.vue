<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { useNewsletterStore } from "@/stores/newsletter";
import type { Newsletter, NewsletterSection } from "@/types/newsletter";
import SectionTextEditor from "./SectionTextEditor.vue";
import SectionNouvellesFalaises from "./SectionNouvellesFalaises.vue";
import NewsletterPreview from "./NewsletterPreview.vue";
import SendDialog from "./SendDialog.vue";
import Icon from "@/components/shared/Icon.vue";

const props = defineProps<{
  newsletterId: number | null;
}>();

const emit = defineEmits<{
  back: [];
}>();

const store = useNewsletterStore();

const newsletter = ref<Newsletter>({
  slug: "",
  title: "",
  description: "",
  date_label: "",
  status: "draft",
  sections: [],
});

const showPreview = ref(false);
const showSend = ref(false);
const fabOpen = ref(false);
const saveMessage = ref("");
const hasChanges = ref(false);

watch(
  newsletter,
  () => {
    hasChanges.value = true;
  },
  { deep: true },
);

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasChanges.value) e.preventDefault();
}

onMounted(async () => {
  if (props.newsletterId) {
    await store.fetchOne(props.newsletterId);
    if (store.current) {
      newsletter.value = { ...store.current };
    }
  }
  await nextTick();
  hasChanges.value = false;
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});

const canSend = computed(
  () => newsletter.value.id && newsletter.value.status !== "draft",
);

async function save() {
  saveMessage.value = "";
  const id = await store.save(newsletter.value);
  if (id) {
    newsletter.value.id = id;
    hasChanges.value = false;
    saveMessage.value = "Sauvegardé !";
    setTimeout(() => (saveMessage.value = ""), 3000);
  }
}

async function saveAndPublish() {
  newsletter.value.status = "published";
  await save();
}

async function saveAndUnpublish() {
  newsletter.value.status = "draft";
  await save();
}

function addSection(type: "text" | "nouvelles_falaises") {
  const section: NewsletterSection =
    type === "text"
      ? { type: "text", html: "" }
      : { type: "nouvelles_falaises", intro_html: "", regions: [] };
  newsletter.value.sections.push(section);
}

function removeSection(index: number) {
  newsletter.value.sections.splice(index, 1);
}

function moveSection(index: number, direction: -1 | 1) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= newsletter.value.sections.length) return;
  const sections = newsletter.value.sections;
  [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
}

function updateSectionHtml(index: number, html: string) {
  newsletter.value.sections[index] = {
    ...newsletter.value.sections[index],
    html,
  };
}

function updateSection(index: number, section: NewsletterSection) {
  newsletter.value.sections[index] = section;
}

function goBack() {
  if (
    hasChanges.value &&
    !confirm("Des modifications non sauvegardées seront perdues. Continuer ?")
  )
    return;
  emit("back");
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2 items-center">
      <button class="btn btn-sm btn-ghost" @click="goBack">← Retour</button>
      <h2 class="text-2xl font-bold flex-1">
        {{ newsletterId ? "Éditer" : "Nouvelle" }} newsletter
      </h2>
    </div>

    <!-- Metadata -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="label font-medium">Slug</label>
        <input
          v-model="newsletter.slug"
          type="text"
          class="input input-bordered w-full"
          placeholder="2026-03-nouveautes-velogrimpe"
        />
      </div>
      <div>
        <label class="label font-medium">Date (label)</label>
        <input
          v-model="newsletter.date_label"
          type="text"
          class="input input-bordered w-full"
          placeholder="Mars 2026"
        />
      </div>
      <div class="md:col-span-2">
        <label class="label font-medium">Titre</label>
        <input
          v-model="newsletter.title"
          type="text"
          class="input input-bordered w-full"
          placeholder="Actualités Velogrimpe.fr - Mars 2026"
        />
      </div>
      <div class="md:col-span-2">
        <label class="label font-medium">Description</label>
        <textarea
          v-model="newsletter.description"
          class="textarea textarea-bordered w-full"
          rows="2"
          placeholder="Description pour SEO et aperçu email"
        ></textarea>
      </div>
    </div>

    <!-- Sections -->
    <div class="space-y-4">
      <h3 class="text-xl font-bold">Sections</h3>

      <div
        v-for="(section, i) in newsletter.sections"
        :key="i"
        class="rounded-lg border-2 p-4"
        :class="
          section.type === 'text' ? 'border-primary/40' : 'border-secondary/40'
        "
      >
        <div class="flex justify-between items-center mb-3">
          <span
            class="badge badge-soft"
            :class="
              section.type === 'text' ? 'badge-primary' : 'badge-secondary'
            "
          >
            {{ section.type === "text" ? "Texte" : "Nouvelles falaises" }}
          </span>
          <div class="flex gap-1">
            <button
              class="btn btn-xs"
              :disabled="i === 0"
              @click="moveSection(i, -1)"
            >
              ↑
            </button>
            <button
              class="btn btn-xs"
              :disabled="i === newsletter.sections.length - 1"
              @click="moveSection(i, 1)"
            >
              ↓
            </button>
            <button
              class="btn btn-xs btn-error btn-outline"
              @click="removeSection(i)"
            >
              Supprimer
            </button>
          </div>
        </div>

        <SectionTextEditor
          v-if="section.type === 'text'"
          :html="section.html ?? ''"
          :slug="newsletter.slug"
          @update:html="updateSectionHtml(i, $event)"
        />

        <SectionNouvellesFalaises
          v-else-if="section.type === 'nouvelles_falaises'"
          :section="section"
          :slug="newsletter.slug"
          @update:section="updateSection(i, $event)"
        />
      </div>

      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="addSection('text')">
          + Section texte
        </button>
        <button
          class="btn btn-outline btn-sm"
          @click="addSection('nouvelles_falaises')"
        >
          + Nouvelles falaises
        </button>
      </div>
    </div>

    <!-- FAB flower speed dial -->
    <Teleport to="body">
      <div class="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <!-- Action buttons — always visible on md+, toggled on mobile -->
        <div
          :class="fabOpen ? 'flex' : 'hidden md:flex'"
          class="flex-col items-end gap-2"
        >
          <!-- Prévisualiser -->
          <div
            v-if="newsletter.id"
            class="tooltip tooltip-left"
            data-tip="Prévisualiser"
          >
            <button
              class="btn btn-circle bg-base-100 shadow-lg"
              @click="showPreview = true"
            >
              <Icon name="eye" class="w-5 h-5" />
            </button>
          </div>
          <!-- Envoyer -->
          <div v-if="canSend" class="tooltip tooltip-left" data-tip="Envoyer">
            <button
              class="btn btn-circle btn-error text-base-100 shadow-lg"
              @click="showSend = true"
            >
              <Icon name="send" class="w-5 h-5" />
            </button>
          </div>

          <!-- Publier -->
          <div
            v-if="newsletter.status === 'draft'"
            class="tooltip tooltip-left"
            data-tip="Publier"
          >
            <button
              class="btn btn-circle btn-info text-base-100 shadow-lg"
              @click="saveAndPublish"
              :disabled="store.loading"
            >
              <Icon name="thumbsup" class="w-5 h-5" />
            </button>
          </div>

          <!-- Dépublier -->
          <div
            v-if="newsletter.status === 'published'"
            class="tooltip tooltip-left"
            data-tip="Dépublier"
          >
            <button
              class="btn btn-circle btn-warning text-base-100 shadow-lg"
              @click="saveAndUnpublish"
              :disabled="store.loading"
            >
              <Icon name="uturn" class="w-5 h-5" />
            </button>
          </div>

          <!-- Sauvegarder -->
          <div
            class="tooltip tooltip-left"
            :data-tip="saveMessage || 'Sauvegarder'"
          >
            <button
              class="btn btn-circle btn-primary shadow-lg"
              @click="save"
              :disabled="store.loading"
            >
              <span
                v-if="store.loading"
                class="loading loading-spinner loading-xs"
              ></span>
              <Icon v-else name="save" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Toggle button — mobile only -->
        <button
          class="btn btn-circle btn-lg shadow-xl md:hidden"
          :class="fabOpen || !hasChanges ? 'btn-neutral' : 'btn-primary'"
          @click="fabOpen = !fabOpen"
        >
          <Icon v-if="fabOpen || !hasChanges" name="cog" class="w-6 h-6" />
          <Icon v-else name="save" class="w-6 h-6" />
        </button>

        <!-- Error toast -->
        <div
          v-if="store.error"
          class="toast toast-end toast-bottom fixed bottom-20 right-6 z-50"
        >
          <div class="alert alert-error text-sm">{{ store.error }}</div>
        </div>
      </div>
    </Teleport>

    <!-- Preview modal -->
    <NewsletterPreview
      v-if="showPreview && newsletter.id"
      :newsletter-id="newsletter.id"
      @close="showPreview = false"
    />

    <!-- Send dialog -->
    <SendDialog
      v-if="showSend && newsletter.id"
      :newsletter="newsletter"
      @close="showSend = false"
    />
  </div>
</template>
