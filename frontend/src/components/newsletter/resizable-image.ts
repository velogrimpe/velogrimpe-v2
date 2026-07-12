import Image from "@tiptap/extension-image";
import { ResizableNodeView } from "@tiptap/core";

export type ImageAlign = "left" | "center" | "right";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      /** Aligne l'image sélectionnée (gauche/centré/droite). */
      setImageAlign: (align: ImageAlign) => ReturnType;
    };
  }
}

/** Alignement d'image => propriété flex du conteneur du node view. */
const JUSTIFY: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

/**
 * Image redimensionnable (poignées) ET alignable (gauche/centré/droite), fondée
 * sur le node view de resize intégré à TipTap v3 (`ResizableNodeView`).
 *
 * Sérialisation :
 *  - largeur => attribut HTML `width="N"` (px). La hauteur est suivie en interne
 *    pour le ratio pendant le drag, mais NON sérialisée (le rendu applique
 *    `height:auto`, garantissant un affichage responsive).
 *  - alignement => `data-align="…"` (robuste : survit au nettoyage de `style` du
 *    renderer email) + `style` margin pour les pages publiques (image en bloc).
 *    Absent quand l'alignement n'est pas défini (l'email centre par défaut).
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
      align: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-align") || null,
        renderHTML: (attributes: { align?: string | null }) => {
          if (!attributes.align) return {};
          const out: Record<string, string> = { "data-align": attributes.align };
          if (attributes.align === "center") {
            out.style = "display:block;margin-left:auto;margin-right:auto";
          } else if (attributes.align === "right") {
            out.style = "display:block;margin-left:auto";
          }
          return out;
        },
      },
    };
  },

  addCommands() {
    return {
      ...(this.parent?.() ?? {}),
      setImageAlign:
        (align: ImageAlign) =>
        ({ commands }: { commands: any }) =>
          commands.updateAttributes(this.name, { align }),
    };
  },

  // Node view custom : identique au resize intégré, avec en plus la gestion de
  // l'alignement (justify-content du conteneur + reconstruction quand l'align
  // change, le node view intégré ne réappliquant pas les attributs à chaud).
  addNodeView() {
    const resize = (this.options as any).resize;
    if (!resize || !resize.enabled || typeof document === "undefined") {
      return null;
    }
    const { directions, minWidth, minHeight, alwaysPreserveAspectRatio } = resize;
    const name = this.name;
    return ({ node, getPos, HTMLAttributes, editor }: any) => {
      const el = document.createElement("img");
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value != null && key !== "width" && key !== "height") {
          el.setAttribute(key, String(value));
        }
      });
      el.src = HTMLAttributes.src;

      const nodeView = new (ResizableNodeView as any)({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width: number, height: number) => {
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;
        },
        onCommit: (width: number, height: number) => {
          const pos = getPos();
          if (pos === undefined) return;
          editor.chain().setNodeSelection(pos).updateAttributes(name, { width, height }).run();
        },
        onUpdate: (updatedNode: any) => {
          if (updatedNode.type !== node.type) return false;
          // Force la reconstruction quand l'alignement change (sinon non reflété).
          if (updatedNode.attrs.align !== node.attrs.align) return false;
          return true;
        },
        options: {
          directions,
          min: { width: minWidth, height: minHeight },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
        },
      });

      const dom = nodeView.dom as HTMLElement;
      dom.style.justifyContent = JUSTIFY[node.attrs.align] ?? "flex-start";
      dom.style.visibility = "hidden";
      dom.style.pointerEvents = "none";
      el.onload = () => {
        dom.style.visibility = "";
        dom.style.pointerEvents = "";
      };
      return nodeView;
    };
  },
});
