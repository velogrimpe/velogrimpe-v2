<script setup lang="ts">
import { computed } from 'vue'
import Autocomplete from './Autocomplete.vue'
import type { AutocompleteOption } from '@/types/autocomplete'

export interface FormAutocompleteItem {
  id: number | string
  nom: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    items: FormAutocompleteItem[]
    placeholder?: string
    acceptNewValue?: boolean
    disabled?: boolean
    inputClass?: string
    name?: string
    required?: boolean
    inputAttrs?: Record<string, unknown>
  }>(),
  {
    placeholder: '',
    acceptNewValue: false,
    disabled: false,
    inputClass: '',
    name: undefined,
    required: false,
    inputAttrs: () => ({}),
  }
)

const emit = defineEmits<{
  select: [item: FormAutocompleteItem | null, value: string]
}>()

const modelValue = defineModel<string>({ default: '' })

const options = computed<AutocompleteOption[]>(() => {
  return props.items.map((item) => ({
    value: item.nom,
    label: item.nom,
    data: item,
  }))
})

function onSelect(option: AutocompleteOption) {
  const item = option.data as FormAutocompleteItem | undefined
  emit('select', item ?? null, option.value)
}
</script>

<template>
  <Autocomplete
    v-model="modelValue"
    :options="options"
    :placeholder="placeholder"
    :accept-new-value="acceptNewValue"
    :disabled="disabled"
    :name="name"
    :required="required"
    :input-attrs="inputAttrs"
    @select="onSelect"
  >
    <template #icon>
      <slot name="icon" />
    </template>
  </Autocomplete>
</template>
