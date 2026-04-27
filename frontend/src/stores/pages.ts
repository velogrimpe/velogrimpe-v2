import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CmsPage } from '@/types/page'

export const usePagesStore = defineStore('pages', () => {
  const list = ref<CmsPage[]>([])
  const current = ref<CmsPage | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function getToken(): string {
    return (window as any).__PAGES_DATA__?.token ?? ''
  }

  function headers(): Record<string, string> {
    return {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json',
    }
  }

  async function fetchList() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/private/pages/list.php', { headers: headers() })
      if (!res.ok) throw new Error(await res.text())
      list.value = await res.json()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: number) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/private/pages/get.php?id=${id}`, { headers: headers() })
      if (!res.ok) throw new Error(await res.text())
      current.value = await res.json()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function save(page: CmsPage): Promise<number | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/private/pages/save.php', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(page),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      return data.id
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function deletePage(id: number) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/private/pages/delete.php', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error(await res.text())
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function uploadImage(file: File, slug: string): Promise<string | null> {
    if (!slug) {
      error.value = 'Renseignez le slug avant de coller une image'
      return null
    }
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('slug', slug)
      const res = await fetch('/api/private/pages/upload-image.php', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text)
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Réponse serveur invalide (GD non disponible ?) : ' + text.substring(0, 200))
      }
      return data.url
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  function getPreviewUrl(slug: string): string {
    return `/p/${slug}?admin=${getToken()}`
  }

  return {
    list,
    current,
    loading,
    error,
    fetchList,
    fetchOne,
    save,
    deletePage,
    uploadImage,
    getPreviewUrl,
  }
})
