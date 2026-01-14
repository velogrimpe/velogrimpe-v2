import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// Types for carte data
export interface CarteFalaise {
  falaise_id: string
  falaise_nom: string
  falaise_latlng: string
  falaise_fermee: string
  falaise_voletcarto: string
  falaise_bloc: string | null
  type: 'falaise' | 'falaise_hors_topo'
  access: CarteItineraire[]
  filteredOut?: boolean
}

export interface CarteGare {
  gare_id: string
  gare_nom: string
  gare_latlng: string
  gare_tgv: string
  type: 'gare' | 'gare_hors_topo'
  access: CarteItineraire[]
}

export interface CarteItineraire {
  velo_id: string
  velo_km: string
  velo_dplus: string
  velo_dmoins: string
  velo_apieduniquement: string
  gare?: CarteGare
  falaise?: CarteFalaise
}

export type SelectedItem = (CarteFalaise | CarteGare) | null

export const useCarteStore = defineStore('carte', () => {
  // State
  const selected = ref<SelectedItem>(null)
  const totalFalaises = ref(0)
  const filteredFalaises = ref(0)
  const itinerairesColors = [
    'indianRed', 'tomato', 'teal', 'paleVioletRed', 'mediumSlateBlue',
    'lightSalmon', 'fireBrick', 'crimson', 'purple', 'hotPink', 'mediumOrchid'
  ]

  // Computed
  const selectedType = computed(() => {
    if (!selected.value) return null
    return selected.value.type
  })

  const isFalaiseSelected = computed(() =>
    selectedType.value === 'falaise' || selectedType.value === 'falaise_hors_topo'
  )

  const isGareSelected = computed(() =>
    selectedType.value === 'gare' || selectedType.value === 'gare_hors_topo'
  )

  const hasFiltersApplied = computed(() =>
    totalFalaises.value !== filteredFalaises.value
  )

  // Actions
  function setSelected(item: SelectedItem) {
    selected.value = item
  }

  function clearSelected() {
    selected.value = null
  }

  function updateStats(total: number, filtered: number) {
    totalFalaises.value = total
    filteredFalaises.value = filtered
  }

  function getColorForIndex(index: number): string {
    return itinerairesColors[index % itinerairesColors.length]
  }

  // Emit changes to Leaflet code
  watch(selected, (newSelected) => {
    window.dispatchEvent(
      new CustomEvent('velogrimpe:selection', {
        detail: newSelected ? {
          type: newSelected.type,
          id: 'falaise_id' in newSelected ? newSelected.falaise_id : newSelected.gare_id
        } : null
      })
    )
  })

  return {
    // State
    selected,
    totalFalaises,
    filteredFalaises,
    itinerairesColors,
    // Computed
    selectedType,
    isFalaiseSelected,
    isGareSelected,
    hasFiltersApplied,
    // Actions
    setSelected,
    clearSelected,
    updateStats,
    getColorForIndex,
  }
})
