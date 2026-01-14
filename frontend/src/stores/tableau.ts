import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFiltersStore } from './filters'
import { calculateVeloTime } from '@/utils'
import type { SortState, SortKey, SortDir, TableauFalaise } from '@/types/tableau'

export const useTableauStore = defineStore('tableau', () => {
  const filtersStore = useFiltersStore()

  // Raw falaises data from PHP
  const falaises = ref<TableauFalaise[]>([])
  const villeId = ref<number | null>(null)
  const isInitialized = ref(false)

  // Sort state
  const sort = ref<SortState>({ key: 'total', dir: 'asc' })

  function initialize(data: { falaises: TableauFalaise[]; villeId: number }) {
    falaises.value = data.falaises
    villeId.value = data.villeId
    isInitialized.value = true
  }

  function setSort(key: SortKey, dir: SortDir) {
    sort.value = { key, dir }
  }

  function toggleSort(key: SortKey) {
    if (sort.value.key === key) {
      sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
    } else {
      sort.value = { key, dir: 'asc' }
    }
  }

  // Compute metrics for sorting
  function metricsForFalaise(f: TableauFalaise) {
    const minTotal = Math.min(...f.map(it => it.temps_total || 0))
    const minTrain = Math.min(...f.map(it => it.train_temps || 0))
    const minVelo = Math.min(...f.map(it => calculateVeloTime(it)))
    const nbVoies = f[0].falaise_nbvoies || 0
    const approche = f[0].falaise_maa || 0
    return { minTotal, minTrain, minVelo, nbVoies, approche }
  }

  // Check if a falaise passes the current filters
  function passesFilters(falaiseItineraries: TableauFalaise): boolean {
    const f = filtersStore.filters
    const falaise = falaiseItineraries[0]

    // Extract filter values
    const expoN = f.exposition.includes('N')
    const expoE = f.exposition.includes('E')
    const expoS = f.exposition.includes('S')
    const expoO = f.exposition.includes('O')
    const expoFiltered = f.exposition.length > 0

    const cotFiltered = f.cotations.length > 0
    const cot40 = f.cotations.includes('40')
    const cot50 = f.cotations.includes('50')
    const cot59 = f.cotations.includes('59')
    const cot60 = f.cotations.includes('60')
    const cot69 = f.cotations.includes('69')
    const cot70 = f.cotations.includes('70')
    const cot79 = f.cotations.includes('79')
    const cot80 = f.cotations.includes('80')

    const { couenne, grandeVoie: avecgv, bloc, psychobloc } = f.typeVoies
    const typeVoiesFiltered = couenne || avecgv || bloc || psychobloc

    const { tempsMax: tempsMaxVelo, distMax: distMaxVelo, denivMax: denivMaxVelo, apiedPossible: apieduniquement } = f.velo
    const { tempsMax: tempsMaxTrain, correspMax, terOnly } = f.train
    const nbCorrespMax = correspMax !== null ? correspMax : 10
    const { tempsMax: tempsMaxMA } = f.approche
    const { tempsTV: tempsMaxTV, tempsTVA: tempsMaxTVA } = f.total
    const nbVoies = f.nbVoiesMin

    // Cotation compatibility check
    const estCotationsCompatible = (
      (!cot40 || ('4+'.localeCompare(falaise.falaise_cotmin) >= 0)) &&
      (!cot50 || ('5-'.localeCompare(falaise.falaise_cotmin) >= 0 && falaise.falaise_cotmax.localeCompare('5-') >= 0)) &&
      (!cot59 || ('5+'.localeCompare(falaise.falaise_cotmin) >= 0 && falaise.falaise_cotmax.localeCompare('5+') >= 0)) &&
      (!cot60 || ('6-'.localeCompare(falaise.falaise_cotmin) >= 0 && falaise.falaise_cotmax.localeCompare('6-') >= 0)) &&
      (!cot69 || ('6+'.localeCompare(falaise.falaise_cotmin) >= 0 && falaise.falaise_cotmax.localeCompare('6+') >= 0)) &&
      (!cot70 || ('7-'.localeCompare(falaise.falaise_cotmin) >= 0 && falaise.falaise_cotmax.localeCompare('7-') >= 0)) &&
      (!cot79 || ('7+'.localeCompare(falaise.falaise_cotmin) >= 0 && falaise.falaise_cotmax.localeCompare('7+') >= 0)) &&
      (!cot80 || (falaise.falaise_cotmax.localeCompare('8-') >= 0))
    )

    const estNbVoiesCompatible = falaise.falaise_nbvoies >= nbVoies || nbVoies === 0

    const estTypeVoiesCompatible = (
      (couenne && !falaise.falaise_bloc) ||
      (avecgv && !!falaise.falaise_gvnb) ||
      (bloc && falaise.falaise_bloc === 1) ||
      (psychobloc && falaise.falaise_bloc === 2)
    )

    const estTrainCompatible = falaiseItineraries.some(it => {
      const duration = calculateVeloTime(it)
      const isTerOk = !terOnly || (it.train_tgv || 0) === 0
      return (
        isTerOk &&
        (tempsMaxTrain === null || it.train_temps <= tempsMaxTrain) &&
        (nbCorrespMax === 10 || it.train_correspmax <= nbCorrespMax) &&
        (tempsMaxTV === null || it.train_temps + duration <= tempsMaxTV) &&
        (tempsMaxTVA === null || it.temps_total <= tempsMaxTVA)
      )
    })

    // Exposition check
    const expoMatch = !expoFiltered || !!(
      (expoN && (falaise.falaise_exposhort1.includes("'N") || falaise.falaise_exposhort2.includes("'N"))) ||
      (expoE && (falaise.falaise_exposhort1.match(/('E|'NE'|'SE')/) || falaise.falaise_exposhort2.match(/('E|'NE'|'SE')/))) ||
      (expoS && (falaise.falaise_exposhort1.includes("'S") || falaise.falaise_exposhort2.includes("'S"))) ||
      (expoO && (falaise.falaise_exposhort1.match(/('O|'NO'|'SO')/) || falaise.falaise_exposhort2.match(/('O|'NO'|'SO')/)))
    )

    // Velo/access check
    const veloMatch = falaiseItineraries.some(it => {
      const duration = calculateVeloTime(it)
      return (
        (tempsMaxVelo === null || duration <= tempsMaxVelo) &&
        (denivMaxVelo === null || it.velo_dplus <= denivMaxVelo) &&
        (distMaxVelo === null || it.velo_km <= distMaxVelo) &&
        (!apieduniquement || it.velo_apieduniquement === 1 || it.velo_apiedpossible === 1)
      )
    })

    return (
      expoMatch &&
      (!cotFiltered || estCotationsCompatible) &&
      estNbVoiesCompatible &&
      (tempsMaxMA === null || (falaise.falaise_maa || 0) <= tempsMaxMA) &&
      (!typeVoiesFiltered || estTypeVoiesCompatible) &&
      estTrainCompatible &&
      veloMatch
    )
  }

  // Filtered falaises
  const filteredFalaises = computed(() => {
    return falaises.value.filter(f => passesFilters(f))
  })

  // Sorted and filtered falaises
  const sortedFalaises = computed(() => {
    const filtered = [...filteredFalaises.value]

    filtered.sort((a, b) => {
      const ma = metricsForFalaise(a)
      const mb = metricsForFalaise(b)
      let va = 0, vb = 0

      switch (sort.value.key) {
        case 'total': va = ma.minTotal; vb = mb.minTotal; break
        case 'train': va = ma.minTrain; vb = mb.minTrain; break
        case 'velo': va = ma.minVelo; vb = mb.minVelo; break
        case 'voies': va = ma.nbVoies; vb = mb.nbVoies; break
        case 'approche': va = ma.approche; vb = mb.approche; break
      }

      const cmp = va === vb ? 0 : (va < vb ? -1 : 1)
      return sort.value.dir === 'asc' ? cmp : -cmp
    })

    return filtered
  })

  // Stats
  const totalCount = computed(() => falaises.value.length)
  const filteredCount = computed(() => filteredFalaises.value.length)

  return {
    // State
    falaises,
    villeId,
    isInitialized,
    sort,
    // Computed
    sortedFalaises,
    totalCount,
    filteredCount,
    // Actions
    initialize,
    setSort,
    toggleSort,
    calculateVeloTime,
  }
})

// Re-export for convenience
export { calculateVeloTime } from '@/utils'
