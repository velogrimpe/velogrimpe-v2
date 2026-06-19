<script setup lang="ts">
import { computed } from 'vue'
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor
}>()

function setLink() {
  const previousUrl = props.editor.getAttributes('link').href
  const url = window.prompt('URL du lien :', previousUrl)
  if (url === null) return
  if (url === '') {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  props.editor.chain().focus().extendMarkRange('link').setLink({
    href: url,
    target: '_blank',
    rel: 'noopener',
  }).run()
}

function addImage() {
  const url = window.prompt("URL de l'image :")
  if (url) {
    props.editor.chain().focus().setImage({ src: url }).run()
  }
}

const currentColor = computed(() => props.editor.getAttributes('textStyle').color || '#000000')
const currentHighlight = computed(() => props.editor.getAttributes('highlight').color || '#ffff00')

function setColor(event: Event) {
  const color = (event.target as HTMLInputElement).value
  props.editor.chain().focus().setColor(color).run()
}

function unsetColor() {
  props.editor.chain().focus().unsetColor().run()
}

function setHighlight(event: Event) {
  const color = (event.target as HTMLInputElement).value
  props.editor.chain().focus().setHighlight({ color }).run()
}

function unsetHighlight() {
  props.editor.chain().focus().unsetHighlight().run()
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-0.5 p-2 border-b border-base-300 bg-base-200 rounded-t-lg">
    <!-- Block type -->
    <button
      class="btn btn-xs btn-ghost"
      :class="{ 'btn-active': editor.isActive('paragraph') && !editor.isActive('heading') }"
      @click="editor.chain().focus().setParagraph().run()"
      title="Paragraphe"
    >P</button>
    <button
      class="btn btn-xs btn-ghost"
      :class="{ 'btn-active': editor.isActive('heading', { level: 2 }) }"
      @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      title="Titre H2"
    >H2</button>
    <button
      class="btn btn-xs btn-ghost"
      :class="{ 'btn-active': editor.isActive('heading', { level: 3 }) }"
      @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      title="Titre H3"
    >H3</button>
    <button
      class="btn btn-xs btn-ghost"
      :class="{ 'btn-active': editor.isActive('caption') }"
      @click="editor.chain().focus().toggleCaption().run()"
      title="Légende d'image (centré, italique, gris)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="12" rx="2" ry="2"/><line x1="7" y1="19" x2="17" y2="19"/></svg>
    </button>

    <span class="w-px h-5 bg-base-300 mx-1"></span>

    <!-- Inline marks -->
    <button
      class="btn btn-xs btn-ghost font-bold"
      :class="{ 'btn-active': editor.isActive('bold') }"
      @click="editor.chain().focus().toggleBold().run()"
      title="Gras (Ctrl+B)"
    >G</button>
    <button
      class="btn btn-xs btn-ghost italic"
      :class="{ 'btn-active': editor.isActive('italic') }"
      @click="editor.chain().focus().toggleItalic().run()"
      title="Italique (Ctrl+I)"
    >I</button>
    <button
      class="btn btn-xs btn-ghost underline"
      :class="{ 'btn-active': editor.isActive('underline') }"
      @click="editor.chain().focus().toggleUnderline().run()"
      title="Souligné (Ctrl+U)"
    >U</button>
    <button
      class="btn btn-xs btn-ghost line-through"
      :class="{ 'btn-active': editor.isActive('strike') }"
      @click="editor.chain().focus().toggleStrike().run()"
      title="Barré (Ctrl+Shift+S)"
    >S</button>

    <span class="w-px h-5 bg-base-300 mx-1"></span>

    <!-- Text color -->
    <label
      class="btn btn-xs btn-ghost px-1 cursor-pointer"
      :class="{ 'btn-active': editor.isActive('textStyle', { color: /.*/ }) }"
      title="Couleur du texte"
    >
      <span class="font-bold leading-none" :style="{ color: currentColor }">A</span>
      <span class="block w-3 h-1 mt-0.5" :style="{ backgroundColor: currentColor }"></span>
      <input
        type="color"
        class="sr-only"
        :value="currentColor"
        @input="setColor"
      />
    </label>
    <button
      class="btn btn-xs btn-ghost px-1"
      @click="unsetColor"
      title="Retirer la couleur du texte"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M6 16 L12 4 L18 16"/><line x1="4" y1="4" x2="20" y2="20" stroke="red"/></svg>
    </button>

    <!-- Highlight / background -->
    <label
      class="btn btn-xs btn-ghost px-1 cursor-pointer"
      :class="{ 'btn-active': editor.isActive('highlight') }"
      title="Couleur de fond"
    >
      <span class="font-bold leading-none px-0.5 rounded-sm" :style="{ backgroundColor: currentHighlight }">A</span>
      <input
        type="color"
        class="sr-only"
        :value="currentHighlight"
        @input="setHighlight"
      />
    </label>
    <button
      class="btn btn-xs btn-ghost px-1"
      @click="unsetHighlight"
      title="Retirer la couleur de fond"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l-6 6v3h3l6-6"/><path d="M14 6l4-4 4 4-8 8H10v-4z"/><line x1="4" y1="4" x2="20" y2="20" stroke="red"/></svg>
    </button>

    <span class="w-px h-5 bg-base-300 mx-1"></span>

    <!-- Link -->
    <button
      class="btn btn-xs btn-ghost"
      :class="{ 'btn-active': editor.isActive('link') }"
      @click="setLink"
      title="Lien (Ctrl+K)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </button>

    <span class="w-px h-5 bg-base-300 mx-1"></span>

    <!-- Lists -->
    <button
      class="btn btn-xs btn-ghost"
      :class="{ 'btn-active': editor.isActive('bulletList') }"
      @click="editor.chain().focus().toggleBulletList().run()"
      title="Liste à puces"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
    </button>
    <button
      class="btn btn-xs btn-ghost"
      :class="{ 'btn-active': editor.isActive('orderedList') }"
      @click="editor.chain().focus().toggleOrderedList().run()"
      title="Liste numérotée"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="2" y="14" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="2" y="20" font-size="7" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg>
    </button>

    <span class="w-px h-5 bg-base-300 mx-1"></span>

    <!-- Image & separator -->
    <button
      class="btn btn-xs btn-ghost"
      @click="addImage"
      title="Image (URL)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    </button>
    <button
      class="btn btn-xs btn-ghost"
      @click="editor.chain().focus().setHorizontalRule().run()"
      title="Séparateur horizontal"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
    </button>

    <span class="w-px h-5 bg-base-300 mx-1"></span>

    <!-- Undo / Redo -->
    <button
      class="btn btn-xs btn-ghost"
      :disabled="!editor.can().undo()"
      @click="editor.chain().focus().undo().run()"
      title="Annuler (Ctrl+Z)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
    </button>
    <button
      class="btn btn-xs btn-ghost"
      :disabled="!editor.can().redo()"
      @click="editor.chain().focus().redo().run()"
      title="Rétablir (Ctrl+Shift+Z)"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg>
    </button>
  </div>
</template>
