<script setup lang="ts">
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { watch, onBeforeUnmount } from "vue";
import EditorToolbar from "./EditorToolbar.vue";
import { Caption } from "./caption-extension";

const props = defineProps<{
  html: string;
  upload: (file: File) => Promise<string | null>;
}>();

const emit = defineEmits<{
  "update:html": [html: string];
}>();

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
      blockquote: false,
      link: {
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener" },
      },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Caption,
  ],
  content: props.html,
  onUpdate: ({ editor }) => {
    emit("update:html", editor.getHTML());
  },
});

// Handle paste images
watch(
  editor,
  (ed) => {
    if (!ed) return;
    ed.view.dom.addEventListener("paste", async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const url = await props.upload(file);
          if (url) {
            ed.chain().focus().setImage({ src: url }).run();
          }
        }
      }
    });
  },
  { once: true },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div
    v-if="editor"
    class="border border-base-300 rounded-lg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
  >
    <EditorToolbar :editor="editor" />
    <EditorContent
      :editor="editor"
      class="prose prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 max-w-none bg-base-100 rounded-b-lg [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:p-1 [&_.ProseMirror]:cursor-text [&_.ProseMirror]:outline-none"
    />
  </div>
</template>

<style>
.ProseMirror {
  background-color: var(--color-base-100);
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
