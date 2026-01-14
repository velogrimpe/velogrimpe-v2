<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

export interface TransitousStation {
  name: string
  lat: number
  lon: number
  type: string
  id?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    disabled?: boolean
    debounceMs?: number
  }>(),
  {
    placeholder: '',
    disabled: false,
    debounceMs: 1000,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [station: TransitousStation | null]
}>()

const TRANSITOUS_API = 'https://api.transitous.org/api/v1/geocode'
const USER_AGENT = 'Vélogrimpe.fr (https://velogrimpe.fr) - v0.1 - contact@velogrimpe.fr'

const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLUListElement | null>(null)
const isOpen = ref(false)
const isLoading = ref(false)
const currentFocus = ref(-1)
const inputValue = ref(props.modelValue)
const stations = ref<TransitousStation[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.modelValue,
  (newVal) => {
    inputValue.value = newVal
  }
)

async function fetchStations(query: string) {
  if (!query || query.length < 2) {
    stations.value = []
    return
  }

  isLoading.value = true
  try {
    const url = `${TRANSITOUS_API}?text=${encodeURIComponent(query)}&type=STOP`
    const response = await fetch(url, {
      headers: { 'X-Client-Identification': USER_AGENT },
    })
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
    const data = await response.json()
    stations.value = data
      .filter((item: TransitousStation) => item.type === 'STOP')
      .slice(0, 10) // Limit to 10 results
  } catch (error) {
    console.error('[TransitousStationSearch] Error fetching stations:', error)
    stations.value = []
  } finally {
    isLoading.value = false
  }
}

function debouncedFetch(query: string) {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    fetchStations(query)
  }, props.debounceMs)
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  inputValue.value = target.value
  emit('update:modelValue', target.value)
  emit('select', null) // Clear selection when typing
  isOpen.value = true
  currentFocus.value = -1
  debouncedFetch(target.value)
}

function selectStation(station: TransitousStation) {
  inputValue.value = station.name
  emit('update:modelValue', station.name)
  emit('select', station)
  isOpen.value = false
  currentFocus.value = -1
  stations.value = []
}

function onKeydown(event: KeyboardEvent) {
  const items = stations.value

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (items.length > 0) {
      currentFocus.value = (currentFocus.value + 1) % items.length
      ensureVisible()
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (items.length > 0) {
      currentFocus.value = currentFocus.value <= 0 ? items.length - 1 : currentFocus.value - 1
      ensureVisible()
    }
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (currentFocus.value >= 0 && currentFocus.value < items.length) {
      selectStation(items[currentFocus.value])
    }
  } else if (event.key === 'Escape') {
    event.preventDefault()
    isOpen.value = false
    currentFocus.value = -1
  }
}

function ensureVisible() {
  if (currentFocus.value < 0 || !listRef.value) return
  const items = listRef.value.querySelectorAll('li')
  if (items[currentFocus.value]) {
    items[currentFocus.value].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

function onBlur() {
  // Delay to allow click events to fire
  setTimeout(() => {
    isOpen.value = false
  }, 200)
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (inputRef.value && !inputRef.value.contains(target) && listRef.value && !listRef.value.contains(target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <div class="relative w-full">
    <div class="relative">
      <input
        ref="inputRef"
        type="search"
        :value="inputValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="input input-sm w-full pr-8"
        autocomplete="off"
        @input="onInput"
        @keydown="onKeydown"
        @focus="isOpen = true"
        @blur="onBlur"
      />
      <span v-if="isLoading" class="absolute right-2 top-1/2 -translate-y-1/2">
        <span class="loading loading-spinner loading-xs"></span>
      </span>
      <svg v-else class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 fill-current opacity-50">
        <use xlink:href="/symbols/icons.svg#ri-search-line"></use>
      </svg>
    </div>
    <ul
      v-show="isOpen && stations.length > 0"
      ref="listRef"
      class="absolute w-full bg-white border border-primary mt-1 max-h-48 overflow-y-auto z-50 rounded-lg shadow-lg"
    >
      <li
        v-for="(station, index) in stations"
        :key="station.id || `${station.lat}-${station.lon}`"
        class="p-2 cursor-pointer hover:bg-primary hover:text-white text-sm"
        :class="{ 'bg-primary text-white': index === currentFocus }"
        @click="selectStation(station)"
      >
        {{ station.name }}
      </li>
    </ul>
    <div
      v-if="isOpen && !isLoading && inputValue.length >= 2 && stations.length === 0"
      class="absolute w-full bg-white border border-base-300 mt-1 p-2 text-sm text-base-content/60 rounded-lg"
    >
      Aucune gare trouvée
    </div>
  </div>
</template>
