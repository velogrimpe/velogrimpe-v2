/**
 * Téléversements depuis l'éditeur riche (articles et newsletters).
 *
 * Deux sorties distinctes : une image est réencodée côté serveur et seule son
 * URL compte, un fichier joint garde son nom d'origine, qui sert de libellé au
 * lien inséré dans le texte.
 */

/** Fichier joint téléversé : URL publique + nom d'origine. */
export interface UploadedFile {
  url: string
  name: string
}

/** Téléverse une image et renvoie son URL, ou null en cas d'échec. */
export type ImageUploader = (file: File) => Promise<string | null>

/** Téléverse un fichier joint, ou null en cas d'échec. */
export type FileUploader = (file: File) => Promise<UploadedFile | null>
