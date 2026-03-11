<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { watch, onBeforeUnmount } from 'vue'
import EditorToolbar from './EditorToolbar.vue'
import { useNewsletterStore } from '@/stores/newsletter'

const props = defineProps<{
  html: string
  slug: string
}>()

const emit = defineEmits<{
  'update:html': [html: string]
}>()

const store = useNewsletterStore()

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
      blockquote: false,
    }),
    Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener' } }),
    Image.configure({ inline: false, allowBase64: false }),
  ],
  content: props.html,
  onUpdate: ({ editor }) => {
    emit('update:html', editor.getHTML())
  },
})

// Handle paste images
watch(editor, (ed) => {
  if (!ed) return
  ed.view.dom.addEventListener('paste', async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        const url = await store.uploadImage(file, props.slug)
        if (url) {
          ed.chain().focus().setImage({ src: url }).run()
        }
      }
    }
  })
}, { once: true })

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div v-if="editor" class="border border-base-300 rounded-lg">
    <EditorToolbar :editor="editor" />
    <EditorContent :editor="editor" class="prose max-w-none p-4 min-h-[200px] bg-base-100 rounded-b-lg" />
  </div>
</template>

<style>
.ProseMirror {
  min-height: 180px;
  cursor: text;
  background-color: var(--color-base-100);
}
.ProseMirror > :first-child {
  margin-top: 0;
}
.ProseMirror:focus {
  outline: none;
}
.ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
.ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid #2e8b57;
  outline-offset: 2px;
}
.ProseMirror h2 {
  color: #2e8b57;
}
.ProseMirror h3 {
  color: #2c3e50;
}
</style>
