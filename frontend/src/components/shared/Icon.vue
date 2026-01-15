<script setup lang="ts">
/**
 * Icon component - displays an icon from the SVG sprite
 *
 * Usage:
 *   <Icon name="search" />
 *   <Icon name="search" class="w-6 h-6 text-primary" />
 *
 * Icons are loaded from /symbols/icons.svg sprite
 * See frontend/src/icons/icons.ts for available icons
 */

defineProps<{
  /** Icon name (e.g., 'search', 'filter', 'close') */
  name: string
}>()
</script>

<template>
  <svg class="w-4 h-4 fill-current" aria-hidden="true">
    <use :xlink:href="`/symbols/icons.svg#${name}`"></use>
  </svg>
</template>
