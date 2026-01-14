/**
 * Shared utilities exported for use in non-Vue contexts (carte.php, etc.)
 * These are attached to window.velogrimpe for global access
 */
import { formatTime, calculateVeloTime } from '@/utils'

// Export to window for use in inline scripts
declare global {
  interface Window {
    velogrimpe: {
      formatTime: typeof formatTime
      calculateVeloTime: typeof calculateVeloTime
    }
  }
}

window.velogrimpe = {
  formatTime,
  calculateVeloTime,
}

// Also export for ES module usage
export { formatTime, calculateVeloTime }
