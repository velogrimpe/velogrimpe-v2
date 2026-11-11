import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// Types for carte data
export interface CarteFalaise {
  falaise_id: string
  falaise_nom: string
  falaise_altitude: string | null
  falaise_latlng: string
  falaise_fermee: string
  falaise_voletcarto: string
  falaise_bloc: string | null
  type: 'falaise' | 'falaise_hors_topo'
  access: CarteItineraire[]
  /** Arrêts reliés à pied (acces_falaise, type 'pied') */
  pieton?: Array<{ arret: CarteArret; acces?: CarteAccesPied }>
  filteredOut?: boolean
}

/** Accès à pied arrêt → falaise (km / D+ / D- quand renseignés) */
export interface CarteAccesPied {
  km: number | null
  dplus: number | null
  dmoins: number | null
  /** Une trace GPX existe pour cet accès (tracée sur la carte) */
  has_gpx?: boolean
}

export type ArretType = 'ter' | 'tgv' | 'bus' | 'tram' | 'telepherique'

export interface CarteArret {
  arret_id: number
  arret_nom: string
  arret_latlng: string
  types: ArretType[]
  /** Numéros des lignes de transport desservant l'arrêt (celles sans numéro sont omises) */
  lignes?: string[]
  type: 'arret' | 'arret_hors_topo'
  access: CarteItineraire[]
  /** Falaises reliées à pied (acces_falaise, type 'pied') */
  pieton: CarteFalaise[]
}

export interface CarteItineraire {
  velo_id: string
  velo_km: string
  velo_dplus: string
  velo_dmoins: string
  arret?: CarteArret
  falaise?: CarteFalaise
}

export type SelectedItem = (CarteFalaise | CarteArret) | null

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

  const isArretSelected = computed(() =>
    selectedType.value === 'arret' || selectedType.value === 'arret_hors_topo'
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
          id: 'falaise_id' in newSelected ? newSelected.falaise_id : newSelected.arret_id
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
    isArretSelected,
    hasFiltersApplied,
    // Actions
    setSelected,
    clearSelected,
    updateStats,
    getColorForIndex,
  }
})
