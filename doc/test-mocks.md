# Setup/Teardown pour la BDD

Plusieurs stratégies possibles :

## Option A : Nettoyer après le test (recommandé pour commencer)

```js
test.describe('Ajout Falaise - avec cleanup', () => {
let createdFalaiseId: number | null = null

    test.afterEach(async ({ request }) => {
      // Nettoyer via une API admin si une falaise a été créée
      if (createdFalaiseId) {
        await request.delete(`/api/private/delete_falaise.php?id=${createdFalaiseId}`, {
          headers: { 'Authorization': 'Bearer ton_admin_token' }
        })
        createdFalaiseId = null
      }
    })

    test('peut créer une falaise', async ({ page }) => {
      // ... remplir le formulaire ...
      await page.click('button[type="submit"]')

      // Récupérer l'ID créé depuis l'URL de redirection
      await page.waitForURL(/confirmation.*falaise_id=(\d+)/)
      const url = page.url()
      createdFalaiseId = parseInt(url.match(/falaise_id=(\d+)/)?.[1] || '0')
    })
})
```

## Option B : Utiliser des données de test identifiables

```js
const TEST_PREFIX = "[TEST-E2E]";

test("peut créer une falaise", async ({ page }) => {
  // Nom unique qui sera facile à identifier/nettoyer
  const testName = `${TEST_PREFIX} Falaise ${Date.now()}`;

  await page.fill("#falaise_nom", testName);
  // ...
});

// Script séparé de cleanup (à lancer périodiquement)
// DELETE FROM falaises WHERE falaise_nom LIKE '[TEST-E2E]%'
```

## Option C : Base de données de test séparée

```js
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: process.env.CI
      ? "http://localhost:4002" // BDD de test
      : "http://localhost:4002", // ou BDD locale de dev
  },
});
```

## Option D : Mocker les appels API (pas de vraie BDD)

```js
test("formulaire envoie les bonnes données", async ({ page }) => {
  // Intercepter l'appel API
  await page.route("/api/add_falaise.php", async (route) => {
    const request = route.request();
    const postData = request.postDataJSON();

    // Vérifier les données envoyées
    expect(postData.falaise_nom).toBe("Ma Falaise");

    // Répondre sans toucher la BDD
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true, falaise_id: 999 }),
    });
  });

  // Remplir et soumettre
  await page.fill("#falaise_nom", "Ma Falaise");
  await page.click('button[type="submit"]');
});
```
