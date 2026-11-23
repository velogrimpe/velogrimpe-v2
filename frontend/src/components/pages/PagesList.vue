<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

type Page = (typeof store.list)[number]
type Row =
  | { kind: 'folder'; path: string; name: string; depth: number; count: number }
  | { kind: 'page'; page: Page; depth: number }
interface Node {
  folders: Map<string, Node>
  pages: Page[]
}

// Arborescence déduite des slugs (« dossier/sous-dossier/page »).
const collapsed = ref(new Set<string>())

function toggle(path: string) {
  const next = new Set(collapsed.value)
  if (!next.delete(path)) next.add(path)
  collapsed.value = next
}

function countPages(n: Node): number {
  let c = n.pages.length
  for (const f of n.folders.values()) c += countPages(f)
  return c
}

const rows = computed<Row[]>(() => {
  const root: Node = { folders: new Map(), pages: [] }
  for (const p of store.list) {
    const parts = p.slug.split('/')
    let node = root
    for (const seg of parts.slice(0, -1)) {
      if (!node.folders.has(seg)) node.folders.set(seg, { folders: new Map(), pages: [] })
      node = node.folders.get(seg)!
    }
    node.pages.push(p)
  }
  const out: Row[] = []
  const walk = (node: Node, prefix: string, depth: number) => {
    const names = [...node.folders.keys()].sort((a, b) => a.localeCompare(b))
    for (const name of names) {
      const path = prefix + name
      const child = node.folders.get(name)!
      out.push({ kind: 'folder', path, name, depth, count: countPages(child) })
      if (!collapsed.value.has(path)) walk(child, path + '/', depth + 1)
    }
    for (const page of node.pages) out.push({ kind: 'page', page, depth })
  }
  walk(root, '', 0)
  return out
})

function indent(depth: number) {
  return { paddingLeft: `${depth * 1.5}rem` }
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
        <template v-for="r in rows" :key="r.kind === 'folder' ? 'f:' + r.path : r.page.id">
        <button
          v-if="r.kind === 'folder'"
          class="flex items-center gap-2 font-semibold text-left"
          :style="indent(r.depth)"
          @click="toggle(r.path)"
        >
          <span class="w-4">{{ collapsed.has(r.path) ? '▶' : '▼' }}</span>
          📁 {{ r.name }}
          <span class="badge badge-sm badge-ghost">{{ r.count }}</span>
        </button>
        <div
          v-else
          class="card card-border bg-base-100"
          :style="indent(r.depth)"
        >
          <div class="card-body p-4 gap-2">
            <div class="flex justify-between items-start gap-2">
              <p class="font-semibold leading-tight">{{ r.page.title }}</p>
            </div>
            <p class="text-sm text-base-content/60">/p/{{ r.page.slug }}</p>
            <div class="flex justify-end mt-1">
              <div class="vg-toolbar">
                <a
                  class="btn btn-xs btn-outline gap-1"
                  :class="{ 'btn-disabled': r.page.status !== 'published' }"
                  :href="r.page.status === 'published' ? `/p/${r.page.slug}` : undefined"
                  :target="r.page.status === 'published' ? '_blank' : undefined"
                  :aria-disabled="r.page.status !== 'published'"
                  :data-tip="r.page.status === 'published' ? 'Voir la page' : 'Brouillon : page non visible'"
                >
                  <Icon name="eye" class="size-4" />{{ statusLabel(r.page.status) }}
                </a>
                <button type="button" class="btn btn-xs btn-square btn-outline" data-tip="Modifier la page" aria-label="Modifier la page" @click="emit('edit', r.page.id!)">
                  <Icon name="pencil" class="size-4" />
                </button>
                <button type="button" class="btn btn-xs btn-square btn-outline btn-error" data-tip="Supprimer la page" aria-label="Supprimer la page" @click="onDelete(r.page.id!, r.page.title)">
                  <Icon name="trash" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        </template>
      </div>

      <!-- Desktop: table -->
      <div class="overflow-x-auto hidden md:block">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Modifiée le</th>
              <th class="w-px whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in rows" :key="r.kind === 'folder' ? 'f:' + r.path : r.page.id">
            <tr v-if="r.kind === 'folder'" class="bg-base-200/60 cursor-pointer hover:bg-base-200" @click="toggle(r.path)">
              <td colspan="3" class="font-semibold" :style="indent(r.depth)">
                <span class="inline-block w-4">{{ collapsed.has(r.path) ? '▶' : '▼' }}</span>
                📁 {{ r.name }}
                <span class="badge badge-sm badge-ghost ml-1">{{ r.count }}</span>
              </td>
            </tr>
            <tr v-else>
              <td class="font-medium" :style="indent(r.depth)">{{ r.page.title }}</td>
              <td>{{ r.page.date_modification ? new Date(r.page.date_modification).toLocaleDateString('fr-FR') : '' }}</td>
              <td class="w-px whitespace-nowrap">
                <div class="vg-toolbar">
                  <a
                    class="btn btn-xs btn-outline gap-1"
                    :class="{ 'btn-disabled': r.page.status !== 'published' }"
                    :href="r.page.status === 'published' ? `/p/${r.page.slug}` : undefined"
                    :target="r.page.status === 'published' ? '_blank' : undefined"
                    :aria-disabled="r.page.status !== 'published'"
                    :data-tip="r.page.status === 'published' ? 'Voir la page' : 'Brouillon : page non visible'"
                  >
                    <Icon name="eye" class="size-4" />{{ statusLabel(r.page.status) }}
                  </a>
                  <button type="button" class="btn btn-xs btn-square btn-outline" data-tip="Modifier la page" aria-label="Modifier la page" @click="emit('edit', r.page.id!)">
                    <Icon name="pencil" class="size-4" />
                  </button>
                  <button type="button" class="btn btn-xs btn-square btn-outline btn-error" data-tip="Supprimer la page" aria-label="Supprimer la page" @click="onDelete(r.page.id!, r.page.title)">
                    <Icon name="trash" class="size-4" />
                  </button>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
