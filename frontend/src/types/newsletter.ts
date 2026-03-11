export interface NewsletterSection {
  type: 'text' | 'nouvelles_falaises'
  html?: string
  intro_html?: string
  regions?: NouvellesFalaisesRegion[]
}

export interface NouvellesFalaisesRegion {
  name: string
  image: string
  falaises: { id: number; name: string; contributor: string }[]
}

export interface Newsletter {
  id?: number
  slug: string
  title: string
  description: string
  date_label: string
  status: 'draft' | 'published' | 'sent'
  sections: NewsletterSection[]
  date_creation?: string
  date_sent?: string
}

export interface FalaiseSearchResult {
  id: number
  name: string
  department: string
  contributor: string
}
