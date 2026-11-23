<script setup lang="ts">
import { onMounted } from 'vue'
import { useNewsletterStore } from '@/stores/newsletter'
import Icon from '@/components/shared/Icon.vue'

const emit = defineEmits<{
  edit: [id: number]
  create: []
}>()

const store = useNewsletterStore()

onMounted(() => {
  store.fetchList()
})

function statusLabel(status: string) {
  switch (status) {
    case 'draft': return 'Brouillon'
    case 'published': return 'Publié'
    case 'sent': return 'Envoyé'
    default: return status
  }
}

const isPublic = (status: string) => status !== 'draft'
const publicUrl = (slug: string) => `/actualites/newsletter.php?slug=${encodeURIComponent(slug)}`

async function onDelete(id: number, title: string) {
  if (!confirm(`Supprimer la newsletter "${title}" ?`)) return
  await store.deleteNewsletter(id)
  await store.fetchList()
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold">Newsletters</h2>
      <button class="btn btn-primary" @click="emit('create')">Nouvelle newsletter</button>
    </div>

    <div v-if="store.loading" class="text-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="store.error" class="alert alert-error">{{ store.error }}</div>

    <div v-else-if="store.list.length === 0" class="text-center py-8 text-base-content/60">
      Aucune newsletter pour le moment.
    </div>

    <template v-else>
    <!-- Mobile: cards -->
    <div class="flex flex-col gap-3 md:hidden">
      <div
        v-for="nl in store.list"
        :key="nl.id"
        class="card card-border bg-base-100"
      >
        <div class="card-body p-4 gap-2">
          <div class="flex justify-between items-start gap-2">
            <p class="font-semibold leading-tight">{{ nl.title }}</p>
          </div>
          <p class="text-sm text-base-content/60">{{ nl.date_label }}</p>
          <div class="flex justify-end mt-1">
            <div class="vg-toolbar">
              <a
                class="btn btn-xs btn-outline gap-1"
                :class="{ 'btn-disabled': !isPublic(nl.status) }"
                :href="isPublic(nl.status) ? publicUrl(nl.slug) : undefined"
                :target="isPublic(nl.status) ? '_blank' : undefined"
                :aria-disabled="!isPublic(nl.status)"
                :data-tip="isPublic(nl.status) ? 'Voir la newsletter' : 'Brouillon : non visible'"
              >
                <Icon name="eye" class="size-4" />{{ statusLabel(nl.status) }}
              </a>
              <button type="button" class="btn btn-xs btn-square btn-outline" data-tip="Modifier la newsletter" aria-label="Modifier la newsletter" @click="emit('edit', nl.id!)">
                <Icon name="pencil" class="size-4" />
              </button>
              <button type="button" class="btn btn-xs btn-square btn-outline btn-error" data-tip="Supprimer la newsletter" aria-label="Supprimer la newsletter" @click="onDelete(nl.id!, nl.title)">
                <Icon name="trash" class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop: table -->
    <div class="overflow-x-auto hidden md:block">
      <table class="table table-zebra">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Date</th>
            <th>Créée le</th>
            <th class="w-px whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="nl in store.list" :key="nl.id">
            <td class="font-medium">{{ nl.title }}</td>
            <td>{{ nl.date_label }}</td>
            <td>{{ nl.date_creation ? new Date(nl.date_creation).toLocaleDateString('fr-FR') : '' }}</td>
            <td class="w-px whitespace-nowrap">
              <div class="vg-toolbar">
                <a
                  class="btn btn-xs btn-outline gap-1"
                  :class="{ 'btn-disabled': !isPublic(nl.status) }"
                  :href="isPublic(nl.status) ? publicUrl(nl.slug) : undefined"
                  :target="isPublic(nl.status) ? '_blank' : undefined"
                  :aria-disabled="!isPublic(nl.status)"
                  :data-tip="isPublic(nl.status) ? 'Voir la newsletter' : 'Brouillon : non visible'"
                >
                  <Icon name="eye" class="size-4" />{{ statusLabel(nl.status) }}
                </a>
                <button type="button" class="btn btn-xs btn-square btn-outline" data-tip="Modifier la newsletter" aria-label="Modifier la newsletter" @click="emit('edit', nl.id!)">
                  <Icon name="pencil" class="size-4" />
                </button>
                <button type="button" class="btn btn-xs btn-square btn-outline btn-error" data-tip="Supprimer la newsletter" aria-label="Supprimer la newsletter" @click="onDelete(nl.id!, nl.title)">
                  <Icon name="trash" class="size-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </template>
  </div>
</template>
