import { Extension } from "@tiptap/core";

export type TextAlignValue = "left" | "center" | "right" | "justify";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlign: {
      /** Aligne les blocs concernés (paragraphes, titres). */
      setTextAlign: (alignment: TextAlignValue) => ReturnType;
      /** Retire l'alignement (retour au défaut, gauche). */
      unsetTextAlign: () => ReturnType;
    };
  }
}

/**
 * Alignement de texte : ajoute un attribut `textAlign` aux blocs listés,
 * sérialisé en `style="text-align: …"`. Réimplémentation minimale et fidèle de
 * `@tiptap/extension-text-align` (évite une dépendance/installation réseau).
 *
 * Rendu cohérent : `text-align` est respecté tel quel par le CSS `prose` des
 * pages publiques et par les clients mail (les `<p>` passent inchangés dans
 * `newsletter_renderer.php` ; les titres y préservent leur couleur).
 */
export const TextAlign = Extension.create({
  name: "textAlign",

  addOptions() {
    return {
      types: ["paragraph", "heading"] as string[],
      alignments: ["left", "center", "right", "justify"] as TextAlignValue[],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => {
              const align = element.style.textAlign as TextAlignValue | "";
              // « left » est le défaut : on ne le matérialise pas comme attribut.
              return align && align !== "left" ? align : null;
            },
            renderHTML: (attributes) => {
              if (!attributes.textAlign) return {};
              return { style: `text-align: ${attributes.textAlign}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (!this.options.alignments.includes(alignment)) return false;
          return this.options.types
            .map((type: string) => commands.updateAttributes(type, { textAlign: alignment }))
            .some((applied: boolean) => applied);
        },
      unsetTextAlign:
        () =>
        ({ commands }) =>
          this.options.types
            .map((type: string) => commands.resetAttributes(type, "textAlign"))
            .some((applied: boolean) => applied),
    };
  },
});
