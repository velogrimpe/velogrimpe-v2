<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface MultiSelectOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  options: MultiSelectOption[]
  name?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
}>(), {
  placeholder: '',
  disabled: false,
  required: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'change': [value: string[]]
}>()

const searchQuery = ref('')
const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const selectedValues = computed(() => new Set(props.modelValue))

const selectedOptions = computed(() =>
  props.options.filter(opt => selectedValues.value.has(opt.value))
)

const availableOptions = computed(() => {
  const unselected = props.options.filter(opt => !selectedValues.value.has(opt.value))
  if (!searchQuery.value) return unselected
  const query = searchQuery.value.toUpperCase()
  return unselected.filter(opt => opt.label.toUpperCase().includes(query))
})

// Computed value for hidden input (comma-separated)
const formValue = computed(() => props.modelValue.join(','))

function selectOption(option: MultiSelectOption) {
  const newValue = [...props.modelValue, option.value]
  emit('update:modelValue', newValue)
  emit('change', newValue)
  searchQuery.value = ''
  searchInputRef.value?.focus()
}

function deselectOption(option: MultiSelectOption) {
  if (props.disabled) return
  const newValue = props.modelValue.filter(v => v !== option.value)
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

function clearAll(event: Event) {
  event.stopPropagation()
  emit('update:modelValue', [])
  emit('change', [])
  searchQuery.value = ''
  searchInputRef.value?.focus()
}

function handleContainerClick() {
  if (props.disabled) return
  isOpen.value = true
  searchInputRef.value?.focus()
}

function handleSearchKeyup(event: KeyboardEvent) {
  if ((event.key === 'Enter' || event.key === 'NumpadEnter') && searchQuery.value && availableOptions.value.length > 0) {
    selectOption(availableOptions.value[0])
  }
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}


onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="containerRef"
    class="multi-select-container relative"
  >
    <!-- Hidden input for form submission -->
    <input
      type="hidden"
      :name="name"
      :value="formValue"
      :required="required && modelValue.length === 0"
    />

    <!-- Main input area -->
    <div
      class="input input-primary input-sm flex items-center gap-1 h-auto min-h-8 cursor-text py-1"
      :class="{ 'input-disabled': disabled }"
      @click="handleContainerClick"
    >
      <!-- Selected items -->
      <span
        v-for="option in selectedOptions"
        :key="option.value"
        class="badge badge-info text-white badge-sm cursor-pointer select-none shrink-0"
        :class="{ 'cursor-not-allowed': disabled }"
        @click.stop="deselectOption(option)"
      >
        {{ option.label }}
      </span>

      <!-- Search input -->
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        class="flex-grow min-w-[30px] border-0 outline-none bg-transparent text-sm h-5"
        :placeholder="selectedOptions.length === 0 ? placeholder : ''"
        :disabled="disabled"
        @keyup="handleSearchKeyup"
        @focus="isOpen = true"
      />

      <!-- Clear button -->
      <button
        v-if="selectedOptions.length > 0"
        type="button"
        class="btn btn-xs btn-ghost p-0 h-5 min-h-0 shrink-0"
        title="Clear Selection"
        :disabled="disabled"
        @click="clearAll"
      >
        <svg class="w-4 h-4 fill-current">
          <use :href="'/symbols/icons.svg#ri-close-line'"></use>
        </svg>
      </button>
    </div>

    <!-- Dropdown -->
    <div
      v-show="isOpen && availableOptions.length > 0"
      class="absolute top-full left-0 w-full z-50 bg-white border border-base-300 rounded-lg shadow-lg mt-1 flex flex-wrap p-1"
    >
      <div
        v-for="option in availableOptions"
        :key="option.value"
        class="badge badge-info text-white m-1 px-2 py-1 cursor-pointer select-none hover:badge-primary"
        @click="selectOption(option)"
      >
        {{ option.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.multi-select-container input[type="text"]:focus {
  box-shadow: none;
}
</style>
