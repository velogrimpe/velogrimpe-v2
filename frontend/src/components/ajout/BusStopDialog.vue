<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import AjoutBus from '@/components/ajout/AjoutBus.vue'
import RichTextField from '@/components/shared/RichTextField.vue'
import type { FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'
import { postBusStop } from '@/utils/bus-api'

interface ArretItem extends FormAutocompleteItem {
  id: number
  nom: string
}
interface LigneItem extends FormAutocompleteItem {
  id: number
  nom: string
  description?: string
  lien?: string
}

const props = withDefaults(
  defineProps<{
    arrets?: ArretItem[]
    lignes?: LigneItem[]
  }>(),
  { arrets: () => [], lignes: () => [] },
)

interface OpenDetail {
  nom?: string
  loc?: string
  osm_id?: string | null
  osm_data?: string | null
  description?: string
  falaise_id?: number | null
  falaise_nom?: string
  contrib_nom?: string
  contrib_email?: string
  types?: string[]
}

const ARRET_TYPES: { value: string; label: string }[] = [
  { value: 'ter', label: 'TER' },
  { value: 'tgv', label: 'TGV' },
  { value: 'bus', label: 'Bus' },
  { value: 'tram', label: 'Tram' },
  { value: 'telepherique', label: 'Téléphérique' },
]

const dlg = ref<HTMLDialogElement | null>(null)
const ajoutRef = ref<{
  getLignes: () => unknown[]
  getLiaisons: () => unknown[]
} | null>(null)

// Clé d'instance : incrémentée à chaque ouverture pour réinitialiser
// AjoutBus (liaisons/lignes) et le champ RichText.
const instanceKey = ref(0)
const submitting = ref(false)

// État du formulaire
const nom = ref('')
const description = ref('')
const loc = ref('')
const osmId = ref<string | null>(null)
const osmData = ref<string | null>(null)
const falaiseId = ref<number | null>(null)
const falaiseNom = ref('')
const types = ref<string[]>([])
const contribNom = ref('')
const contribEmail = ref('')
const message = ref('')
const commune = ref<string | null>(null)
const codeInsee = ref<string | null>(null)
const cp = ref<string | null>(null)

async function updateCommune(locValue: string) {
  const [lat, lng] = locValue.split(',').map(Number)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return
  try {
    const res = await fetch(`/api/reverse_geocode.php?lat=${lat}&lng=${lng}`)
    const data = res.ok ? await res.json() : null
    commune.value = data?.commune ?? null
    codeInsee.value = data?.code_insee ?? null
    cp.value = data?.cp ?? null
  } catch {
    // silencieux, cf. lib/geoplateforme_lib.php
  }
}

function getContribStorage() {
  return (window as unknown as Record<string, { getContribInfo?: () => { nom: string; email: string }; saveContribInfo?: (n: string, e: string) => void }>).contribStorage
}

function onOpen(e: Event) {
  const detail = (e as CustomEvent<OpenDetail>).detail || {}

  nom.value = detail.nom || ''
  description.value = detail.description || ''
  loc.value = detail.loc || ''
  osmId.value = detail.osm_id || null
  osmData.value = detail.osm_data || null
  falaiseId.value = detail.falaise_id ?? null
  falaiseNom.value = detail.falaise_nom || ''
  types.value = detail.types || []

  // Contributeur : détail de l'éditeur, sinon localStorage
  const stored = getContribStorage()?.getContribInfo?.() || { nom: '', email: '' }
  contribNom.value = detail.contrib_nom || stored.nom || ''
  contribEmail.value = detail.contrib_email || stored.email || ''
  message.value = ''
  commune.value = null
  codeInsee.value = null
  cp.value = null
  if (loc.value) updateCommune(loc.value)

  // Remonte les sous-composants avec les nouvelles valeurs initiales.
  instanceKey.value++
  nextTick(() => dlg.value?.showModal())
}

function close() {
  dlg.value?.close()
}

async function submit() {
  if (!nom.value.trim()) {
    alert("Le nom de l'arrêt est obligatoire.")
    return
  }
  if (!loc.value) {
    alert("La position de l'arrêt est manquante.")
    return
  }
  if (!types.value.length) {
    alert('Merci de sélectionner au moins une modalité desservie (ter/tgv/bus/tram/téléphérique).')
    return
  }
  if (!contribNom.value.trim() || !contribEmail.value.trim()) {
    alert('Merci de renseigner votre nom et votre email.')
    return
  }

  submitting.value = true
  const result = await postBusStop({
    admin: '0',
    arret_id: null,
    nom: nom.value.trim(),
    loc: loc.value,
    types: types.value,
    commune: commune.value,
    code_insee: codeInsee.value,
    cp: cp.value,
    description: description.value,
    osm_id: osmId.value,
    osm_data: osmData.value,
    falaise_ids: falaiseId.value ? [falaiseId.value] : [],
    lignes: ajoutRef.value?.getLignes() ?? [],
    liaisons: ajoutRef.value?.getLiaisons() ?? [],
    nom_prenom: contribNom.value.trim(),
    email: contribEmail.value.trim(),
    message: message.value.trim(),
  })
  submitting.value = false

  if (!result.success) {
    alert('Erreur : ' + (result.error || result.status))
    return
  }

  getContribStorage()?.saveContribInfo?.(contribNom.value.trim(), contribEmail.value.trim())

  window.dispatchEvent(
    new CustomEvent('velogrimpe:bus-dialog:created', {
      detail: { arret_id: result.arret_id, falaise_id: falaiseId.value },
    }),
  )
  close()
}

onMounted(() => window.addEventListener('velogrimpe:bus-dialog:open', onOpen))
onBeforeUnmount(() => window.removeEventListener('velogrimpe:bus-dialog:open', onOpen))
</script>

<template>
  <dialog ref="dlg" class="modal">
    <div class="modal-box w-11/12 max-w-2xl">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" type="button" @click="close">✕</button>
      </form>

      <h3 class="font-bold text-xl">Ajouter un arrêt de bus</h3>
      <p v-if="falaiseNom" class="text-sm text-primary mt-1">
        Cet arrêt sera lié à la falaise : <b>{{ falaiseNom }}</b>
      </p>

      <div class="flex flex-col gap-4 mt-4">
        <!-- ===== Arrêt ===== -->
        <label class="form-control">
          <span class="text-sm font-bold">Nom de l'arrêt</span>
          <input
            type="text"
            class="input input-primary input-sm"
            v-model="nom"
            placeholder="ex: Buoux - Mairie"
          />
        </label>

        <div class="form-control">
          <span class="text-sm font-bold">Modalités desservies <span class="text-error">(au moins une)</span></span>
          <div class="flex flex-wrap gap-4 mt-1">
            <label v-for="t in ARRET_TYPES" :key="t.value" class="label cursor-pointer gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                :value="t.value"
                v-model="types"
              />
              <span class="label-text">{{ t.label }}</span>
            </label>
          </div>
        </div>

        <div class="form-control">
          <span class="text-sm font-bold">Commentaire sur l'arrêt <i class="opacity-50 font-normal">(optionnel)</i></span>
          <RichTextField :key="'desc-' + instanceKey" name="bus_dialog_description" v-model="description" />
        </div>

        <!-- ===== Liaisons / Lignes (réutilise AjoutBus) ===== -->
        <AjoutBus
          :key="instanceKey"
          ref="ajoutRef"
          :arrets="props.arrets"
          :lignes="props.lignes"
          :exclude-arret-id="null"
        />

        <!-- ===== Contributeur ===== -->
        <div class="relative flex items-center mt-2">
          <hr class="my-0 grow border-[#2e8b57]" />
          <span class="px-2 text-primary italic">Contributeur</span>
          <hr class="my-0 grow border-[#2e8b57]" />
        </div>
        <div class="flex flex-col md:flex-row gap-3">
          <label class="form-control grow">
            <span class="text-sm font-bold">Votre nom</span>
            <input type="text" class="input input-primary input-sm" v-model="contribNom" required />
          </label>
          <label class="form-control grow">
            <span class="text-sm font-bold">Votre email</span>
            <input type="email" class="input input-primary input-sm" v-model="contribEmail" required />
          </label>
        </div>
        <label class="form-control">
          <span class="text-sm font-bold">Message <i class="opacity-50 font-normal">(optionnel)</i></span>
          <textarea class="textarea textarea-primary textarea-sm" v-model="message" rows="2"></textarea>
        </label>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" type="button" @click="close">Annuler</button>
        <button class="btn btn-primary" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? 'Enregistrement…' : "Ajouter l'arrêt de bus" }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="close">close</button>
    </form>
  </dialog>
</template>
