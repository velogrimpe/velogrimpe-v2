import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Newsletter } from '@/types/newsletter'

export const useNewsletterStore = defineStore('newsletter', () => {
  const list = ref<Newsletter[]>([])
  const current = ref<Newsletter | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const zones = ref<string[]>([])

  function getToken(): string {
    return (window as any).__NEWSLETTER_DATA__?.token ?? ''
  }

  function headers(): Record<string, string> {
    return {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json',
    }
  }

  async function fetchZones() {
    try {
      const res = await fetch('/api/private/newsletter/zones.php', { headers: headers() })
      if (res.ok) zones.value = await res.json()
    } catch { /* ignore */ }
  }

  async function fetchList() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/private/newsletter/list.php', { headers: headers() })
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
      const res = await fetch(`/api/private/newsletter/get.php?id=${id}`, { headers: headers() })
      if (!res.ok) throw new Error(await res.text())
      current.value = await res.json()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function save(newsletter: Newsletter): Promise<number | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/private/newsletter/save.php', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(newsletter),
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

  async function deleteNewsletter(id: number) {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/private/newsletter/delete.php', {
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
      const res = await fetch('/api/private/newsletter/upload-image.php', {
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

  function getPreviewUrl(id: number, format: 'web' | 'email'): string {
    return `/api/private/newsletter/render.php?id=${id}&format=${format}&token=${getToken()}`
  }

  async function sendNewsletter(id: number): Promise<{ success: number; error: number; sent_to: number } | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/private/newsletter/send.php', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error(await res.text())
      return await res.json()
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function getSendStatus(slug: string) {
    try {
      const res = await fetch(`/api/private/newsletter/send-status.php?slug=${encodeURIComponent(slug)}`, { headers: headers() })
      if (!res.ok) throw new Error(await res.text())
      return await res.json()
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  return {
    list,
    current,
    loading,
    error,
    zones,
    fetchZones,
    fetchList,
    fetchOne,
    save,
    deleteNewsletter,
    uploadImage,
    getPreviewUrl,
    sendNewsletter,
    getSendStatus,
  }
})
