# Tests E2E - Velogrimpe

Tests end-to-end avec Playwright.

## Prérequis

- Le serveur PHP doit tourner sur `http://localhost:4000`
- Le conteneur Docker `velogrimpe` démarré, avec la base seedée (cf. CLAUDE.md)
- Les tests lisent les données réelles de la base locale (falaises, gares, villes) :
  une base vide les fait échouer

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

# Balayage anti-email seul (sans relancer d'abord toute la suite)
bun run test --project=no-email --no-deps
```

`no-email.spec.ts` parcourt tout le site (~3500 pages et endpoints, ~20 s) :
il tourne dans son propre projet Playwright, après les autres tests, pour ne
pas les ralentir. Seules les adresses de contact sont autorisées
(`contact@velogrimpe.fr`, `contact_mail` de `config.php`, contact du
rassemblement) ; la liste est en tête du fichier.

## Structure des tests

```
tests/e2e/
├── navigation.spec.ts    # Tests de navigation entre pages
├── carte.spec.ts         # Tests de la carte Leaflet
├── falaise.spec.ts       # Tests des pages falaise
├── tableau.spec.ts       # Tableau des falaises par ville (données + rendu Vue)
├── sortie.spec.ts        # Page sortie (ni jetons ni email de l'organisateur)
├── no-email.spec.ts      # Aucune adresse mail publiée hors adresses de contact
├── admin-token.spec.ts   # Le jeton admin ne s'affiche qu'à qui le fournit
├── ajout-falaise.spec.ts # Tests du formulaire d'ajout
├── ajout-bus-falaises.spec.ts # Falaises liées d'un arrêt de bus (liste + carte)
└── autocomplete.spec.ts  # Tests des champs autocomplete
```

## Écrire un nouveau test

```typescript
import { test, expect } from "@playwright/test";

test.describe("Ma fonctionnalité", () => {
  test("fait quelque chose", async ({ page }) => {
    await page.goto("/ma-page.php");
    await expect(page.locator("#element")).toBeVisible();
  });
});
```

## Patterns utiles

### Attendre qu'un composant Vue soit monté

```typescript
await page.waitForSelector("#vue-mount-point");
```

### Tester une carte Leaflet

```typescript
// Attendre que Leaflet soit chargé
await page.waitForSelector(".leaflet-container");

// Cliquer sur un marker
await page.locator(".leaflet-marker-icon").first().click();

// Vérifier un popup
await expect(page.locator(".leaflet-popup")).toBeVisible();
```

### Mocker la géolocalisation

```typescript
test("avec position mockée", async ({ context, page }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 45.76, longitude: 4.83 });
  await page.goto("/carte.php");
});
```

### Tester un formulaire

```typescript
await page.fill("#input-name", "valeur");
await page.selectOption("#select-id", "option-value");
await page.click('button[type="submit"]');
```

## Configuration

Voir `playwright.config.ts` à la racine du projet pour :

- Changer le baseURL
- Ajouter d'autres navigateurs (Firefox, Safari)
- Configurer les retries et le parallélisme
