import { test, expect } from '@playwright/test'

test.describe('Tableau des falaises par ville', () => {
  const villeId = 6 // Lyon : la ville la plus fournie

  test('la source ne publie pas les emails des contributeurs', async ({ request }) => {
    const html = await (await request.get(`/tableau.php?ville_id=${villeId}`)).text()

    // window.__TABLEAU_DATA__ ne porte que les champs de TableauItinerary
    const data = html.match(/falaises: (.*),\n\s*villeId/)
    expect(data).not.toBeNull()
    expect(data![1]).not.toMatch(/_contrib"/)
    expect(data![1]).not.toContain('@')
  })

  test('la liste affiche toutes les falaises avec leurs temps et caractéristiques', async ({ page }) => {
    // Un champ manquant dans les données se traduit par NaN / undefined à
    // l'affichage (temps calculés, cotations…) ou par une exception JS.
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto(`/tableau.php?ville_id=${villeId}`)

    const nbFalaises = await page.evaluate(() => window.__TABLEAU_DATA__!.falaises.length)
    expect(nbFalaises).toBeGreaterThan(0)
    await expect(page.locator('#nbFalaisesInFilter')).toHaveText(`${nbFalaises} falaises`)

    // Chaque falaise a un lien vers sa fiche au départ de la ville (vues mobile
    // et bureau toutes deux dans le DOM : on compte les falaises distinctes)
    const liens = page.locator(`#vue-tableau a[href*="falaise.php?falaise_id="][href$="&ville_id=${villeId}"]`)
    const hrefs = new Set(await liens.evaluateAll((els) => els.map((a) => a.getAttribute('href'))))
    expect(hrefs.size).toBe(nbFalaises)

    const texte = await page.locator('#vue-tableau').innerText()
    expect(texte).toMatch(/Aller : \S+ - Retour : \S+/)
    expect(texte).toMatch(/\d+(\.\d+)? km, \d+ D\+, \d+ D-/)
    expect(texte).toContain("Marche d'approche")
    expect(texte).not.toMatch(/NaN|undefined/)
    expect(errors).toEqual([])
  })
})

declare global {
  interface Window {
    __TABLEAU_DATA__?: { falaises: unknown[]; villeId: number }
  }
}
