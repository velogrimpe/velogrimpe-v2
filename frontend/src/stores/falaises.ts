import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Falaise, Gare, Ville } from '@/types'

export const useFalaisesStore = defineStore('falaises', () => {
  const falaises = ref<Falaise[]>([])
  const gares = ref<Gare[]>([])
  const villes = ref<Ville[]>([])
  const isInitialized = ref(false)

  function initialize(data: {
    falaises: Falaise[]
    gares: Gare[]
    villes: Ville[]
  }) {
    falaises.value = data.falaises
    gares.value = data.gares
    villes.value = data.villes
    isInitialized.value = true
  }

  return {
    falaises,
    gares,
    villes,
    isInitialized,
    initialize,
  }
})
