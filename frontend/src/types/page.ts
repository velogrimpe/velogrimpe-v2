export interface PageSection {
  type: 'text'
  html: string
}

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
