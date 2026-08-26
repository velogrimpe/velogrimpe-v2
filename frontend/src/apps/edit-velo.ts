/**
 * App Vue de la page d'édition d'un itinéraire vélo (ajout/edit_velo.php).
 *
 * Cascade Falaise (autocomplete) → Gare de départ (select) → Variante (select) :
 *  - un sélecteur ne se dégrise qu'une fois le précédent renseigné ;
 *  - ses options sont déduites des itinéraires réellement en base
 *    (GET /api/fetch_velos.php?falaise_id=…) ;
 *  - une seule option ⇒ sélection automatique ;
 *  - les presets URL (falaise_id, gare_id, velo_id) sont vérifiés contre ces
 *    données : un preset incohérent est ignoré au niveau où il devient faux.
 *
 * Une fois la variante choisie, l'app remplit les champs du formulaire
 * (#velo_id, #velo_km, #velo_dplus, #velo_dmoins, #velo_descr, #velo_openrunner,
 * #gpx_download), révèle #velo-edit-fields, adapte le formulaire au statut de
 * l'itinéraire (validé + non admin ⇒ indicateurs désactivés, mode « suggestion »)
 * et notifie la carte (velo-form-map.js).
 */
import { createApp, computed, h, ref } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'
import {
  type GareItem,
  type FalaiseItem,
  type VeloItem,
  searchIconSlot,
  emitMapEvent,
  gareMapDetail,
  falaiseMapDetail,
  fetchVelosForFalaise,
} from '@/utils/velo-form'

const byId = <T extends { id: number }>(items: T[], id: number | null) =>
  id == null ? null : (items.find((i) => i.id === id) ?? null)

const parseIntOrNull = (v: string | undefined) => {
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null
const setInputValue = (id: string, value: string) => {
  const el = input(id)
  if (el) el.value = value
}
const setDisabled = (id: string, disabled: boolean) => {
  const el = input(id)
  if (el) el.disabled = disabled
}
const show = (el: HTMLElement | null, visible: boolean) => {
  if (el) el.style.display = visible ? '' : 'none'
}

/** Libellé lisible et unique d'une variante dans la liste. */
const varianteLabel = (velo: VeloItem, siblings: VeloItem[]) => {
  const base = velo.velo_variante?.trim() || 'Itinéraire sans nom de variante'
  const dup = siblings.filter((v) => (v.velo_variante?.trim() || '') === (velo.velo_variante?.trim() || ''))
  const statut = velo.velo_public === 1 ? '' : ' — à valider'
  return (dup.length > 1 ? `${base} (#${velo.velo_id})` : base) + statut
}

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-edit-velo')
  if (!mountEl) {
    console.warn('[velogrimpe] #vue-edit-velo mount point not found')
    return
  }

  let falaises: FalaiseItem[] = []
  try {
    falaises = JSON.parse(mountEl.dataset.falaises || '[]')
  } catch (e) {
    console.error('[velogrimpe] Failed to parse edit-velo data:', e)
  }
  const isAdmin = mountEl.dataset.admin === '1'
  const presetFalaiseId = parseIntOrNull(mountEl.dataset.presetFalaiseId)
  const presetGareId = parseIntOrNull(mountEl.dataset.presetGareId)
  const presetVeloId = parseIntOrNull(mountEl.dataset.presetVeloId)

  const fieldsEl = document.getElementById('velo-edit-fields')
  const noVeloEl = document.getElementById('velo-edit-none')
  const validatedNoticeEl = document.getElementById('velo-edit-validated')
  const downloadEl = document.getElementById('gpx_download') as HTMLAnchorElement | null
  const noGpxEl = document.getElementById('gpx_missing')
  const ajoutLinkEl = document.getElementById('velo-edit-ajout-link') as HTMLAnchorElement | null
  const submitEl = document.getElementById('velo-edit-submit')
  const submitDefaultLabel = submitEl?.textContent ?? ''

  // Reflète la sélection dans l'URL (partage / rechargement), en conservant les
  // autres paramètres (admin…).
  const syncUrl = (falaiseId: number | null, gareId: number | null, veloId: number | null) => {
    const url = new URL(window.location.href)
    const set = (k: string, v: number | null) => (v == null ? url.searchParams.delete(k) : url.searchParams.set(k, String(v)))
    set('falaise_id', falaiseId)
    set('gare_id', gareId)
    set('velo_id', veloId)
    window.history.replaceState(null, '', url.toString())
  }

  const app = createApp({
    setup() {
      const falaise = ref<FalaiseItem | null>(null)
      const falaiseText = ref('')
      const velos = ref<VeloItem[]>([])
      const loading = ref(false)
      const loadError = ref('')
      const gare = ref<GareItem | null>(null)
      const velo = ref<VeloItem | null>(null)

      // Gares desservant la falaise (dédupliquées), dans l'ordre renvoyé par l'API.
      const gares = computed<GareItem[]>(() => {
        const seen = new Set<number>()
        const out: GareItem[] = []
        for (const v of velos.value) {
          if (!seen.has(v.gare.id)) {
            seen.add(v.gare.id)
            out.push(v.gare)
          }
        }
        return out
      })

      const variantes = computed<VeloItem[]>(() =>
        gare.value ? velos.value.filter((v) => v.gare_id === gare.value!.id) : [],
      )

      const gareDisabled = computed(() => !falaise.value || loading.value || gares.value.length === 0)
      const varianteDisabled = computed(() => !gare.value || variantes.value.length === 0)

      // --- Application de la sélection au formulaire / carte -------------------

      const applyVelo = (v: VeloItem | null) => {
        velo.value = v
        const suggestion = !!v && v.velo_public === 1 && !isAdmin
        setInputValue('velo_id', v ? String(v.velo_id) : '')
        setInputValue('velo_km', v?.velo_km != null ? String(v.velo_km) : '')
        setInputValue('velo_dplus', v?.velo_dplus != null ? String(v.velo_dplus) : '')
        setInputValue('velo_dmoins', v?.velo_dmoins != null ? String(v.velo_dmoins) : '')
        setInputValue('velo_descr', v?.velo_descr ?? '')
        setInputValue('velo_openrunner', v?.velo_openrunner ?? '')
        // Itinéraire validé + contributeur : les indicateurs ne sont pas
        // modifiables (protection identique côté api/edit_velo.php).
        for (const id of ['velo_km', 'velo_dplus', 'velo_dmoins']) setDisabled(id, suggestion)
        show(validatedNoticeEl, suggestion)
        if (submitEl) submitEl.textContent = suggestion ? 'Envoyer la suggestion aux administrateurs' : submitDefaultLabel
        if (downloadEl) {
          if (v?.gpx_url) {
            downloadEl.href = v.gpx_url
            show(downloadEl, true)
            show(noGpxEl, false)
          } else {
            downloadEl.removeAttribute('href')
            show(downloadEl, false)
            show(noGpxEl, !!v)
          }
        }
        show(fieldsEl, !!v)
        emitMapEvent('gpx-url', v?.gpx_url ? { url: v.gpx_url } : null)
        syncUrl(falaise.value?.id ?? null, gare.value?.id ?? null, v?.velo_id ?? null)
      }

      const applyGare = (g: GareItem | null, preferVeloId: number | null = null) => {
        gare.value = g
        emitMapEvent('gare', gareMapDetail(g))
        const options = variantes.value
        let next = preferVeloId == null ? null : (options.find((v) => v.velo_id === preferVeloId) ?? null)
        if (!next && options.length === 1) next = options[0]
        applyVelo(next)
      }

      const applyFalaise = async (f: FalaiseItem | null, preferGareId: number | null = null, preferVeloId: number | null = null) => {
        falaise.value = f
        falaiseText.value = f?.nom ?? ''
        emitMapEvent('falaise', falaiseMapDetail(f))
        velos.value = []
        loadError.value = ''
        applyGare(null)
        if (ajoutLinkEl) {
          const url = new URL(ajoutLinkEl.href, window.location.origin)
          f ? url.searchParams.set('falaise_id', String(f.id)) : url.searchParams.delete('falaise_id')
          ajoutLinkEl.href = url.toString()
        }
        show(noVeloEl, false)
        if (!f) return

        loading.value = true
        try {
          const fetched = await fetchVelosForFalaise(f.id)
          if (falaise.value?.id !== f.id) return // sélection changée pendant le chargement
          velos.value = fetched
        } catch (e) {
          console.error('[velogrimpe] fetch_velos failed:', e)
          loadError.value = 'Impossible de charger les itinéraires de cette falaise.'
          return
        } finally {
          loading.value = false
        }

        if (gares.value.length === 0) {
          show(noVeloEl, true)
          return
        }
        // Preset : la gare doit desservir la falaise, la variante appartenir au couple.
        let nextGare = byId(gares.value, preferGareId)
        if (!nextGare && preferVeloId != null) {
          const v = velos.value.find((x) => x.velo_id === preferVeloId)
          if (v) nextGare = v.gare
        }
        if (!nextGare && gares.value.length === 1) nextGare = gares.value[0]
        if (nextGare) applyGare(nextGare, preferVeloId)
      }

      // --- Presets URL ---------------------------------------------------------
      if (presetFalaiseId != null) {
        const f = byId(falaises, presetFalaiseId)
        if (f) setTimeout(() => void applyFalaise(f, presetGareId, presetVeloId), 0)
      }

      // --- Handlers ------------------------------------------------------------
      const onFalaiseSelect = (item: FormAutocompleteItem | null) => void applyFalaise((item as FalaiseItem | null) ?? null)
      const onGareChange = (e: Event) => applyGare(byId(gares.value, parseIntOrNull((e.target as HTMLSelectElement).value)))
      const onVarianteChange = (e: Event) => {
        const id = parseIntOrNull((e.target as HTMLSelectElement).value)
        applyVelo(variantes.value.find((v) => v.velo_id === id) ?? null)
      }

      const field = (label: string, node: ReturnType<typeof h>, hint?: string) =>
        h('div', { class: 'flex flex-col gap-1 grow basis-0 min-w-0' }, [
          h('div', { class: 'relative not-prose' }, [h('label', { class: 'form-control' }, [h('b', null, label), node])]),
          hint ? h('i', { class: 'text-sm text-slate-500' }, hint) : null,
        ])

      const select = (
        opts: { value: string; label: string }[],
        selected: string,
        disabled: boolean,
        placeholder: string,
        onChange: (e: Event) => void,
      ) =>
        h(
          'select',
          { class: 'select select-primary select-sm w-full', disabled, value: selected, onChange },
          [
            h('option', { value: '', selected: selected === '' }, placeholder),
            ...opts.map((o) => h('option', { value: o.value, selected: o.value === selected }, o.label)),
          ],
        )

      return () =>
        h('div', { class: 'flex flex-col gap-2' }, [
          h('div', { class: 'flex flex-col md:flex-row gap-4 md:items-start' }, [
            field(
              'Falaise :',
              h(
                FormAutocomplete,
                {
                  modelValue: falaiseText.value,
                  'onUpdate:modelValue': (v: string) => (falaiseText.value = v),
                  items: falaises,
                  placeholder: 'Rechercher une falaise…',
                  onSelect: onFalaiseSelect,
                },
                searchIconSlot(),
              ),
            ),
            field(
              'Gare de départ :',
              select(
                gares.value.map((g) => ({ value: String(g.id), label: g.nom })),
                gare.value ? String(gare.value.id) : '',
                gareDisabled.value,
                loading.value ? 'Chargement…' : falaise.value ? 'Choisir une gare…' : 'Choisir d’abord une falaise',
                onGareChange,
              ),
              falaise.value && !loading.value && gares.value.length > 1 ? `${gares.value.length} gares desservent cette falaise` : undefined,
            ),
            field(
              'Variante :',
              select(
                variantes.value.map((v) => ({ value: String(v.velo_id), label: varianteLabel(v, variantes.value) })),
                velo.value ? String(velo.value.velo_id) : '',
                varianteDisabled.value,
                gare.value ? 'Choisir une variante…' : 'Choisir d’abord une gare',
                onVarianteChange,
              ),
              gare.value && variantes.value.length > 1 ? `${variantes.value.length} variantes pour ce trajet` : undefined,
            ),
          ]),
          loadError.value ? h('div', { class: 'text-error text-sm' }, loadError.value) : null,
        ])
    },
  })

  app.mount(mountEl)
  console.log('[velogrimpe] Vue edit-velo mounted')
})
