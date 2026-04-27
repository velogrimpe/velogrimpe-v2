<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { usePagesStore } from '@/stores/pages'
import type { CmsPage, PageSection } from '@/types/page'
import SectionTextEditor from '@/components/newsletter/SectionTextEditor.vue'
import Icon from '@/components/shared/Icon.vue'

const props = defineProps<{
  pageId: number | null
}>()

const emit = defineEmits<{
  back: []
}>()

const store = usePagesStore()

const page = ref<CmsPage>({
  slug: '',
  title: '',
  description: '',
  status: 'draft',
  sections: [],
})

const fabOpen = ref(false)
const saveMessage = ref('')
const hasChanges = ref(false)

watch(
  page,
  () => {
    hasChanges.value = true
  },
  { deep: true },
)

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (hasChanges.value) e.preventDefault()
}

onMounted(async () => {
  if (props.pageId) {
    await store.fetchOne(props.pageId)
    if (store.current) {
      page.value = { ...store.current }
    }
  }
  await nextTick()
  hasChanges.value = false
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

const canPreview = computed(() => !!page.value.id && !!page.value.slug)

async function save() {
  saveMessage.value = ''
  const id = await store.save(page.value)
  if (id) {
    page.value.id = id
    hasChanges.value = false
    saveMessage.value = 'Sauvegardé !'
    setTimeout(() => (saveMessage.value = ''), 3000)
  }
}

async function saveAndPublish() {
  page.value.status = 'published'
  await save()
}

async function saveAndUnpublish() {
  page.value.status = 'draft'
  await save()
}

function addSection() {
  const section: PageSection = { type: 'text', html: '' }
  page.value.sections.push(section)
}

function removeSection(index: number) {
  page.value.sections.splice(index, 1)
}

function moveSection(index: number, direction: -1 | 1) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= page.value.sections.length) return
  const sections = page.value.sections
  ;[sections[index], sections[newIndex]] = [sections[newIndex], sections[index]]
}

function updateSectionHtml(index: number, html: string) {
  page.value.sections[index] = { type: 'text', html }
}

function openPreview() {
  window.open(store.getPreviewUrl(page.value.slug), '_blank')
}

function goBack() {
  if (
    hasChanges.value &&
    !confirm('Des modifications non sauvegardées seront perdues. Continuer ?')
  )
    return
  emit('back')
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2 items-center">
      <button class="btn btn-sm btn-ghost" @click="goBack">← Retour</button>
      <h2 class="text-2xl font-bold flex-1">
        {{ pageId ? 'Éditer' : 'Nouvelle' }} page
      </h2>
    </div>

    <!-- Metadata -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="label font-medium">Slug (URL : /p/{slug})</label>
        <input
          v-model="page.slug"
          type="text"
          class="input input-bordered w-full font-mono"
          placeholder="a-propos ou conseils/securite"
        />
      </div>
      <div>
        <label class="label font-medium">Statut</label>
        <input
          :value="page.status === 'draft' ? 'Brouillon' : 'Publié'"
          type="text"
          class="input input-bordered w-full"
          disabled
        />
      </div>
      <div class="md:col-span-2">
        <label class="label font-medium">Titre</label>
        <input
          v-model="page.title"
          type="text"
          class="input input-bordered w-full"
          placeholder="À propos de Velogrimpe"
        />
      </div>
      <div class="md:col-span-2">
        <label class="label font-medium">Description (SEO)</label>
        <textarea
          v-model="page.description"
          class="textarea textarea-bordered w-full"
          rows="2"
          placeholder="Description courte pour les moteurs de recherche et l'aperçu social"
        ></textarea>
      </div>
    </div>

    <!-- Sections -->
    <div class="space-y-4">
      <h3 class="text-xl font-bold">Contenu</h3>

      <div
        v-for="(section, i) in page.sections"
        :key="i"
        class="rounded-lg border-2 p-4 border-primary/40"
      >
        <div class="flex justify-between items-center mb-3">
          <span class="badge badge-soft badge-primary">Texte</span>
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
              :disabled="i === page.sections.length - 1"
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
          :html="section.html"
          :upload="(file) => store.uploadImage(file, page.slug)"
          @update:html="updateSectionHtml(i, $event)"
        />
      </div>

      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm" @click="addSection">
          + Section texte
        </button>
      </div>
    </div>

    <!-- FAB flower speed dial -->
    <Teleport to="body">
      <div class="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <div
          :class="fabOpen ? 'flex' : 'hidden md:flex'"
          class="flex-col items-end gap-2"
        >
          <!-- Prévisualiser -->
          <div
            v-if="canPreview"
            class="tooltip tooltip-left"
            data-tip="Prévisualiser"
          >
            <button
              class="btn btn-circle bg-base-100 shadow-lg"
              @click="openPreview"
            >
              <Icon name="eye" class="w-5 h-5" />
            </button>
          </div>

          <!-- Publier -->
          <div
            v-if="page.status === 'draft'"
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
            v-if="page.status === 'published'"
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
  </div>
</template>
