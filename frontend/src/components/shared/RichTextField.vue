<script setup lang="ts">
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { ref, onBeforeUnmount } from "vue";

const props = withDefaults(
  defineProps<{
    /** Nom du champ POST (un input caché portera ce name). */
    name: string;
    /** HTML initial (mode édition). */
    modelValue?: string;
    /** Champ obligatoire : valide comme un input classique (cf. validate()). */
    required?: boolean;
  }>(),
  {
    modelValue: "",
    required: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [html: string];
}>();

// Valeur réellement soumise via l'input caché (vide si éditeur vide, pour ne
// pas envoyer un "<p></p>" parasite). Pilotée par onUpdate (réactivité fiable).
const html = ref(props.modelValue);
// Passe à true quand validate() échoue ; affiche le message d'erreur sous le champ.
const invalid = ref(false);

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      // On garde uniquement gras / italique / barré / souligné + liste à puces + lien.
      heading: false,
      codeBlock: false,
      code: false,
      blockquote: false,
      horizontalRule: false,
      orderedList: false,
      // Link est fourni par StarterKit v3 : on le configure ici (pas de doublon)
      // pour que le clic n'ouvre pas le lien pendant l'édition.
      link: {
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener nofollow" },
      },
    }),
  ],
  content: props.modelValue,
  onUpdate: ({ editor }) => {
    html.value = editor.isEmpty ? "" : editor.getHTML();
    emit("update:modelValue", html.value);
    // L'erreur disparaît dès que l'utilisateur saisit du contenu valide.
    if (invalid.value && !isEmpty()) invalid.value = false;
  },
});

/** Vrai si le champ ne contient aucun texte réel (gère "<p></p>", &nbsp;, etc.). */
function isEmpty(): boolean {
  if (!html.value) return true;
  const tmp = document.createElement("div");
  tmp.innerHTML = html.value;
  return (tmp.textContent || "").replace(/\u00a0/g, "").trim() === "";
}

/** Validation type "input required" : renvoie true si valide, sinon affiche l'erreur. */
function validate(): boolean {
  const ok = !props.required || !isEmpty();
  invalid.value = !ok;
  return ok;
}

function setLink() {
  const ed = editor.value;
  if (!ed) return;
  const previousUrl = ed.getAttributes("link").href;
  const url = window.prompt("URL du lien :", previousUrl);
  if (url === null) return;
  if (url === "") {
    ed.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  ed.chain()
    .focus()
    .extendMarkRange("link")
    .setLink({
      href: url,
      target: "_blank",
      rel: "noopener nofollow",
    })
    .run();
}

/** Permet au prefill PHP (mode édition) de réinjecter du contenu. */
function setContent(html: string) {
  editor.value?.commands.setContent(html || "", { emitUpdate: true });
}
defineExpose({ setContent, validate });

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div v-if="editor">
  <div
    class="border rounded-lg bg-base-100 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
    :class="invalid ? 'border-error' : 'border-base-300'"
  >
    <div
      class="flex flex-wrap items-center gap-0.5 p-1 border-b border-base-300 bg-base-200 rounded-t-lg"
    >
      <button
        type="button"
        class="btn btn-xs btn-ghost font-bold"
        :class="{ 'btn-active': editor.isActive('bold') }"
        @click="editor.chain().focus().toggleBold().run()"
        title="Gras (Ctrl+B)"
      >
        G
      </button>
      <button
        type="button"
        class="btn btn-xs btn-ghost italic"
        :class="{ 'btn-active': editor.isActive('italic') }"
        @click="editor.chain().focus().toggleItalic().run()"
        title="Italique (Ctrl+I)"
      >
        I
      </button>
      <button
        type="button"
        class="btn btn-xs btn-ghost underline"
        :class="{ 'btn-active': editor.isActive('underline') }"
        @click="editor.chain().focus().toggleUnderline().run()"
        title="Souligné (Ctrl+U)"
      >
        U
      </button>
      <button
        type="button"
        class="btn btn-xs btn-ghost line-through"
        :class="{ 'btn-active': editor.isActive('strike') }"
        @click="editor.chain().focus().toggleStrike().run()"
        title="Barré"
      >
        S
      </button>

      <span class="w-px h-5 bg-base-300 mx-1"></span>

      <button
        type="button"
        class="btn btn-xs btn-ghost"
        :class="{ 'btn-active': editor.isActive('link') }"
        @click="setLink"
        title="Lien"
      >
        <svg
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
          />
          <path
            d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
          />
        </svg>
      </button>
      <button
        type="button"
        class="btn btn-xs btn-ghost"
        :class="{ 'btn-active': editor.isActive('bulletList') }"
        @click="editor.chain().focus().toggleBulletList().run()"
        title="Liste à puces"
      >
        <svg
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" />
          <circle cx="4" cy="12" r="1" fill="currentColor" />
          <circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </button>
    </div>
    <EditorContent
      :editor="editor"
      class="prose prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 max-w-none [&_.ProseMirror]:min-h-[3.5rem] [&_.ProseMirror]:p-1 [&_.ProseMirror]:cursor-text [&_.ProseMirror]:outline-none"
    />
    <input type="hidden" :name="name" :value="html" />
  </div>
    <p v-if="invalid" class="text-error text-sm mt-1">Ce champ est obligatoire.</p>
  </div>
</template>
