<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNewsletterStore } from '@/stores/newsletter'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const store = useNewsletterStore()
const isOpen = ref(false)

const filtered = computed(() => {
  const q = props.modelValue.toLowerCase().trim()
  if (!q) return store.zones
  return store.zones.filter(z => z.toLowerCase().includes(q))
})

function select(zone: string) {
  emit('update:modelValue', zone)
  isOpen.value = false
}

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  isOpen.value = true
}

function closeDelayed() {
  globalThis.setTimeout(() => isOpen.value = false, 200)
}
</script>

<template>
  <div class="relative flex-1">
    <input
      :value="modelValue"
      @input="onInput"
      @focus="isOpen = true"
      @blur="closeDelayed"
      type="text"
      class="input input-bordered input-sm w-full"
      placeholder="Nom de la région"
    />
    <ul
      v-if="isOpen && filtered.length > 0"
      class="absolute z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg mt-1 w-full max-h-48 overflow-y-auto"
    >
      <li
        v-for="zone in filtered"
        :key="zone"
        class="px-3 py-1.5 hover:bg-base-200 cursor-pointer text-sm"
        @mousedown.prevent="select(zone)"
      >
        {{ zone }}
      </li>
    </ul>
  </div>
</template>
