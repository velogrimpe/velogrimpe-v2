<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  newsletterId: number
}>()

const emit = defineEmits<{
  close: []
}>()

const modal = ref<HTMLDialogElement | null>(null)
const format = ref<'web' | 'email'>('web')
const iframeUrl = ref('')

function updateUrl() {
  const token = (window as any).__NEWSLETTER_DATA__?.token ?? ''
  iframeUrl.value = `/api/private/newsletter/render.php?id=${props.newsletterId}&format=${format.value}&admin=${token}&t=${Date.now()}`
}

onMounted(() => {
  updateUrl()
  modal.value?.showModal()
})

function switchFormat(f: 'web' | 'email') {
  format.value = f
  updateUrl()
}
</script>

<template>
  <dialog ref="modal" class="modal" @close="emit('close')">
    <div class="modal-box w-[90vw] max-w-none h-[90vh] flex flex-col p-0">
      <div class="flex items-center justify-between p-4 border-b border-base-300">
        <div class="flex gap-2">
          <button
            class="btn btn-sm"
            :class="format === 'web' ? 'btn-primary' : 'btn-ghost'"
            @click="switchFormat('web')"
          >Web</button>
          <button
            class="btn btn-sm"
            :class="format === 'email' ? 'btn-primary' : 'btn-ghost'"
            @click="switchFormat('email')"
          >Email</button>
        </div>
        <form method="dialog">
          <button class="btn btn-sm btn-ghost">✕</button>
        </form>
      </div>
      <iframe
        :src="iframeUrl"
        class="flex-1 w-full border-0"
        sandbox="allow-same-origin"
      ></iframe>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
