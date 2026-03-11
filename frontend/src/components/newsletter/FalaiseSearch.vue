<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FalaiseSearchResult } from '@/types/newsletter'

const emit = defineEmits<{
  select: [falaise: { id: number; name: string; contributor: string }]
}>()

const query = ref('')
const results = ref<FalaiseSearchResult[]>([])
const isOpen = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function getToken(): string {
  return (window as any).__NEWSLETTER_DATA__?.token ?? ''
}

watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (q.length < 2) {
    results.value = []
    isOpen.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/private/newsletter/search-falaises.php?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': 'Bearer ' + getToken() },
      })
      if (res.ok) {
        results.value = await res.json()
        isOpen.value = results.value.length > 0
      }
    } catch { /* ignore */ }
  }, 300)
})

function closeDelayed() {
  globalThis.setTimeout(() => isOpen.value = false, 200)
}

function select(f: FalaiseSearchResult) {
  emit('select', { id: f.id, name: f.name, contributor: f.contributor })
  query.value = ''
  results.value = []
  isOpen.value = false
}
</script>

<template>
  <div class="relative">
    <input
      v-model="query"
      type="text"
      class="input input-bordered input-sm w-full"
      placeholder="Rechercher une falaise..."
      @blur="closeDelayed"
      @focus="isOpen = results.length > 0"
    />
    <ul
      v-if="isOpen"
      class="absolute z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg mt-1 w-full max-h-60 overflow-y-auto"
    >
      <li
        v-for="f in results"
        :key="f.id"
        class="px-3 py-2 hover:bg-base-200 cursor-pointer"
        @mousedown.prevent="select(f)"
      >
        <span class="font-medium">{{ f.name }}</span>
        <span v-if="f.department" class="text-xs text-base-content/50 ml-2">({{ f.department }})</span>
      </li>
    </ul>
  </div>
</template>
