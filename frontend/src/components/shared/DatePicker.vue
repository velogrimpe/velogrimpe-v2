<script setup lang="ts">
import { ref, watch } from "vue";

interface Props {
  modelValue: string; // YYYY-MM-DD format
  label?: string;
  placeholder?: string;
  required?: boolean;
  minDate?: string; // YYYY-MM-DD format
  maxDate?: string; // YYYY-MM-DD format
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: "",
  placeholder: "Sélectionner une date",
  required: false,
  minDate: "",
  maxDate: "",
  error: "",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const inputValue = ref(props.modelValue);

watch(
  () => props.modelValue,
  (newValue) => {
    inputValue.value = newValue;
  }
);

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  inputValue.value = target.value;
  emit("update:modelValue", target.value);
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text">
        {{ label }}
        <span v-if="required" class="text-error">*</span>
      </span>
    </label>
    <input
      type="date"
      class="input input-bordered w-full"
      :class="{ 'input-error': error }"
      :value="inputValue"
      :placeholder="placeholder"
      :required="required"
      :min="minDate"
      :max="maxDate"
      @input="handleInput"
    />
    <label v-if="error" class="label">
      <span class="label-text-alt text-error">{{ error }}</span>
    </label>
  </div>
</template>
