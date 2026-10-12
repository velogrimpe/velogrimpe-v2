import { test, expect } from '@playwright/test'

test.describe('Page sortie', () => {
  test('ne publie ni les jetons d\'édition/suppression ni l\'email de l\'organisateur', async ({ request }) => {
    const { sorties } = await (await request.get('/api/fetch_sorties.php')).json()
    test.skip(!sorties?.length, 'aucune sortie en base')

    for (const { sortie_id } of sorties) {
      const html = await (await request.get(`/sortie.php?sortie_id=${sortie_id}`)).text()
      const brut = html.match(/data-sortie='([^']*)'/)?.[1]
      expect(brut, `data-sortie de la sortie ${sortie_id}`).toBeTruthy()
      // data-sortie est échappé par htmlspecialchars (guillemets en &quot;)
      const sortie = JSON.parse(brut!.replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&amp;', '&'))

      expect(sortie.sortie_id).toBe(sortie_id)
      expect(Object.keys(sortie)).not.toContain('edit_token')
      expect(Object.keys(sortie)).not.toContain('delete_token')
      expect(Object.keys(sortie)).not.toContain('organisateur_email')
      expect(html).not.toMatch(/edit_token|delete_token/)
    }
  })

  test('affiche la sortie (organisateur, falaise)', async ({ page, request }) => {
    const { sorties } = await (await request.get('/api/fetch_sorties.php')).json()
    test.skip(!sorties?.length, 'aucune sortie en base')
    const [sortie] = sorties

    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/sortie.php?sortie_id=${sortie.sortie_id}`)

    const contenu = page.locator('#vue-sortie-details')
    await expect(contenu).toContainText(sortie.organisateur_nom)
    await expect(contenu).toContainText(sortie.falaise_principale_nom)
    expect(errors).toEqual([])
  })
})
