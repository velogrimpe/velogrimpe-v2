<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { AutocompleteOption } from "@/types/autocomplete";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: AutocompleteOption[];
    placeholder?: string;
    acceptNewValue?: boolean;
    disabled?: boolean;
    name?: string;
    required?: boolean;
    inputAttrs?: Record<string, unknown>;
    preventAutofill?: boolean;
  }>(),
  {
    placeholder: "",
    acceptNewValue: false,
    disabled: false,
    name: undefined,
    required: false,
    inputAttrs: () => ({}),
    preventAutofill: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  select: [option: AutocompleteOption];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLUListElement | null>(null);
const isOpen = ref(false);
const currentFocus = ref(-1);
const inputValue = ref(props.modelValue);

// Tant que le champ n'a pas le focus, il reste readonly : les outils de
// remplissage automatique (autofill navigateur + gestionnaires de mots de
// passe) ignorent les champs readonly et ne peuvent donc plus injecter de
// valeur, notamment au moment du submit.
const isReadonly = ref(props.preventAutofill);

function onFocus() {
  if (props.preventAutofill) isReadonly.value = false;
  isOpen.value = true;
}

watch(
  () => props.modelValue,
  (newVal) => {
    inputValue.value = newVal;
  },
);

const filteredOptions = computed(() => {
  if (!inputValue.value) return [];
  return props.options.filter((option) =>
    matchOption(option.value, inputValue.value),
  );
});

const showList = computed(() => {
  return (
    isOpen.value &&
    (filteredOptions.value.length > 0 ||
      (props.acceptNewValue && inputValue.value))
  );
});

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[-']/g, " ")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchOption(optionValue: string, searchValue: string): boolean {
  const normalizedOption = normalizeString(optionValue);
  const normalizedSearch = normalizeString(searchValue);

  // Inclusion match
  if (normalizedOption.includes(normalizedSearch)) return true;

  // Typo tolerance (1 error allowed for strings > 4 chars)
  let errors = 0;
  const maxErrors = normalizedSearch.length > 4 ? 1 : 0;
  for (let i = 0; i < normalizedSearch.length; i++) {
    if (normalizedOption[i] !== normalizedSearch[i]) {
      errors++;
      if (errors > maxErrors) return false;
    }
  }

  return true;
}

function onInput(event: Event) {
  // En mode preventAutofill, le champ n'est éditable que lorsqu'il a le focus
  // (isReadonly === false). Un event `input` reçu alors qu'il est encore
  // readonly ne peut venir que d'un script externe (form-filler qui pose
  // `.value` + dispatch). On l'ignore pour ne pas polluer le modèle.
  if (props.preventAutofill && isReadonly.value) return;
  const target = event.target as HTMLInputElement;
  inputValue.value = target.value;
  emit("update:modelValue", target.value);
  isOpen.value = true;
  currentFocus.value = -1;
}

function selectOption(option: AutocompleteOption) {
  inputValue.value = option.value;
  emit("update:modelValue", option.value);
  emit("select", option);
  isOpen.value = false;
  currentFocus.value = -1;
}

function selectNewValue() {
  if (props.acceptNewValue && inputValue.value) {
    const newOption: AutocompleteOption = { value: inputValue.value };
    emit("select", newOption);
    isOpen.value = false;
    currentFocus.value = -1;
  }
}

function onKeydown(event: KeyboardEvent) {
  const items = filteredOptions.value;
  const hasNewValueOption =
    props.acceptNewValue &&
    inputValue.value &&
    !items.some((o) => o.value === inputValue.value);
  const totalItems = items.length + (hasNewValueOption ? 1 : 0);

  if (totalItems === 0) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (currentFocus.value < totalItems - 1) {
      currentFocus.value++;
    } else {
      currentFocus.value = 0;
    }
    ensureVisible();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (currentFocus.value > 0) {
      currentFocus.value--;
    } else {
      currentFocus.value = totalItems - 1;
    }
    ensureVisible();
  } else if (event.key === "Enter") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (currentFocus.value >= 0 && currentFocus.value < items.length) {
      selectOption(items[currentFocus.value]);
    } else if (hasNewValueOption && currentFocus.value === items.length) {
      selectNewValue();
    }
  } else if (event.key === "Escape") {
    event.preventDefault();
    inputValue.value = "";
    emit("update:modelValue", "");
    isOpen.value = false;
    currentFocus.value = -1;
  }
}

function ensureVisible() {
  if (currentFocus.value < 0 || !listRef.value) return;
  const items = listRef.value.querySelectorAll("li");
  if (items[currentFocus.value]) {
    items[currentFocus.value].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }
}

function onBlur() {
  // Re-verrouille le champ pour empêcher tout remplissage auto au submit.
  if (props.preventAutofill) isReadonly.value = true;
  // Delay to allow click events to fire
  setTimeout(() => {
    if (!props.acceptNewValue && inputValue.value) {
      const isValid = props.options.some((o) => o.value === inputValue.value);
      if (!isValid) {
        inputValue.value = "";
        emit("update:modelValue", "");
      }
    }
    isOpen.value = false;
  }, 200);
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  if (
    inputRef.value &&
    !inputRef.value.contains(target) &&
    listRef.value &&
    !listRef.value.contains(target)
  ) {
    isOpen.value = false;
  }
}

function focus() {
  inputRef.value?.focus();
}

defineExpose({ focus });

onMounted(() => {
  document.addEventListener("click", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", onClickOutside);
});

function getOptionLabel(option: AutocompleteOption): string {
  return option.label || option.value;
}
</script>

<template>
  <div class="relative w-full">
    <!-- Hidden input for form submission -->
    <input
      v-if="name"
      type="hidden"
      :name="name"
      :value="inputValue"
      :required="required"
    />
    <label class="input input-primary w-full flex items-center gap-2">
      <input
        ref="inputRef"
        type="text"
        :value="inputValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="grow bg-transparent outline-none"
        autocomplete="off"
        :readonly="isReadonly || undefined"
        v-bind="inputAttrs"
        @input="onInput"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />
      <slot name="icon" />
    </label>
    <ul
      v-show="showList"
      ref="listRef"
      class="autocomplete-list absolute w-full bg-white border border-primary mt-1 max-h-60 overflow-y-auto"
    >
      <li
        v-for="(option, index) in filteredOptions"
        :key="option.value"
        class="p-2 cursor-pointer hover:bg-primary hover:text-white"
        :class="{ 'bg-primary text-white': index === currentFocus }"
        @mousedown.prevent
        @click.stop="selectOption(option)"
      >
        {{ getOptionLabel(option) }}
      </li>
      <li
        v-if="
          acceptNewValue &&
          inputValue &&
          !filteredOptions.some((o) => o.value === inputValue)
        "
        class="p-2 cursor-pointer hover:bg-primary hover:text-white"
        :class="{
          'bg-primary text-white': currentFocus === filteredOptions.length,
        }"
        @mousedown.prevent
        @click.stop="selectNewValue"
      >
        "{{ inputValue }}"
      </li>
    </ul>
  </div>
</template>
