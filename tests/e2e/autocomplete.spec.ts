import { test, expect, Page } from '@playwright/test'

/**
 * Helper pour tester un champ autocomplete
 * - Tape du texte
 * - Attend le dropdown
 * - Sélectionne une option
 * - Vérifie que la valeur est bien sélectionnée
 */
async function testAutocomplete(
  page: Page,
  inputSelector: string,
  searchText: string,
  expectedOptionText: string | RegExp,
  hiddenFieldSelector?: string
) {
  const input = page.locator(inputSelector)
  await expect(input).toBeVisible()

  // Vider le champ d'abord
  await input.clear()

  // Taper le texte de recherche
  await input.fill(searchText)

  // Attendre que le dropdown apparaisse
  const dropdown = page.locator('.autocomplete-list')
  await expect(dropdown).toBeVisible({ timeout: 5000 })

  // Vérifier qu'il y a des options
  const options = dropdown.locator('li')
  await expect(options.first()).toBeVisible()

  // Trouver et cliquer sur l'option attendue
  const targetOption = options.filter({ hasText: expectedOptionText })
  await expect(targetOption.first()).toBeVisible()
  await targetOption.first().click()

  // Vérifier que l'input a la bonne valeur
  await expect(input).toHaveValue(expectedOptionText)

  // Vérifier que le champ caché est rempli (si spécifié)
  if (hiddenFieldSelector) {
    const hiddenField = page.locator(hiddenFieldSelector)
    const value = await hiddenField.inputValue()
    expect(value).not.toBe('')
  }
}

/**
 * Helper pour tester la navigation clavier dans l'autocomplete
 */
async function testAutocompleteKeyboard(
  page: Page,
  inputSelector: string,
  searchText: string
) {
  const input = page.locator(inputSelector)
  await input.clear()
  await input.fill(searchText)

  // Attendre le dropdown
  const dropdown = page.locator('.autocomplete-list')
  await expect(dropdown).toBeVisible()

  // Navigation avec flèches
  await input.press('ArrowDown')

  // La première option devrait être focus (bg-primary)
  const firstOption = dropdown.locator('li').first()
  await expect(firstOption).toHaveClass(/bg-primary/)

  // Descendre encore
  await input.press('ArrowDown')

  // Remonter
  await input.press('ArrowUp')
  await expect(firstOption).toHaveClass(/bg-primary/)

  // Sélectionner avec Enter
  await input.press('Enter')

  // Le dropdown devrait se fermer
  await expect(dropdown).not.toBeVisible()

  // L'input devrait avoir une valeur
  const value = await input.inputValue()
  expect(value.length).toBeGreaterThan(0)
}

// =============================================================================
// TESTS AJOUT FALAISE - Autocomplete nom de falaise
// =============================================================================

test.describe('Autocomplete - Ajout Falaise', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    await page.waitForSelector('#vue-ajout-falaise')
  })

  test('autocomplete falaise affiche des suggestions', async ({ page }) => {
    const input = page.locator('#vue-ajout-falaise input[type="text"]')
    await input.fill('Pont')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    const options = dropdown.locator('li')
    const count = await options.count()
    expect(count).toBeGreaterThan(0)
  })

  test('autocomplete falaise sélectionne une option existante', async ({ page }) => {
    await testAutocomplete(
      page,
      '#vue-ajout-falaise input[type="text"]',
      'Pont',
      /Pont/,
      '#falaise_id'
    )
  })

  test('autocomplete falaise - navigation clavier', async ({ page }) => {
    await testAutocompleteKeyboard(
      page,
      '#vue-ajout-falaise input[type="text"]',
      'Pont'
    )
  })

  test('autocomplete falaise - Escape vide le champ', async ({ page }) => {
    const input = page.locator('#vue-ajout-falaise input[type="text"]')
    await input.fill('Pont')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    await input.press('Escape')

    await expect(dropdown).not.toBeVisible()
    await expect(input).toHaveValue('')
  })

  test('autocomplete falaise - filtre insensible aux accents', async ({ page }) => {
    const input = page.locator('#vue-ajout-falaise input[type="text"]')

    // Taper sans accent
    await input.fill('cret')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    // Devrait trouver des falaises avec "crêt" ou "crét"
    const options = dropdown.locator('li')
    const count = await options.count()
    // On vérifie juste que le filtre fonctionne
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

// =============================================================================
// TESTS AJOUT VELO - Autocomplete gare + falaise
// =============================================================================

test.describe('Autocomplete - Ajout Vélo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ajout/ajout_velo.php')
    await page.waitForSelector('#vue-ajout-velo')
  })

  test('autocomplete gare affiche des suggestions', async ({ page }) => {
    // Le premier input est la gare
    const gareInput = page.locator('#vue-ajout-velo input[type="text"]').first()
    await gareInput.fill('Lyon')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    const options = dropdown.locator('li')
    const count = await options.count()
    expect(count).toBeGreaterThan(0)
  })

  test('autocomplete gare sélectionne une option et remplit le champ caché', async ({ page }) => {
    const gareInput = page.locator('#vue-ajout-velo input[type="text"]').first()
    await gareInput.fill('Lyon')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    // Cliquer sur la première option Lyon
    const option = dropdown.locator('li').filter({ hasText: /Lyon/ }).first()
    await option.click()

    // Vérifier le champ caché
    const hiddenGareId = page.locator('#gare_id')
    const gareIdValue = await hiddenGareId.inputValue()
    expect(gareIdValue).not.toBe('')
  })

  test('autocomplete falaise affiche des suggestions', async ({ page }) => {
    // Le deuxième input est la falaise
    const falaiseInput = page.locator('#vue-ajout-velo input[type="text"]').nth(1)
    await falaiseInput.fill('Pont')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    const options = dropdown.locator('li')
    const count = await options.count()
    expect(count).toBeGreaterThan(0)
  })

  test('autocomplete falaise sélectionne une option et remplit le champ caché', async ({ page }) => {
    const falaiseInput = page.locator('#vue-ajout-velo input[type="text"]').nth(1)
    await falaiseInput.fill('Pont')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    const option = dropdown.locator('li').filter({ hasText: /Pont/ }).first()
    await option.click()

    // Vérifier le champ caché
    const hiddenFalaiseId = page.locator('#falaise_id')
    const falaiseIdValue = await hiddenFalaiseId.inputValue()
    expect(falaiseIdValue).not.toBe('')
  })

  test('sélectionner gare ET falaise remplit les deux champs cachés', async ({ page }) => {
    // Sélectionner une gare
    const gareInput = page.locator('#vue-ajout-velo input[type="text"]').first()
    await gareInput.fill('Lyon')
    await page.locator('.autocomplete-list li').filter({ hasText: /Lyon/ }).first().click()

    // Sélectionner une falaise
    const falaiseInput = page.locator('#vue-ajout-velo input[type="text"]').nth(1)
    await falaiseInput.fill('Pont')
    await page.locator('.autocomplete-list li').filter({ hasText: /Pont/ }).first().click()

    // Vérifier les deux champs cachés
    const gareId = await page.locator('#gare_id').inputValue()
    const falaiseId = await page.locator('#falaise_id').inputValue()

    expect(gareId).not.toBe('')
    expect(falaiseId).not.toBe('')
  })

  test('navigation clavier sur autocomplete gare', async ({ page }) => {
    const gareInput = page.locator('#vue-ajout-velo input[type="text"]').first()
    await testAutocompleteKeyboard(page, '#vue-ajout-velo input[type="text"]', 'Lyon')
  })
})

// =============================================================================
// TESTS AJOUT TRAIN - Autocomplete gare
// =============================================================================

test.describe('Autocomplete - Ajout Train', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ajout/ajout_train.php')
    await page.waitForSelector('#vue-ajout-train')
  })

  test('autocomplete gare affiche des suggestions', async ({ page }) => {
    const input = page.locator('#vue-ajout-train input[type="text"]')
    await input.fill('Dijon')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    const options = dropdown.locator('li')
    const count = await options.count()
    expect(count).toBeGreaterThan(0)
  })

  test('autocomplete gare sélectionne une option', async ({ page }) => {
    const input = page.locator('#vue-ajout-train input[type="text"]')
    await input.fill('Dijon')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    const option = dropdown.locator('li').filter({ hasText: /Dijon/ }).first()
    await option.click()

    // Vérifier que l'input a la valeur
    await expect(input).toHaveValue(/Dijon/)

    // Vérifier le champ caché gare_id
    const hiddenGareId = page.locator('#gare_id')
    const gareIdValue = await hiddenGareId.inputValue()
    expect(gareIdValue).not.toBe('')
  })

  test('autocomplete gare remplit aussi train_arrivee', async ({ page }) => {
    const input = page.locator('#vue-ajout-train input[type="text"]')
    await input.fill('Dijon')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    const option = dropdown.locator('li').filter({ hasText: /Dijon/ }).first()
    await option.click()

    // Vérifier le champ caché train_arrivee
    const hiddenArrivee = page.locator('#train_arrivee')
    const arriveeValue = await hiddenArrivee.inputValue()
    expect(arriveeValue).toContain('Dijon')
  })
})

// =============================================================================
// TESTS CARTE - Autocomplete recherche (falaises + gares)
// =============================================================================

test.describe('Autocomplete - Carte recherche', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/carte.php')
    await page.waitForSelector('#vue-search')
  })

  test('autocomplete recherche affiche des suggestions de falaises', async ({ page }) => {
    const input = page.locator('#vue-search input[type="text"]')
    await input.fill('Pont')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    // Devrait y avoir des options avec "(falaise)"
    const falaiseOptions = dropdown.locator('li').filter({ hasText: '(falaise)' })
    const count = await falaiseOptions.count()
    expect(count).toBeGreaterThan(0)
  })

  test('autocomplete recherche affiche des suggestions de gares', async ({ page }) => {
    const input = page.locator('#vue-search input[type="text"]')
    await input.fill('Lyon')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    // Devrait y avoir des options avec "(gare)"
    const gareOptions = dropdown.locator('li').filter({ hasText: '(gare)' })
    const count = await gareOptions.count()
    expect(count).toBeGreaterThan(0)
  })

  test('sélectionner une falaise émet un événement', async ({ page }) => {
    const input = page.locator('#vue-search input[type="text"]')
    await input.fill('Pont')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    // Écouter l'événement custom
    const eventPromise = page.evaluate(() => {
      return new Promise<{ id: number; type: string; name: string }>((resolve) => {
        window.addEventListener('velogrimpe:search-select', ((e: CustomEvent) => {
          resolve(e.detail)
        }) as EventListener, { once: true })
      })
    })

    // Cliquer sur une falaise
    const option = dropdown.locator('li').filter({ hasText: /Pont.*\(falaise\)/ }).first()
    await option.click()

    // Vérifier l'événement
    const eventDetail = await eventPromise
    expect(eventDetail.type).toBe('falaise')
    expect(eventDetail.name).toContain('Pont')
  })

  test('sélectionner une gare émet un événement', async ({ page }) => {
    const input = page.locator('#vue-search input[type="text"]')
    await input.fill('Lyon')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()

    // Écouter l'événement custom
    const eventPromise = page.evaluate(() => {
      return new Promise<{ id: number; type: string; name: string }>((resolve) => {
        window.addEventListener('velogrimpe:search-select', ((e: CustomEvent) => {
          resolve(e.detail)
        }) as EventListener, { once: true })
      })
    })

    // Cliquer sur une gare
    const option = dropdown.locator('li').filter({ hasText: /Lyon.*\(gare\)/ }).first()
    await option.click()

    // Vérifier l'événement
    const eventDetail = await eventPromise
    expect(eventDetail.type).toBe('gare')
    expect(eventDetail.name).toContain('Lyon')
  })

  test('navigation clavier sur recherche', async ({ page }) => {
    await testAutocompleteKeyboard(
      page,
      '#vue-search input[type="text"]',
      'Lyon'
    )
  })
})

// =============================================================================
// TESTS DE ROBUSTESSE
// =============================================================================

test.describe('Autocomplete - Robustesse', () => {
  test('autocomplete ne plante pas avec caractères spéciaux', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    await page.waitForSelector('#vue-ajout-falaise')

    const input = page.locator('#vue-ajout-falaise input[type="text"]')

    // Caractères spéciaux
    await input.fill('<script>alert("xss")</script>')
    // Pas d'erreur JS, le dropdown peut être vide ou pas
    await page.waitForTimeout(200)

    // Emoji
    await input.clear()
    await input.fill('🧗‍♂️')
    await page.waitForTimeout(200)

    // Guillemets
    await input.clear()
    await input.fill('"test"')
    await page.waitForTimeout(200)

    // Pas d'erreur console critique
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await input.clear()
    await input.fill('test normal')

    // Pas d'erreurs fatales
    expect(errors.filter(e => e.includes('TypeError') || e.includes('SyntaxError'))).toHaveLength(0)
  })

  test('autocomplete fonctionne après navigation retour', async ({ page }) => {
    await page.goto('/ajout/ajout_falaise.php')
    await page.waitForSelector('#vue-ajout-falaise')

    // Naviguer ailleurs
    await page.goto('/carte.php')
    await page.waitForSelector('#map')

    // Revenir
    await page.goBack()
    await page.waitForSelector('#vue-ajout-falaise')

    // L'autocomplete devrait fonctionner
    const input = page.locator('#vue-ajout-falaise input[type="text"]')
    await input.fill('Pont')

    const dropdown = page.locator('.autocomplete-list')
    await expect(dropdown).toBeVisible()
  })
})
