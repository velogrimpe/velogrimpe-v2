/**
 * Build script to generate optimized SVG sprite from icon definitions
 * Run with: bun run build:icons
 */

import { icons } from './src/icons/icons'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const outputPath = resolve(import.meta.dir, '../public_html/symbols/icons.svg')

function buildSprite(): string {
  const symbols = icons.map(icon => {
    const viewBox = icon.viewBox || '0 0 24 24'
    const paths = icon.paths.map(d => `<path d="${d}"/>`).join('')
    // stroke-linecap/linejoin doivent vivre sur la géométrie du sprite : posés
    // sur le wrapper <svg> côté <use>, ils ne franchissent pas la frontière de
    // référence externe. Sur le <symbol> ils sont hérités par les <path>.
    return `<symbol id="${icon.name}" viewBox="${viewBox}" stroke-linecap="round" stroke-linejoin="round">${paths}</symbol>`
  }).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none;">
  ${symbols}
</svg>
`
}

const sprite = buildSprite()
writeFileSync(outputPath, sprite)

const sizeKB = (Buffer.byteLength(sprite, 'utf8') / 1024).toFixed(1)
console.log(`✓ Generated ${outputPath}`)
console.log(`  ${icons.length} icons, ${sizeKB} KB`)
