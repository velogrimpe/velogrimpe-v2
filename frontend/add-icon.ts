#!/usr/bin/env bun
/**
 * Interactive script to add an icon from SVG
 * Usage: bun run add-icon
 *
 * Paste SVG from heroicons, remix-icons, or any source
 */

import { icons, type IconDefinition } from './src/icons/icons'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import * as readline from 'readline'

const ICONS_FILE = resolve(__dirname, 'src/icons/icons.ts')

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function readMultilineSVG(): Promise<string> {
  console.log('\nPaste the SVG (press Enter twice when done):')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    let svg = ''
    let emptyLineCount = 0

    rl.on('line', (line) => {
      if (line === '') {
        emptyLineCount++
        if (emptyLineCount >= 1 && svg.includes('</svg>')) {
          rl.close()
          resolve(svg.trim())
          return
        }
      } else {
        emptyLineCount = 0
      }
      svg += line + '\n'
    })
  })
}

// Read a numeric attribute (e.g. cx, r) from an element's opening tag.
function num(tag: string, name: string): number {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`))
  return m ? parseFloat(m[1]) : 0
}

// Read a string attribute (e.g. points, d) from an element's opening tag.
function str(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`))
  return m?.[1] ?? ''
}

// Convert SVG primitives (circle, line, rect, ellipse, poly*) to a path `d`.
// Stroke-based icon sets (Lucide, Heroicons...) mix <path> with these, and
// they must be preserved or the icon is incomplete (e.g. the sun's disc).
function primitiveToPath(tag: string): string | null {
  const type = tag.match(/^<\s*([a-zA-Z]+)/)?.[1]?.toLowerCase()
  switch (type) {
    case 'circle': {
      const cx = num(tag, 'cx'), cy = num(tag, 'cy'), r = num(tag, 'r')
      if (!r) return null
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
    }
    case 'ellipse': {
      const cx = num(tag, 'cx'), cy = num(tag, 'cy')
      const rx = num(tag, 'rx'), ry = num(tag, 'ry')
      if (!rx || !ry) return null
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`
    }
    case 'line': {
      const x1 = num(tag, 'x1'), y1 = num(tag, 'y1')
      const x2 = num(tag, 'x2'), y2 = num(tag, 'y2')
      return `M${x1} ${y1}L${x2} ${y2}`
    }
    case 'rect': {
      const x = num(tag, 'x'), y = num(tag, 'y')
      const w = num(tag, 'width'), h = num(tag, 'height')
      if (!w || !h) return null
      return `M${x} ${y}h${w}v${h}h${-w}Z`
    }
    case 'polyline':
    case 'polygon': {
      const pts = str(tag, 'points').trim().split(/[\s,]+/).map(parseFloat)
      if (pts.length < 4) return null
      let d = `M${pts[0]} ${pts[1]}`
      for (let i = 2; i < pts.length - 1; i += 2) d += `L${pts[i]} ${pts[i + 1]}`
      return type === 'polygon' ? d + 'Z' : d
    }
    default:
      return null
  }
}

function parseSVG(svg: string): { viewBox: string; paths: string[] } | null {
  // Extract viewBox
  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/)
  const viewBox = viewBoxMatch?.[1] || '0 0 24 24'

  const paths: string[] = []

  // Walk every drawable element in document order so the icon is preserved
  // exactly (shape order can matter for fills/overlaps).
  const elementRegex = /<\s*(path|circle|ellipse|line|rect|polyline|polygon)\b[^>]*?\/?>/gi
  let match
  while ((match = elementRegex.exec(svg)) !== null) {
    const tag = match[0]
    if (match[1].toLowerCase() === 'path') {
      const d = str(tag, 'd')
      if (d) paths.push(d)
    } else {
      const d = primitiveToPath(tag)
      if (d) paths.push(d)
    }
  }

  if (paths.length === 0) {
    return null
  }

  return { viewBox, paths }
}

function addIconToFile(icon: IconDefinition): void {
  let content = readFileSync(ICONS_FILE, 'utf-8')

  // Find the closing bracket of the icons array
  const insertPoint = content.lastIndexOf(']')

  if (insertPoint === -1) {
    throw new Error('Could not find icons array in file')
  }

  // Build the new icon entry
  const viewBoxPart = icon.viewBox && icon.viewBox !== '0 0 24 24' ? `viewBox: '${icon.viewBox}', ` : ''
  const pathsStr = icon.paths.map((p) => `'${p}'`).join(', ')
  const newEntry = `  { name: '${icon.name}', ${viewBoxPart}paths: [${pathsStr}] },\n`

  // Insert before the closing bracket
  // Find the last icon entry to insert after it
  const lastEntryEnd = content.lastIndexOf('},', insertPoint)
  if (lastEntryEnd !== -1) {
    content = content.slice(0, lastEntryEnd + 2) + '\n' + newEntry + content.slice(lastEntryEnd + 2)
  } else {
    content = content.slice(0, insertPoint) + newEntry + content.slice(insertPoint)
  }

  writeFileSync(ICONS_FILE, content)
}

async function main() {
  console.log('=== Add Icon to Velogrimpe ===\n')

  // Get icon name
  const name = await prompt('Icon name (lowercase, use hyphens): ')

  if (!name) {
    console.error('Error: Icon name is required')
    process.exit(1)
  }

  // Validate name format
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error('Error: Icon name must be lowercase, start with a letter, and use hyphens for spaces')
    process.exit(1)
  }

  // Check for duplicates
  const existingIcon = icons.find((i) => i.name === name)
  if (existingIcon) {
    console.error(`Error: Icon "${name}" already exists`)
    process.exit(1)
  }

  // Get SVG
  const svg = await readMultilineSVG()

  if (!svg) {
    console.error('Error: SVG is required')
    process.exit(1)
  }

  // Parse SVG
  const parsed = parseSVG(svg)

  if (!parsed) {
    console.error('Error: Could not extract paths from SVG. Make sure it contains <path d="..."> elements.')
    process.exit(1)
  }

  console.log(`\nExtracted ${parsed.paths.length} path(s)`)
  console.log(`viewBox: ${parsed.viewBox}`)


  // Add to file
  const newIcon: IconDefinition = {
    name,
    ...(parsed.viewBox !== '0 0 24 24' && { viewBox: parsed.viewBox }),
    paths: parsed.paths,
  }

  try {
    addIconToFile(newIcon)
    console.log(`\n✓ Added icon "${name}" to icons.ts`)

    // Run build:icons
    console.log('\nRebuilding sprite...')
    const proc = Bun.spawn(['bun', 'run', 'build:icons'], {
      cwd: __dirname,
      stdout: 'inherit',
      stderr: 'inherit',
    })
    await proc.exited

    console.log(`\n✓ Icon "${name}" is ready to use!`)
    console.log(`\n  PHP:  <?= icon('${name}') ?>`)
    console.log(`  Vue:  <Icon name="${name}" />`)
  } catch (error) {
    console.error('Error adding icon:', error)
    process.exit(1)
  }
}

main()
