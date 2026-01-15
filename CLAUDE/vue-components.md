# Vue Components Guide

## Adding New Vue Components

1. Create component in `frontend/src/components/`
2. Add entry point in `frontend/src/apps/` if new page
3. Update `vite.config.ts` rollupOptions.input for new entry points
4. Build and include script in PHP: `<script type="module" src="/dist/[name].js">`

## Adding Autocomplete Fields to a Page

The project uses Vue-based autocomplete components. To add a new autocomplete field:

### 1. Create an Entry Point (TypeScript)

Create a new file in `frontend/src/apps/`, e.g., `my-page.ts`:

```typescript
import { createApp, h, ref } from "vue";
import FormAutocomplete, {
  type FormAutocompleteItem,
} from "@/components/shared/FormAutocomplete.vue";

document.addEventListener("DOMContentLoaded", () => {
  const mountEl = document.getElementById("vue-my-autocomplete");
  if (!mountEl) return;

  // Parse data from PHP
  let items: FormAutocompleteItem[] = [];
  try {
    items = JSON.parse(mountEl.dataset.items || "[]");
  } catch (e) {
    console.error("Failed to parse data:", e);
  }

  const app = createApp({
    setup() {
      const value = ref("");

      const onSelect = (item: FormAutocompleteItem | null) => {
        // Handle selection - e.g., populate hidden fields
        const hiddenInput = document.getElementById(
          "item_id"
        ) as HTMLInputElement;
        if (hiddenInput && item) hiddenInput.value = String(item.id);
      };

      return () =>
        h("div", [
          h(FormAutocomplete, {
            modelValue: value.value,
            "onUpdate:modelValue": (v: string) => {
              value.value = v;
            },
            items,
            acceptNewValue: false, // Set to true to allow custom entries
            onSelect,
          }),
          // Hidden input for form submission
          h("input", { type: "hidden", name: "item_id", id: "item_id" }),
        ]);
    },
  });

  app.mount(mountEl);
});
```

### 2. Add Entry Point to Vite Config

In `frontend/vite.config.ts`, add the new entry:

```typescript
rollupOptions: {
  input: {
    // ... existing entries
    'my-page': resolve(__dirname, 'src/apps/my-page.ts'),
  },
}
```

### 3. Update the PHP Page

In your PHP file:

```php
<!-- Mount element with data passed via data attributes -->
<div id="vue-my-autocomplete"
  data-items='<?= json_encode($items) ?>'>
</div>

<!-- Include Vue script at end of body -->
<script type="module" src="/dist/my-page.js"></script>
```

### 4. Build

```bash
cd frontend && bun run build
```

## FormAutocomplete Component Reference

**Props:**
- `items`: Array of `{ id, nom, ...otherProps }` objects
- `placeholder`: Input placeholder text
- `acceptNewValue`: If true, allows entering values not in the list
- `disabled`: Disables the input

**Events:**
- `select`: Fired when an option is selected, receives `(item, value)`
- `update:modelValue`: v-model binding for the input value

## Existing Examples

- `frontend/src/apps/ajout-velo.ts` - Two autocomplete fields (gare, falaise)
- `frontend/src/apps/ajout-train.ts` - Single autocomplete field (gare) + Transitous station search
- `frontend/src/apps/falaise-comment.ts` - Three autocomplete fields in a modal
