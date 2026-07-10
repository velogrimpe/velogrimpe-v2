import Image from "@tiptap/extension-image";

/**
 * Image redimensionnable par poignées (drag), fondée sur le node view de resize
 * intégré à TipTap v3 (`Image.configure({ resize })`).
 *
 * Particularité : seule la LARGEUR est sérialisée, en attribut HTML `width="N"`
 * (pixels). La hauteur est suivie en interne pour verrouiller le ratio pendant
 * le glissement, mais n'est PAS écrite dans le HTML. Raisons :
 *  - le renderer email (newsletter_renderer.php) conserve l'attribut `width=` et
 *    ajoute systématiquement `height="auto"` ; un `height="N"` en dur créerait un
 *    attribut dupliqué et casserait le ratio ;
 *  - sur les pages publiques le HTML est sorti tel quel : `width` + `height:auto`
 *    (CSS) garantit un affichage responsive (l'image se réduit sous `max-width`).
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    const parent: Record<string, unknown> = this.parent?.() ?? {};
    return {
      ...parent,
      height: {
        ...((parent.height as object) ?? { default: null }),
        // Non sérialisée : voir l'en-tête du fichier.
        renderHTML: () => ({}),
      },
    };
  },
});
