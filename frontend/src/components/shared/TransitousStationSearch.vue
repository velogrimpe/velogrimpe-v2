<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

export interface TransitousStationArea {
  name: string
  adminLevel: number
  matched: boolean
  unique: boolean
  default: boolean
}

export interface TransitousStation {
  name: string
  lat: number
  lon: number
  type: string
  id?: string
  country?: string
  modes?: string[]
  areas?: TransitousStationArea[]
}

function getStationLocation(station: TransitousStation): string {
  if (!station.areas) return ''
  const defaultArea = station.areas.find((a) => a.default)
  return defaultArea?.name || ''
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
    // Filter: only train stations (with rail services) in France
    const railModes = ['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'SUBURBAN']
    stations.value = data
      .filter((item: TransitousStation) => {
        if (item.type !== 'STOP') return false
        if (item.country !== 'FR') return false
        if (!item.modes?.some((m) => railModes.includes(m))) return false
        return true
      })
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
  <div class="relative w-full z-10">
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
      <svg v-else class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 fill-current opacity-50" viewBox="0 0 24 24">
        <path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z"></path>
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
        class="p-2 cursor-pointer hover:bg-primary hover:text-white text-sm flex items-start gap-2"
        :class="{ 'bg-primary text-white': index === currentFocus }"
        @click="selectStation(station)"
      >
        <!-- Train icon -->
        <svg class="w-4 h-4 mt-0.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.2 20L19 22H5L6.8 20H17.2ZM12 2C16.42 2 20 3.79 20 6V15C20 16.66 18.66 18 17 18H7C5.34 18 4 16.66 4 15V6C4 3.79 7.58 2 12 2ZM12 12C9.79 12 8 12.9 8 14C8 15.1 9.79 16 12 16C14.21 16 16 15.1 16 14C16 12.9 14.21 12 12 12ZM18 6C18 5.11 15.31 4 12 4C8.69 4 6 5.11 6 6V10H18V6Z"/>
        </svg>
        <!-- Station info -->
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">{{ station.name }}</div>
          <div v-if="getStationLocation(station)" class="text-xs opacity-70 truncate">
            {{ getStationLocation(station) }}
          </div>
        </div>
      </li>
    </ul>
    <div
      v-if="isOpen && !isLoading && inputValue.length >= 2 && stations.length === 0"
      class="absolute w-full bg-white border border-base-300 mt-1 p-2 text-sm text-base-content/60 rounded-lg z-50 shadow-lg"
    >
      Aucune gare trouvée
    </div>
  </div>
</template>
