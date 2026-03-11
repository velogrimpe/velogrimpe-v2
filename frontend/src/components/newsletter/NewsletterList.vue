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

function statusBadge(status: string) {
  switch (status) {
    case 'draft': return 'badge-warning'
    case 'published': return 'badge-info'
    case 'sent': return 'badge-success'
    default: return 'badge-ghost'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'draft': return 'Brouillon'
    case 'published': return 'Publié'
    case 'sent': return 'Envoyé'
    default: return status
  }
}

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
            <span class="badge badge-sm shrink-0" :class="statusBadge(nl.status)">{{ statusLabel(nl.status) }}</span>
          </div>
          <p class="text-sm text-base-content/60">{{ nl.date_label }}</p>
          <div class="flex gap-2 justify-end mt-1">
            <button class="btn btn-sm btn-outline" @click="emit('edit', nl.id!)">
              <Icon name="pencil" class="size-4" />Éditer
            </button>
            <button class="btn btn-sm btn-error btn-outline btn-square" @click="onDelete(nl.id!, nl.title)">
              <Icon name="trash" class="size-4" />
            </button>
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
            <th>Statut</th>
            <th>Créée le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="nl in store.list" :key="nl.id">
            <td class="font-medium">{{ nl.title }}</td>
            <td>{{ nl.date_label }}</td>
            <td>
              <span class="badge" :class="statusBadge(nl.status)">{{ statusLabel(nl.status) }}</span>
            </td>
            <td>{{ nl.date_creation ? new Date(nl.date_creation).toLocaleDateString('fr-FR') : '' }}</td>
            <td class="flex gap-2">
              <button class="btn btn-sm btn-outline" @click="emit('edit', nl.id!)">
                <Icon name="pencil" class="size-4" />Éditer
              </button>
              <button class="btn btn-sm btn-error btn-outline btn-square" @click="onDelete(nl.id!, nl.title)">
                <Icon name="trash" class="size-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </template>
  </div>
</template>
