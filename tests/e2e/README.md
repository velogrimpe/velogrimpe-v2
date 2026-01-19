# Tests E2E - Velogrimpe

Tests end-to-end avec Playwright.

## Prérequis

- Le serveur PHP doit tourner sur `http://localhost:4002`
- Docker container `velogrimpe-2` démarré

## Commandes

```bash
# Lancer tous les tests
bun run test

# Lancer avec interface visuelle (recommandé pour le debug)
bun run test:ui

# Lancer en mode headed (voir le navigateur)
bun run test:headed

# Lancer en mode debug (pas à pas)
bun run test:debug

# Voir le rapport HTML après les tests
bun run test:report
```

## Structure des tests

```
tests/e2e/
├── navigation.spec.ts    # Tests de navigation entre pages
├── carte.spec.ts         # Tests de la carte Leaflet
├── falaise.spec.ts       # Tests des pages falaise
└── ajout-falaise.spec.ts # Tests du formulaire d'ajout
```

## Écrire un nouveau test

```typescript
import { test, expect } from '@playwright/test'

test.describe('Ma fonctionnalité', () => {
  test('fait quelque chose', async ({ page }) => {
    await page.goto('/ma-page.php')
    await expect(page.locator('#element')).toBeVisible()
  })
})
```

## Patterns utiles

### Attendre qu'un composant Vue soit monté

```typescript
await page.waitForSelector('#vue-mount-point')
```

### Tester une carte Leaflet

```typescript
// Attendre que Leaflet soit chargé
await page.waitForSelector('.leaflet-container')

// Cliquer sur un marker
await page.locator('.leaflet-marker-icon').first().click()

// Vérifier un popup
await expect(page.locator('.leaflet-popup')).toBeVisible()
```

### Mocker la géolocalisation

```typescript
test('avec position mockée', async ({ context, page }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 45.76, longitude: 4.83 })
  await page.goto('/carte.php')
})
```

### Tester un formulaire

```typescript
await page.fill('#input-name', 'valeur')
await page.selectOption('#select-id', 'option-value')
await page.click('button[type="submit"]')
```

## Configuration

Voir `playwright.config.ts` à la racine du projet pour :
- Changer le baseURL
- Ajouter d'autres navigateurs (Firefox, Safari)
- Configurer les retries et le parallélisme
