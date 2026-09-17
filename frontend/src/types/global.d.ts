import type { SelectedItem } from '@/stores/carte'
import type { formatTime, calculateVeloTime } from '@/utils'

// Global velogrimpe namespace on window
export interface VelogrimpeGlobal {
  // From utils-global.js (synchronous script)
  format_time?: (minutes: number) => string
  calculate_time?: (velo: { velo_km: string; velo_dplus: string; velo_apieduniquement: string }) => number

  // From utils.ts (ES module)
  formatTime?: typeof formatTime
  calculateVeloTime?: typeof calculateVeloTime

  // From carte-info.ts
  carteInfo?: {
    setSelected: (item: SelectedItem) => void
    clearSelected: () => void
    updateStats: (total: number, filtered: number) => void
  }
}

// From contrib-storage.js
export interface ContribFieldIds {
  nomId?: string
  emailId?: string
}

export interface ContribStorage {
  getContribInfo: () => { nom: string; email: string }
  saveContribInfo: (nom: string, email: string) => void
  prefillContribInputs: (fields?: ContribFieldIds) => void
  attachFormSaveListener: (form: HTMLFormElement, fields?: ContribFieldIds) => void
}

declare global {
  interface Window {
    velogrimpe: VelogrimpeGlobal
    contribStorage: ContribStorage
  }
}

export {}
