<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import NewsletterList from './NewsletterList.vue'
import NewsletterEditor from './NewsletterEditor.vue'

const editingId = ref<number | null>(null)
const isCreating = ref(false)

function syncFromUrl() {
  const params = new URLSearchParams(location.search)
  if (params.has('new')) {
    editingId.value = null
    isCreating.value = true
  } else if (params.has('id')) {
    editingId.value = parseInt(params.get('id')!)
    isCreating.value = false
  } else {
    editingId.value = null
    isCreating.value = false
  }
}

function onEdit(id: number) {
  editingId.value = id
  isCreating.value = false
  history.pushState({}, '', '?id=' + id)
}

function onCreate() {
  editingId.value = null
  isCreating.value = true
  history.pushState({}, '', '?new=1')
}

function onBack() {
  editingId.value = null
  isCreating.value = false
  history.pushState({}, '', location.pathname)
}

onMounted(() => {
  syncFromUrl()
  window.addEventListener('popstate', syncFromUrl)
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncFromUrl)
})
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold text-center mb-6">
      <span class="text-red-900">Gestion des Newsletters</span>
    </h1>
    <NewsletterEditor
      v-if="isCreating || editingId !== null"
      :newsletter-id="editingId"
      @back="onBack"
    />
    <NewsletterList
      v-else
      @edit="onEdit"
      @create="onCreate"
    />
  </div>
</template>
