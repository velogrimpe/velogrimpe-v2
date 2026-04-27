<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PageSection } from '@/types/page'
import SectionTextEditor from '@/components/newsletter/SectionTextEditor.vue'

const props = defineProps<{
  section: Extract<PageSection, { type: 'iframe' }>
  upload: (file: File) => Promise<string | null>
}>()

const emit = defineEmits<{
  'update:section': [section: PageSection]
}>()

const showPreview = ref(false)

const hasEmbed = computed(() => !!props.section.embed_code?.trim())

function update(patch: Partial<Extract<PageSection, { type: 'iframe' }>>) {
  emit('update:section', { ...props.section, ...patch })
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="label font-medium">Titre (optionnel)</label>
      <input
        :value="section.title ?? ''"
        @input="update({ title: ($event.target as HTMLInputElement).value })"
        type="text"
        class="input input-bordered w-full"
        placeholder="Carte des falaises de la région"
      />
    </div>

    <div>
      <label class="label font-medium">Introduction (optionnelle)</label>
      <SectionTextEditor
        :html="section.intro_html ?? ''"
        :upload="upload"
        @update:html="update({ intro_html: $event })"
      />
    </div>

    <div>
      <label class="label font-medium">Code d'intégration (iframe)</label>
      <textarea
        :value="section.embed_code ?? ''"
        @input="update({ embed_code: ($event.target as HTMLTextAreaElement).value })"
        class="textarea textarea-bordered w-full font-mono text-xs"
        rows="4"
        placeholder='<iframe src="https://umap.openstreetmap.fr/..." width="100%" height="400"></iframe>'
      ></textarea>
      <p class="text-xs text-base-content/60 mt-1">
        Collez le code fourni par le service tiers (uMap, OpenRunner, etc.).
      </p>
    </div>

    <div v-if="hasEmbed">
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm font-medium">Aperçu</span>
        <button class="btn btn-xs btn-ghost" @click="showPreview = !showPreview">
          {{ showPreview ? 'Masquer' : 'Afficher' }}
        </button>
      </div>
      <div
        v-if="showPreview"
        class="border border-base-300 rounded p-2 bg-base-200"
        v-html="section.embed_code"
      />
    </div>
  </div>
</template>
