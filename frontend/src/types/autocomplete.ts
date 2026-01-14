export interface AutocompleteOption {
  value: string
  label?: string
  data?: unknown
}

export interface AutocompleteProps {
  modelValue: string
  options: AutocompleteOption[]
  placeholder?: string
  acceptNewValue?: boolean
  disabled?: boolean
}
