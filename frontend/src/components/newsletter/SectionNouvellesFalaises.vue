<script setup lang="ts">
import { onMounted } from 'vue'
import { useNewsletterStore } from '@/stores/newsletter'
import type { NewsletterSection } from '@/types/newsletter'
import FalaiseSearch from './FalaiseSearch.vue'
import SectionTextEditor from './SectionTextEditor.vue'
import ZoneAutocomplete from './ZoneAutocomplete.vue'

const props = defineProps<{
  section: NewsletterSection
  slug: string
}>()

const emit = defineEmits<{
  'update:section': [section: NewsletterSection]
}>()

const store = useNewsletterStore()

onMounted(() => {
  if (store.zones.length === 0) store.fetchZones()
})

function updateIntroHtml(html: string) {
  emit('update:section', { ...props.section, intro_html: html })
}

function addRegion() {
  const regions = [...(props.section.regions ?? [])]
  regions.push({ name: '', image: '', falaises: [] })
  emit('update:section', { ...props.section, regions })
}

function removeRegion(index: number) {
  const regions = [...(props.section.regions ?? [])]
  regions.splice(index, 1)
  emit('update:section', { ...props.section, regions })
}

function updateRegionName(index: number, name: string) {
  const regions = [...(props.section.regions ?? [])]
  regions[index] = { ...regions[index], name }
  emit('update:section', { ...props.section, regions })
}

async function uploadRegionImage(index: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const url = await store.uploadImage(file, props.slug)
  if (url) {
    const regions = [...(props.section.regions ?? [])]
    regions[index] = { ...regions[index], image: url }
    emit('update:section', { ...props.section, regions })
  }
}

function addFalaise(regionIndex: number, falaise: { id: number; name: string; contributor?: string }) {
  const regions = [...(props.section.regions ?? [])]
  const region = { ...regions[regionIndex] }
  region.falaises = [...region.falaises, { id: falaise.id, name: falaise.name, contributor: falaise.contributor ?? '' }]
  regions[regionIndex] = region
  emit('update:section', { ...props.section, regions })
}

function removeFalaise(regionIndex: number, falaiseIndex: number) {
  const regions = [...(props.section.regions ?? [])]
  const region = { ...regions[regionIndex] }
  region.falaises = [...region.falaises]
  region.falaises.splice(falaiseIndex, 1)
  regions[regionIndex] = region
  emit('update:section', { ...props.section, regions })
}

function updateContributor(regionIndex: number, falaiseIndex: number, contributor: string) {
  const regions = [...(props.section.regions ?? [])]
  const region = { ...regions[regionIndex] }
  region.falaises = [...region.falaises]
  region.falaises[falaiseIndex] = { ...region.falaises[falaiseIndex], contributor }
  regions[regionIndex] = region
  emit('update:section', { ...props.section, regions })
}

function moveRegion(index: number, direction: -1 | 1) {
  const regions = [...(props.section.regions ?? [])]
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= regions.length) return
  ;[regions[index], regions[newIndex]] = [regions[newIndex], regions[index]]
  emit('update:section', { ...props.section, regions })
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="label font-medium">Introduction (optionnelle)</label>
      <SectionTextEditor
        :html="section.intro_html ?? ''"
        :upload="(file) => store.uploadImage(file, slug)"
        @update:html="updateIntroHtml"
      />
    </div>

    <div class="flex justify-between items-center">
      <h4 class="font-bold">Régions</h4>
      <button class="btn btn-sm btn-outline" @click="addRegion">+ Région</button>
    </div>

    <div
      v-for="(region, ri) in (section.regions ?? [])"
      :key="ri"
      class="border border-base-300 rounded-lg p-4 space-y-3"
    >
      <div class="flex gap-2 items-center">
        <ZoneAutocomplete
          :model-value="region.name"
          @update:model-value="updateRegionName(ri, $event)"
        />
        <button class="btn btn-xs" :disabled="ri === 0" @click="moveRegion(ri, -1)">↑</button>
        <button class="btn btn-xs" :disabled="ri === (section.regions?.length ?? 0) - 1" @click="moveRegion(ri, 1)">↓</button>
        <button class="btn btn-xs btn-error btn-outline" @click="removeRegion(ri)">×</button>
      </div>

      <div class="flex gap-2 items-center">
        <input type="file" accept="image/*" class="file-input file-input-sm file-input-bordered flex-1" @change="uploadRegionImage(ri, $event)" />
        <img v-if="region.image" :src="region.image" class="w-16 h-16 object-cover rounded" />
      </div>

      <div class="space-y-2">
        <div
          v-for="(f, fi) in region.falaises"
          :key="fi"
          class="flex gap-2 items-center bg-base-200 rounded px-2 py-1"
        >
          <span class="font-medium text-sm flex-1">{{ f.name }}</span>
          <input
            :value="f.contributor"
            @input="updateContributor(ri, fi, ($event.target as HTMLInputElement).value)"
            type="text"
            class="input input-bordered input-xs w-32"
            placeholder="Contributeur"
          />
          <button class="btn btn-xs btn-error btn-outline" @click="removeFalaise(ri, fi)">×</button>
        </div>
        <FalaiseSearch @select="addFalaise(ri, $event)" />
      </div>
    </div>
  </div>
</template>
