export type PageSection =
  | { type: 'text'; html: string }
  | { type: 'iframe'; title?: string; intro_html?: string; embed_code: string }

export interface CmsPage {
  id?: number
  slug: string
  title: string
  description: string
  status: 'draft' | 'published'
  sections: PageSection[]
  date_creation?: string
  date_modification?: string
}
