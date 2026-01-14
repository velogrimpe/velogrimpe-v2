# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velogrimpe.fr is a community website for finding climbing crags accessible by bicycle and train in France. It's a PHP/HTML/CSS/JS project hosted on Hostinger single web hosting. Frontend components are built with Vue.js + Vite.

## Development Environment

### Local Setup
```bash
# Start the Docker container (from parent directory containing velo-grimpe/)
export ROOTPARENT=/path/to/parent
docker run --platform linux/x86_64 --name myXampp -p 4001:22 -p 4000:80 -d \
  -v $ROOTPARENT/velo-grimpe/public_html:/opt/lampp/htdocs \
  --mount type=bind,source=$ROOTPARENT/velo-grimpe/config.php,target=/opt/lampp/config.php,readonly \
  tomsik68/xampp:8
```

- **Site**: http://localhost:4000
- **phpMyAdmin**: http://localhost:4000/phpmyadmin
- Changes are live-reloaded (manual browser refresh needed)

### Git Setup (after cloning)
```bash
# Enable git hooks (auto-builds frontend on commit)
git config core.hooksPath .githooks

# Create config.php from template
cp config.sample.php config.php
# Edit config.php with your credentials
```

### API Testing
HTTP test files in `tests/` directory can be used with REST Client extensions (VS Code, IntelliJ):
- `tests/tests.http` - Main API endpoint tests
- `tests/geocode.http` - Geocoding tests

## Project Structure

```
velo-grimpe/
├── config.php              # Database credentials and API keys (outside public_html)
├── public_html/            # Main web application (git repo)
│   ├── *.php               # Main pages (carte, falaise, tableau, etc.)
│   ├── api/                # REST API endpoints
│   │   ├── public/         # Public APIs (oblyk integration)
│   │   └── private/        # Admin-only APIs (require admin_token)
│   ├── ajout/              # Contribution forms (add crag, route, station)
│   ├── admin/              # Admin interface
│   ├── database/           # Database connection files
│   │   ├── velogrimpe.php  # Main DB connection ($mysqli)
│   │   └── sncf.php        # Train schedules DB connection
│   ├── lib/                # PHP utilities (mail, logging, geocoding)
│   ├── components/         # Shared HTML components (header, footer)
│   ├── js/                 # JavaScript files
│   └── bdd/                # Data files (images, GPX tracks, GeoJSON)
├── frontend/               # Vue.js + Vite frontend (builds to public_html/dist/)
│   ├── src/apps/           # Entry points per PHP page
│   ├── src/components/     # Vue components
│   ├── src/stores/         # Pinia stores
│   └── src/types/          # TypeScript definitions
├── gares/                  # Bun/TypeScript project for train station data
├── misc/                   # Data processing scripts (Bun/JS, SQL imports)
└── climbing-away/          # Climbing-away.com data processing pipeline
```

## Architecture

### Two Databases
- **velogrimpe**: Main database with tables for `falaises` (crags), `velo` (bike routes), `gares` (train stations), `villes` (cities), `train` (train connections)
- **sncf**: Train schedules and connections data

### Key Data Relationships
- `falaises` → climbing crags with location, difficulty, exposure info
- `velo` → bike routes connecting `gares` to `falaises`
- `train` → train connections from `villes` to `gares`

### Frontend Stack
- **Vue.js 3** + **Vite** for reactive UI components (filters, forms)
- **Pinia** for state management
- **Leaflet** for interactive maps with protomaps-leaflet for train line tiles
- **Tailwind CSS** + **DaisyUI** (built locally via Vite)
- TypeScript for Vue components

### Authentication
- Admin APIs use Bearer token from `config.php['admin_token']`
- Contributor APIs use `config.php['contrib_token']`
- External API integrations: Oblyk (climbing data), Mailgun (email)

## Frontend Development

```bash
cd frontend
bun install        # Install dependencies
bun run dev        # Vite dev server with HMR
bun run build      # Build to public_html/dist/
bun run typecheck  # TypeScript validation
```

### Vue-PHP Integration
- PHP renders pages; Vue enhances with reactive components
- Data passed via `data-*` attributes on mount elements
- Vue emits changes via custom events (`velogrimpe:filters`)
- Existing Leaflet code listens to events and updates map

### Adding New Vue Components
1. Create component in `frontend/src/components/`
2. Add entry point in `frontend/src/apps/` if new page
3. Update `vite.config.ts` rollupOptions.input for new entry points
4. Build and include script in PHP: `<script type="module" src="/dist/[name].js">`

### Adding Autocomplete Fields to a Page

The project uses Vue-based autocomplete components. To add a new autocomplete field:

#### 1. Create an Entry Point (TypeScript)

Create a new file in `frontend/src/apps/`, e.g., `my-page.ts`:

```typescript
import { createApp, h, ref } from 'vue'
import FormAutocomplete, { type FormAutocompleteItem } from '@/components/shared/FormAutocomplete.vue'

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('vue-my-autocomplete')
  if (!mountEl) return

  // Parse data from PHP
  let items: FormAutocompleteItem[] = []
  try {
    items = JSON.parse(mountEl.dataset.items || '[]')
  } catch (e) {
    console.error('Failed to parse data:', e)
  }

  const app = createApp({
    setup() {
      const value = ref('')

      const onSelect = (item: FormAutocompleteItem | null) => {
        // Handle selection - e.g., populate hidden fields
        const hiddenInput = document.getElementById('item_id') as HTMLInputElement
        if (hiddenInput && item) hiddenInput.value = String(item.id)
      }

      return () =>
        h('div', [
          h(FormAutocomplete, {
            modelValue: value.value,
            'onUpdate:modelValue': (v: string) => { value.value = v },
            items,
            acceptNewValue: false, // Set to true to allow custom entries
            onSelect,
          }),
          // Hidden input for form submission
          h('input', { type: 'hidden', name: 'item_id', id: 'item_id' }),
        ])
    },
  })

  app.mount(mountEl)
})
```

#### 2. Add Entry Point to Vite Config

In `frontend/vite.config.ts`, add the new entry:

```typescript
rollupOptions: {
  input: {
    // ... existing entries
    'my-page': resolve(__dirname, 'src/apps/my-page.ts'),
  },
}
```

#### 3. Update the PHP Page

In your PHP file:

```php
<!-- Mount element with data passed via data attributes -->
<div id="vue-my-autocomplete"
  data-items='<?= json_encode($items) ?>'>
</div>

<!-- Include Vue script at end of body -->
<script type="module" src="/dist/my-page.js"></script>
```

#### 4. Build

```bash
cd frontend && bun run build
```

#### Component Props Reference

The `FormAutocomplete` component accepts:
- `items`: Array of `{ id, nom, ...otherProps }` objects
- `placeholder`: Input placeholder text
- `acceptNewValue`: If true, allows entering values not in the list
- `disabled`: Disables the input

Events:
- `select`: Fired when an option is selected, receives `(item, value)`
- `update:modelValue`: v-model binding for the input value

#### Existing Examples

See these files for working examples:
- `frontend/src/apps/ajout-velo.ts` - Two autocomplete fields (gare, falaise)
- `frontend/src/apps/ajout-train.ts` - Single autocomplete field (gare)
- `frontend/src/apps/falaise-comment.ts` - Three autocomplete fields in a modal

## Coding Guidelines

- Use PHP 8.3+ features
- Prefer comment blocks above functions/sections over inline comments
- Reuse existing functions from `lib/` when appropriate
- Stick to existing project conventions and PHP standards
- Vue components use Composition API with `<script setup>`

## Future Improvements

- **Icons**: Optimize icon storage/loading and improve reuse DX (currently inline SVGs in Vue components; consider a shared icon component or sprite system)

## TODO

- **Filters sort position**: During the Vue filters migration, the sort control changed position. Compare with production (velogrimpe.fr) and fix the layout to match.
