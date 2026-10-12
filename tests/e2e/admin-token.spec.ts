import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Le jeton admin (config.php) circule dans les URL (?admin=<jeton>) et les
 * pages le réécrivent dans leurs liens en mode admin. Une page qui acceptait
 * ?admin=1 comme booléen publiait donc le vrai jeton à n'importe qui :
 * aucune valeur autre que le jeton lui-même ne doit l'afficher.
 */

const CONFIG = join(__dirname, '../../config.php')
const adminToken = existsSync(CONFIG)
  ? readFileSync(CONFIG, 'utf8').match(/['"]admin_token['"]\s*=>\s*['"]([^'"]+)['"]/)?.[1]
  : undefined

const falaiseId = 39
const VALEURS_PIEGES = ['1', 'true', 'on', 'yes', '0', '', 'admin[]=1']

/** Pages qui lisent ?admin (relevé : grep "_GET['admin']" dans public_html). */
async function pagesAdmin(request: import('@playwright/test').APIRequestContext) {
  const { velos } = await (await request.get(`/api/fetch_velos.php?falaise_id=${falaiseId}`)).json()
  const { velo_id, gare_id } = velos[0]
  return [
    `/ajout/confirmation_falaise.php?falaise_id=${falaiseId}&type=insert&step=1`,
    `/ajout/confirmation_falaise.php?falaise_id=${falaiseId}&type=insert&step=2`,
    `/ajout/edit_details_falaise.php?falaise_id=${falaiseId}`,
    `/ajout/confirmation_bus.php?arret_id=1&type=insert`,
    `/ajout/confirmation_velo.php?falaise_id=${falaiseId}&gare_id=${gare_id}`,
    `/ajout/confirmation_train.php?ville_id=6&gare_id=${gare_id}`,
    `/ajout/ajout_falaise.php?falaise_id=${falaiseId}`,
    `/ajout/ajout_velo.php?falaise_id=${falaiseId}`,
    `/ajout/ajout_train.php`,
    `/ajout/ajout_bus.php`,
    `/ajout/ajout_ville.php`,
    `/ajout/edit_velo.php?falaise_id=${falaiseId}&gare_id=${gare_id}&velo_id=${velo_id}`,
  ]
}

test.describe('Jeton admin', () => {
  test.skip(!adminToken, 'config.php absent : jeton admin inconnu')

  test("n'est jamais publié sans être fourni", async ({ request }) => {
    const fuites: string[] = []
    for (const page of await pagesAdmin(request)) {
      for (const valeur of VALEURS_PIEGES) {
        const param = valeur.includes('=') ? valeur : `admin=${encodeURIComponent(valeur)}`
        const url = `${page}&${param}`.replace('.php&', '.php?')
        const html = await (await request.get(url, { maxRedirects: 0 })).text()
        if (html.includes(adminToken!) || html.includes(encodeURIComponent(adminToken!))) fuites.push(url)
      }
    }
    expect(fuites).toEqual([])
  })

  test('le mode admin fonctionne toujours avec le vrai jeton', async ({ request }) => {
    const html = await (await request.get(
      `/ajout/confirmation_falaise.php?falaise_id=${falaiseId}&type=insert&step=1&admin=${encodeURIComponent(adminToken!)}`,
    )).text()
    // Les liens de la suite du parcours restent en mode admin
    expect(html).toContain(`edit_details_falaise.php?falaise_id=${falaiseId}&amp;admin=${encodeURIComponent(adminToken!)}`)
    expect(html).toContain(`ajout_falaise.php?admin=${adminToken}`)
  })

  test("le parcours de contribution ne met ni nom ni email dans l'URL", async ({ request }) => {
    const html = await (await request.get(
      `/ajout/confirmation_falaise.php?falaise_id=${falaiseId}&type=insert&step=1`,
    )).text()
    const lien = html.match(/href="([^"]*edit_details_falaise\.php[^"]*)"/)?.[1]
    expect(lien).toBeTruthy()
    expect(lien).not.toMatch(/nom_prenom|email|admin/)
  })
})
