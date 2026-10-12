import { test, expect, type APIRequestContext } from '@playwright/test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Aucune adresse mail ne doit être publiée, hormis les adresses de contact.
 * Les emails des contributeurs (falaise_contrib, velo_contrib…) ont fuité par
 * des SELECT * envoyés tels quels au navigateur : ce test balaie tout ce qu'un
 * visiteur peut lire — pages HTML, endpoints JSON publics, flux, open-data.
 */

// contact_mail (config.php, git-ignoré) : adresse de contact de l'environnement,
// publiée par contribuer.php ; en local elle peut différer de celle de la prod.
const CONFIG = join(__dirname, '../../config.php')
const contactMail = existsSync(CONFIG)
  ? readFileSync(CONFIG, 'utf8').match(/['"]contact_mail['"]\s*=>\s*['"]([^'"]+)['"]/)?.[1]
  : undefined

const ADRESSES_AUTORISEES = new Set([
  'contact@velogrimpe.fr',
  // Contact public de l'organisation du rassemblement (page CMS /p/grand-rassemblement-…)
  'velo-grimpe@proton.me',
  ...(contactMail ? [contactMail.toLowerCase()] : []),
])
// "logo@2x.png" ressemble à une adresse : on écarte les extensions de fichier
const EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|avif|ico|js|mjs|css|map|json|gpx|geojson|pdf|woff2?)$/i
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g

function adressesInterdites(texte: string): string[] {
  const trouvees = texte.match(EMAIL) ?? []
  return [...new Set(trouvees)].filter((a) => !ADRESSES_AUTORISEES.has(a.toLowerCase()) && !EXTENSIONS.test(a))
}

/** Exécute fn sur chaque élément, `concurrence` à la fois. */
async function pool<T>(items: T[], concurrence: number, fn: (item: T) => Promise<void>) {
  const file = [...items]
  await Promise.all(Array.from({ length: concurrence }, async () => {
    for (let item = file.shift(); item !== undefined; item = file.shift()) await fn(item)
  }))
}

async function urlsDuSitemap(request: APIRequestContext): Promise<string[]> {
  const xml = await (await request.get('/sitemap.php')).text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    new URL(m[1].replaceAll('&amp;', '&')).pathname + new URL(m[1].replaceAll('&amp;', '&')).search,
  )
}

async function idsFalaises(request: APIRequestContext): Promise<number[]> {
  const urls = await urlsDuSitemap(request)
  return [...new Set(urls.flatMap((u) => u.match(/falaise_id=(\d+)/)?.[1] ?? []).map(Number))]
}

test.describe('Aucune adresse mail publiée (hors adresses de contact)', () => {
  test.describe.configure({ timeout: 10 * 60_000 })

  test('pages HTML : sitemap + toutes les pages liées', async ({ request, baseURL }) => {
    // Pages publiques absentes du sitemap ; le crawl trouve le reste
    // (pages d'édition, sorties, newsletters…) en suivant les liens.
    const departs = [
      ...(await urlsDuSitemap(request)),
      '/sorties.php',
      '/carte_maplibre.php',
      '/ajout/falaises_accessibles_a_pied.php',
      '/feed/actualites.xml',
      '/feed/nouveautes.xml',
    ]
    const sorties = (await (await request.get('/api/fetch_sorties.php')).json()).sorties ?? []
    for (const s of sorties) departs.push(`/sortie.php?sortie_id=${s.sortie_id}`)

    const vues = new Set<string>()
    const aVisiter = [...new Set(departs)]
    const fuites: Record<string, string[]> = {}
    const origine = new URL(baseURL!).origin

    // Liens absolus vers la prod (canonical, partage…) : suivis en local
    const interne = (url: URL) => url.origin === origine || url.hostname === 'velogrimpe.fr'
    const crawlable = (url: URL) =>
      interne(url) &&
      !/^\/(admin|api|open-data|public|dist|images|js|actualites\/gestion)\//.test(url.pathname) &&
      !EXTENSIONS.test(url.pathname)
    const suivre = (href: string, depuis: string) => {
      const url = new URL(href.replaceAll('&amp;', '&'), origine + depuis)
      const cible = url.pathname + url.search
      if (crawlable(url) && !vues.has(cible)) aVisiter.push(cible)
    }

    while (aVisiter.length > 0) {
      const lot = [...new Set(aVisiter.splice(0))].filter((u) => !vues.has(u))
      lot.forEach((u) => vues.add(u))
      await pool(lot, 8, async (chemin) => {
        // Redirections suivies à la main : la canonique pointe vers la prod
        const reponse = await request.get(chemin, { maxRedirects: 0 })
        const location = reponse.headers()['location']
        if (location) return suivre(location, chemin)

        const html = await reponse.text()
        const interdites = adressesInterdites(html)
        if (interdites.length > 0) fuites[chemin] = interdites
        for (const [, href] of html.matchAll(/href="([^"#]+)/g)) suivre(href, chemin)
      })
    }

    console.log(`${vues.size} pages vérifiées`)
    expect(vues.size).toBeGreaterThan(500)
    expect(fuites).toEqual({})
  })

  test('endpoints JSON publics, pour chaque falaise', async ({ request }) => {
    const ids = await idsFalaises(request)
    expect(ids.length).toBeGreaterThan(100)

    const urls = [
      '/api/fetch_sorties.php',
      '/api/fetch_emport.php',
      ...ids.flatMap((id) => [
        `/api/fetch_falaise.php?falaise_id=${id}`,
        `/api/fetch_velos.php?falaise_id=${id}`,
        `/api/fetch_sortie_velos.php?falaise_id=${id}`,
        `/api/fetch_bus_arrets.php?falaise_id=${id}`,
        `/api/private/falaise_details.php?falaise_id=${id}`,
      ]),
    ]
    const fuites: Record<string, string[]> = {}
    await pool(urls, 8, async (url) => {
      const interdites = adressesInterdites(await (await request.get(url)).text())
      if (interdites.length > 0) fuites[url] = interdites
    })
    expect(fuites).toEqual({})
  })

  test('exports open-data', async () => {
    // Lus sur disque : passer par /open-data/ déclenche le suivi des téléchargements
    const dossier = join(__dirname, '../../public/open-data')
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.geojson'))
    expect(fichiers.length).toBeGreaterThan(0)

    const fuites: Record<string, string[]> = {}
    for (const f of fichiers) {
      const interdites = adressesInterdites(readFileSync(join(dossier, f), 'utf8'))
      if (interdites.length > 0) fuites[f] = interdites
    }
    expect(fuites).toEqual({})
  })
})
