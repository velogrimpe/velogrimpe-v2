/**
 * Shared utilities exported for use in non-Vue contexts (carte.php, etc.)
 * These are attached to window.velogrimpe for global access
 */
import { formatTime, calculateVeloTime } from '@/utils'
import '@/types/global.d'

// Export to window for use in inline scripts
window.velogrimpe = window.velogrimpe || {}
window.velogrimpe.formatTime = formatTime
window.velogrimpe.calculateVeloTime = calculateVeloTime

// Also export for ES module usage
export { formatTime, calculateVeloTime }
