import { test, expect } from '@playwright/test'

/**
 * Tableau (Lot 8) : les accès à pied depuis un arrêt relié à la ville sont des
 * lignes à part entière. Colonne « temps total » vide ; les colonnes train et
 * vélo sont fusionnées en une cellule « Accès piéton possible via <modes>
 * (<lignes>) en gare de / à l'arrêt <nom> ». Témoin réel : Marseille (ville 15), gare de Niolon (2273),
 * falaises 259 et 260, accès piéton seul. Repères : `data-testid`
 * `falaise-row-<id>` (ligne desktop), `falaise-card-<id>` (carte mobile) et `acces-pieton-<id>`
 * (texte de la cellule fusionnée).
 */

const VILLE = 15
const FALAISE = 260

test.describe('Tableau : accès à pied', () => {
  test('desktop : cellule fusionnée « Accès piéton possible via TER », temps total vide', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/tableau.php?ville_id=${VILLE}`)

    const row = page.getByTestId(`falaise-row-${FALAISE}`)
    await expect(row).toBeVisible()
    const cellule = row.getByTestId(`acces-pieton-${FALAISE}`)
    await expect(cellule).toContainText('Accès piéton possible via TER en gare de Niolon')
    // Distance et dénivelés de l'accès (ex-itinéraire « à pied uniquement » : 0,4 km, 10 D+, 20 D-), sous le libellé
    await expect(row.getByTestId(`acces-pieton-chiffres-${FALAISE}`)).toHaveText('0.4 km, 10 D+, 20 D-')
    // Texte courant : ni gras ni vert
    await expect(cellule).toHaveCSS('font-weight', '400')
    await expect(cellule).not.toHaveClass(/text-primary/)
    // Pas de temps vélo ni « Pas de train a prendre » pour cette ligne
    await expect(row).not.toContainText('Pas de train')
    await expect(row.getByTestId(`temps-total-${FALAISE}`)).toHaveText('')
  })

  test('mobile : même mention dans la carte, sans temps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto(`/tableau.php?ville_id=${VILLE}`)

    const carte = page.getByTestId(`falaise-card-${FALAISE}`)
    await expect(carte).toBeVisible()
    const texte = carte.getByTestId(`acces-pieton-${FALAISE}`)
    await expect(texte).toHaveText('Accès piéton possible via TER en gare de Niolon')
    await expect(carte.getByTestId(`acces-pieton-chiffres-${FALAISE}`)).toHaveText('0.4 km, 10 D+, 20 D-')
    await expect(texte).toHaveCSS('font-weight', '400')
    await expect(texte).not.toHaveClass(/text-primary/)
  })

  test('une falaise sans temps total est listée après celles qui en ont un', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/tableau.php?ville_id=${VILLE}`)
    await page.getByTestId(`falaise-row-${FALAISE}`).waitFor()

    const ids = await page.locator('[data-testid^="falaise-row-"]').evaluateAll((els) =>
      els.map((e) => ({
        id: e.getAttribute('data-testid')!,
        // « sans temps total » : aucun accès chronométré dans la falaise (cellules de total toutes vides)
        pieton: [...e.querySelectorAll('[data-testid^="temps-total-"]')].every((c) => !c.textContent?.trim()),
      })),
    )
    const premierPieton = ids.findIndex((x) => x.pieton)
    expect(premierPieton).toBeGreaterThanOrEqual(0)
    expect(ids.slice(premierPieton).every((x) => x.pieton), 'aucune falaise chronométrée après les accès piéton seuls').toBe(true)
  })

  test("le filtre « Accessible à pied » garde la falaise à accès piéton", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/tableau.php?ville_id=${VILLE}`)
    await page.getByRole('button', { name: /Vélo/ }).click()
    await page.getByLabel('Accessible à pied').check()

    await expect(page.getByTestId(`falaise-row-${FALAISE}`)).toBeVisible()
  })

  test('un filtre de temps vélo écarte les accès piéton (aucun temps vélo à comparer)', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/tableau.php?ville_id=${VILLE}`)
    await page.getByRole('button', { name: /Vélo/ }).click()
    await page.locator('input[type="number"]:visible').first().fill('30')

    await expect(page.getByTestId(`falaise-row-${FALAISE}`)).toHaveCount(0)
  })

  test('desktop : les cellules train et vélo restent alignées d\'une ligne à l\'autre, la cellule piéton les recouvre', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    // Lyon : nombreuses lignes train+vélo, et la falaise 25 (Hostiaz) a aussi un accès piéton
    await page.goto('/tableau.php?ville_id=6')
    await page.getByTestId('falaise-row-25').waitFor()

    const boites = async (selecteur: string) =>
      page.locator(selecteur).evaluateAll((els) =>
        els
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0) // ignore les doublons mobiles masqués
          .map((r) => ({ x: Math.round(r.left), droite: Math.round(r.right) })),
      )
    const trains = await boites('[data-testid="cellule-train"]')
    const velos = await boites('[data-testid="cellule-velo"]')
    // (hors lignes de chiffres, imbriquées dans la cellule)
    const pietons = await boites('[data-testid^="acces-pieton-"]:not([data-testid^="acces-pieton-chiffres-"])')
    expect(trains.length).toBeGreaterThan(5)
    expect(pietons.length).toBeGreaterThan(0)

    // Une seule position de colonne pour toutes les lignes (tolérance de 1 px)
    for (const colonne of [trains, velos]) {
      const gauches = colonne.map((b) => b.x)
      const droites = colonne.map((b) => b.droite)
      expect(Math.max(...gauches) - Math.min(...gauches)).toBeLessThanOrEqual(1)
      expect(Math.max(...droites) - Math.min(...droites)).toBeLessThanOrEqual(1)
    }
    // La cellule piéton va du bord gauche des cellules train au bord droit des cellules vélo
    for (const p of pietons) {
      expect(Math.abs(p.x - trains[0].x)).toBeLessThanOrEqual(1)
      expect(Math.abs(p.droite - velos[0].droite)).toBeLessThanOrEqual(1)
    }
  })
})
