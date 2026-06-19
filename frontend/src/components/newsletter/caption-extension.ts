import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    caption: {
      /** Transforme le bloc courant en légende d'image. */
      setCaption: () => ReturnType;
      /** Bascule entre légende d'image et paragraphe. */
      toggleCaption: () => ReturnType;
    };
  }
}

/**
 * Légende d'image : un bloc de type paragraphe rendu en `<p class="vg-caption">`.
 * Le style (centré, italique, gris, collé à l'élément précédent) est porté par
 * le CSS `.prose .vg-caption` (éditeur + pages publiques) et par la conversion
 * en styles inline côté email (newsletter_renderer.php).
 */
export const Caption = Node.create({
  name: "caption",
  group: "block",
  content: "inline*",
  defining: true,
  // Ne PAS relever la priorité d'extension au-dessus du paragraphe (1000) :
  // l'ordre des extensions détermine le bloc par défaut du schéma, et une
  // légende prioritaire deviendrait le bloc de remplissage / de scission.
  // La précédence de parsing se règle au niveau de la règle ci-dessous.

  parseHTML() {
    // `priority` ne joue que sur l'ordre des règles du DOMParser (défaut 50) :
    // « p.vg-caption » doit être testé avant le « p » générique du paragraphe.
    return [{ tag: "p.vg-caption", priority: 1100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { class: "vg-caption" }), 0];
  },

  addCommands() {
    return {
      setCaption:
        () =>
        ({ commands }) =>
          commands.setNode(this.name),
      toggleCaption:
        () =>
        ({ commands }) =>
          commands.toggleNode(this.name, "paragraph"),
    };
  },

  addKeyboardShortcuts() {
    return {
      // En fin de légende, Entrée crée un paragraphe normal (et non une nouvelle
      // légende), comportement attendu pour une légende d'image sur une ligne.
      Enter: () => {
        const { $from, empty } = this.editor.state.selection;
        if (!empty || $from.parent.type !== this.type) return false;
        const atEnd = $from.parentOffset === $from.parent.content.size;
        if (!atEnd) return false; // au milieu : on laisse le découpage par défaut
        const after = $from.after();
        return this.editor
          .chain()
          .insertContentAt(after, { type: "paragraph" })
          .setTextSelection(after + 1)
          .run();
      },
    };
  },
});
