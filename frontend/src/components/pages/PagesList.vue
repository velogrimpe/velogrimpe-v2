<script setup lang="ts">
import { onMounted } from 'vue'
import { usePagesStore } from '@/stores/pages'
import Icon from '@/components/shared/Icon.vue'

const emit = defineEmits<{
  edit: [id: number]
  create: []
}>()

const store = usePagesStore()

onMounted(() => {
  store.fetchList()
})

function statusBadge(status: string) {
  switch (status) {
    case 'draft': return 'badge-warning'
    case 'published': return 'badge-info'
    default: return 'badge-ghost'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'draft': return 'Brouillon'
    case 'published': return 'Publié'
    default: return status
  }
}

async function onDelete(id: number, title: string) {
  if (!confirm(`Supprimer la page "${title}" ?`)) return
  await store.deletePage(id)
  await store.fetchList()
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold">Pages</h2>
      <button class="btn btn-primary" @click="emit('create')">Nouvelle page</button>
    </div>

    <div v-if="store.loading" class="text-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="store.error" class="alert alert-error">{{ store.error }}</div>

    <div v-else-if="store.list.length === 0" class="text-center py-8 text-base-content/60">
      Aucune page pour le moment.
    </div>

    <template v-else>
      <!-- Mobile: cards -->
      <div class="flex flex-col gap-3 md:hidden">
        <div
          v-for="p in store.list"
          :key="p.id"
          class="card card-border bg-base-100"
        >
          <div class="card-body p-4 gap-2">
            <div class="flex justify-between items-start gap-2">
              <p class="font-semibold leading-tight">{{ p.title }}</p>
              <span class="badge badge-sm shrink-0" :class="statusBadge(p.status)">{{ statusLabel(p.status) }}</span>
            </div>
            <p class="text-sm text-base-content/60">/p/{{ p.slug }}</p>
            <div class="flex gap-2 justify-end mt-1">
              <a v-if="p.status === 'published'" :href="`/p/${p.slug}`" target="_blank" class="btn btn-sm btn-ghost btn-square">
                <Icon name="eye" class="size-4" />
              </a>
              <button class="btn btn-sm btn-outline" @click="emit('edit', p.id!)">
                <Icon name="pencil" class="size-4" />Éditer
              </button>
              <button class="btn btn-sm btn-error btn-outline btn-square" @click="onDelete(p.id!, p.title)">
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
              <th>Slug</th>
              <th>Statut</th>
              <th>Modifiée le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in store.list" :key="p.id">
              <td class="font-medium">{{ p.title }}</td>
              <td class="font-mono text-sm">/p/{{ p.slug }}</td>
              <td>
                <span class="badge" :class="statusBadge(p.status)">{{ statusLabel(p.status) }}</span>
              </td>
              <td>{{ p.date_modification ? new Date(p.date_modification).toLocaleDateString('fr-FR') : '' }}</td>
              <td class="flex gap-2">
                <a v-if="p.status === 'published'" :href="`/p/${p.slug}`" target="_blank" class="btn btn-sm btn-ghost btn-square" title="Voir">
                  <Icon name="eye" class="size-4" />
                </a>
                <button class="btn btn-sm btn-outline" @click="emit('edit', p.id!)">
                  <Icon name="pencil" class="size-4" />Éditer
                </button>
                <button class="btn btn-sm btn-error btn-outline btn-square" @click="onDelete(p.id!, p.title)">
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
