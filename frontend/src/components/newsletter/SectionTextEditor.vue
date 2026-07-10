<script setup lang="ts">
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { watch, onBeforeUnmount } from "vue";
import EditorToolbar from "./EditorToolbar.vue";
import { Caption } from "./caption-extension";
import { ResizableImage } from "./resizable-image";

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
    ResizableImage.configure({
      inline: false,
      allowBase64: false,
      // Poignées de redimensionnement ; on verrouille le ratio (seule la
      // largeur est persistée) et on limite la largeur mini à 40px.
      resize: {
        enabled: true,
        directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
        minWidth: 40,
        minHeight: 40,
        alwaysPreserveAspectRatio: true,
      },
    }),
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
/* Image non redimensionnée (rendu sans node view) : contour de sélection direct. */
.ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid #2e8b57;
  outline-offset: 2px;
}

/* --- Image redimensionnable (node view TipTap) --- */
.ProseMirror [data-resize-container] {
  margin: 0.5rem 0;
}
/* Le wrapper épouse l'image (TipTap lui met `display:block` en inline, ce qui
   l'étirerait sinon) pour que le contour et les poignées collent à l'image. */
.ProseMirror [data-resize-wrapper] {
  width: fit-content;
  max-width: 100%;
}
.ProseMirror [data-resize-wrapper] img {
  display: block;
  /* Neutralise les marges de `.prose :where(img)` (2em haut/bas) : en contexte
     flex elles ne se collapsent pas et gonfleraient le wrapper, décalant les
     poignées hors des coins de l'image. L'espacement vient du conteneur. */
  margin: 0;
}
/* Contour de sélection porté par l'image elle-même (bornes exactes, sans marge). */
.ProseMirror
  [data-resize-container].ProseMirror-selectednode
  [data-resize-wrapper]
  img {
  outline: 2px solid #2e8b57;
  outline-offset: 2px;
}
/* Poignées : masquées, révélées au survol ou quand l'image est sélectionnée. */
.ProseMirror [data-resize-handle] {
  width: 12px;
  height: 12px;
  background: #2e8b57;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}
.ProseMirror [data-resize-container]:hover [data-resize-handle],
.ProseMirror
  [data-resize-container].ProseMirror-selectednode
  [data-resize-handle] {
  opacity: 1;
}
/* Recentre chaque poignée 12px sur son coin et fixe le curseur diagonal. */
.ProseMirror [data-resize-handle="top-left"] {
  margin: -7px 0 0 -7px;
  cursor: nwse-resize;
}
.ProseMirror [data-resize-handle="top-right"] {
  margin: -7px -7px 0 0;
  cursor: nesw-resize;
}
.ProseMirror [data-resize-handle="bottom-left"] {
  margin: 0 0 -7px -7px;
  cursor: nesw-resize;
}
.ProseMirror [data-resize-handle="bottom-right"] {
  margin: 0 -7px -7px 0;
  cursor: nwse-resize;
}
.ProseMirror h2 {
  color: #2e8b57;
}
.ProseMirror h3 {
  color: #2c3e50;
}
</style>
