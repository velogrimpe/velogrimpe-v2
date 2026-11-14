import { pairKey, type GtfsStop } from "./gtfs";

/**
 * Politique d'import des arrêts d'un GTFS (docs/plan-arrets-parents.md).
 *
 * Arrêt GTFS → arrêt existant (le plus proche, enfants compris) :
 *  - à 50 m ou moins, ou à 100 m ou moins avec le même nom ;
 *  - l'arrêt n'a aucune ref GTFS (ou déjà la même) → identité : il adopte la ref, pas de nouvel arrêt ;
 *  - il en porte une autre (autre quai, autre flux) → regroupement : nouvel arrêt rangé sous le même parent.
 * Deux arrêts du GTFS entre eux : même station parente (`parent_station`) quelle que soit la distance, sinon
 * même nom à 200 m ou moins ; jamais deux arrêts consécutifs d'un même trajet.
 * Toujours intra-mode (TER et TGV forment une famille, les autres modes sont distincts).
 */

/** Distance max (m) d'un rapprochement avec un arrêt existant. */
export const MATCH_EXISTING_METERS = 50;
/** Idem si le nom est identique. */
export const MATCH_EXISTING_SAME_NAME_METERS = 100;
/** Un arrêt du catalogue portant déjà ce `stop_id` n'est reconnu qu'à cette distance (anti-collision entre réseaux). */
export const MATCH_SAME_REF_METERS = 100;
/** Distance max (m) entre deux arrêts du GTFS de même nom. */
export const MATCH_INTERNAL_METERS = 200;

export interface ArretGeo {
  id: number;
  nom: string;
  lat: number;
  lng: number;
  /** ter / tgv / bus / tram / telepherique (absent : compatible avec tout). */
  types?: string[];
  /** `stop_id` GTFS mémorisés sur l'arrêt (références externes de source gtfs). */
  gtfsRefs?: string[];
}

/** Nom comparable : casse, accents et ponctuation neutralisés, préfixes « gare de », « arrêt »… retirés. */
export function normalizeNom(nom: string): string {
  const s = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return s.replace(/^(gare|arret|station)( (de|du|des|d|la|le|les|l))?( |$)/, "").trim();
}

const sameName = (a: string, b: string) => {
  const n = normalizeNom(a);
  return n !== "" && n === normalizeNom(b);
};

/** Famille de modalité : TER et TGV (gares) ne forment qu'une famille, les autres sont distinctes. */
const family = (t: string) => (t === "ter" || t === "tgv" ? "rail" : t);

/** Un arrêt existant ne peut être rapproché que d'un arrêt GTFS de même famille (bus ≠ gare TER). */
export function typesCompatibles(arretTypes: string[] | undefined, stopTypes: string[] | undefined): boolean {
  if (!arretTypes?.length || !stopTypes?.length) return true;
  const fams = new Set(stopTypes.map(family));
  return arretTypes.some((t) => fams.has(family(t)));
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PlanAction =
  /** Arrêt de la ligne déjà suivi sous ce `stop_id` : mise à jour (position). */
  | "served"
  /** Identité : l'arrêt existant `arret` adopte (ou possède déjà) la ref de l'arrêt GTFS. */
  | "adopt"
  /** Nouvel arrêt, rangé sous le parent de l'arrêt existant `arret` (créé si besoin). */
  | "group"
  /** Nouvel arrêt (éventuellement regroupé avec d'autres nouveaux arrêts : `groupe`). */
  | "create";

export interface PlanItem {
  stop: GtfsStop;
  action: PlanAction;
  /** Arrêt existant concerné (served / adopt / group). */
  arret: ArretGeo | null;
  /** `id` : rapproché par une ref GTFS connue ; `proximite` sinon. */
  by: "id" | "proximite" | null;
  /** adopt : l'arrêt porte déjà cette ref (aucune écriture de ref à prévoir). */
  refKnown: boolean;
  /** create : clé commune aux nouveaux arrêts à regrouper sous un même parent. */
  groupe: string | null;
  /** create / group : `stop_id` de la station parente GTFS, porté par le parent créé. */
  groupeStopId: string | null;
}

export interface PlanContext {
  /** Arrêts déjà liés à la ligne. */
  linked: ArretGeo[];
  /** Arrêts sélectionnables (orphelins et enfants, jamais les parents), liés ou non. */
  catalog: ArretGeo[];
  /** Modalités de la ligne GTFS. */
  stopTypes?: string[];
  /** Paires d'arrêts consécutifs dans un trajet (`pairKey`) : jamais regroupés par nom / distance. */
  consecutive?: Set<string>;
}

export interface GtfsPlan {
  items: PlanItem[];
  /** Arrêts liés à la ligne mais absents du GTFS. */
  removed: ArretGeo[];
}

export function planGtfsStops(stops: GtfsStop[], ctx: PlanContext): GtfsPlan {
  const { linked, catalog, stopTypes, consecutive } = ctx;
  const compat = (a: ArretGeo) => typesCompatibles(a.types, stopTypes);
  const planned = new Map<number, Set<string>>(); // refs attribuées par ce plan
  const refsOf = (a: ArretGeo) => new Set([...(a.gtfsRefs ?? []), ...(planned.get(a.id) ?? [])]);
  const plan = (a: ArretGeo, stopId: string) => planned.set(a.id, new Set([...(planned.get(a.id) ?? []), stopId]));
  const matchedLinked = new Set<number>();
  const linkedIds = new Set(linked.map((a) => a.id));
  const item = (stop: GtfsStop, action: PlanAction, arret: ArretGeo | null, extra: Partial<PlanItem> = {}): PlanItem => ({
    stop,
    action,
    arret,
    by: null,
    refKnown: false,
    groupe: null,
    groupeStopId: null,
    ...extra,
  });

  const nearest = (stop: GtfsStop, list: ArretGeo[], ok: (d: number, a: ArretGeo) => boolean) => {
    let best: ArretGeo | null = null;
    let bestD = Infinity;
    for (const a of list) {
      const d = distanceMeters(stop, a);
      if (d < bestD && ok(d, a)) {
        best = a;
        bestD = d;
      }
    }
    return best;
  };

  // --- 1. Chaque arrêt GTFS face aux arrêts existants ---
  const items: PlanItem[] = stops.map((stop) => {
    // a. arrêt de la ligne déjà suivi sous ce stop_id
    const served = linked.find((a) => !matchedLinked.has(a.id) && a.gtfsRefs?.includes(stop.id));
    if (served) {
      matchedLinked.add(served.id);
      plan(served, stop.id);
      return item(stop, "served", served, { by: "id" });
    }
    // b. un arrêt du catalogue porte déjà cette ref (arrêt partagé avec une autre ligne du même GTFS)
    const known = nearest(stop, catalog.filter(compat), (d, a) => !!a.gtfsRefs?.includes(stop.id) && d <= MATCH_SAME_REF_METERS);
    if (known) {
      if (linkedIds.has(known.id)) matchedLinked.add(known.id);
      return item(stop, "adopt", known, { by: "id", refKnown: true });
    }
    // c. politique de proximité : le plus proche qui satisfait 50 m, ou 100 m avec le même nom
    const x = nearest(
      stop,
      catalog.filter(compat),
      (d, a) => d <= MATCH_EXISTING_METERS || (d <= MATCH_EXISTING_SAME_NAME_METERS && sameName(stop.nom, a.nom)),
    );
    if (!x) return item(stop, "create", null);
    const refs = refsOf(x);
    if (refs.size === 0 || refs.has(stop.id)) {
      if (linkedIds.has(x.id)) matchedLinked.add(x.id);
      plan(x, stop.id);
      return item(stop, "adopt", x, { by: "proximite", refKnown: refs.has(stop.id) });
    }
    return item(stop, "group", x);
  });

  // --- 2. Arrêts du GTFS entre eux : station parente, sinon même nom à ≤ 200 m ---
  const root = items.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i]!)));
  const union = (i: number, j: number) => void (root[find(i)] = find(j));
  const anchored = (it: PlanItem) => it.arret !== null;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      if (a.stop.parentId && a.stop.parentId === b.stop.parentId) union(i, j);
      else if (
        !(anchored(a) && anchored(b)) &&
        sameName(a.stop.nom, b.stop.nom) &&
        distanceMeters(a.stop, b.stop) <= MATCH_INTERNAL_METERS &&
        !consecutive?.has(pairKey(a.stop.id, b.stop.id))
      )
        union(i, j);
    }
  }
  const clusters = new Map<number, number[]>();
  items.forEach((_, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), i]));
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const its = members.map((i) => items[i]!);
    const parents = new Set(its.map((it) => it.stop.parentId));
    const stationId = parents.size === 1 ? [...parents][0] ?? null : null;
    const anchor = its.find(anchored)?.arret ?? null;
    const creates = its.filter((it) => !anchored(it));
    if (anchor) {
      for (const it of creates) {
        it.action = "group";
        it.arret = anchor;
      }
      for (const it of its) if (it.action === "group") it.groupeStopId = stationId;
    } else if (creates.length >= 2) {
      const key = `g:${creates[0]!.stop.id}`;
      for (const it of creates) {
        it.groupe = key;
        it.groupeStopId = stationId;
      }
    }
  }

  return { items, removed: linked.filter((a) => !matchedLinked.has(a.id)) };
}

export interface GtfsDiff {
  /** Arrêts GTFS déjà liés à la ligne (par stop_id mémorisé, sinon par proximité). */
  served: Array<{ stop: GtfsStop; arret: ArretGeo; by: "id" | "proximite" }>;
  /** Arrêts GTFS non liés : à lier à un arrêt existant (`arret`), ou à créer (`arret: null`, éventuellement regroupé : cf. `item`). */
  added: Array<{ stop: GtfsStop; arret: ArretGeo | null; item: PlanItem }>;
  /** Arrêts liés à la ligne mais absents du GTFS. */
  removed: ArretGeo[];
}

/** Aperçu d'une mise à jour : le plan d'import ventilé en « toujours desservis », « nouveaux » et « absents ». */
export function compareGtfsStops(
  stops: GtfsStop[],
  linked: ArretGeo[],
  catalog: ArretGeo[],
  options: { stopTypes?: string[]; consecutive?: Set<string> } = {},
): GtfsDiff {
  const { items, removed } = planGtfsStops(stops, { linked, catalog, ...options });
  const linkedIds = new Set(linked.map((a) => a.id));
  const served: GtfsDiff["served"] = [];
  const added: GtfsDiff["added"] = [];
  for (const it of items) {
    if ((it.action === "served" || it.action === "adopt") && it.arret && linkedIds.has(it.arret.id)) {
      served.push({ stop: it.stop, arret: it.arret, by: it.by ?? "proximite" });
    } else {
      added.push({ stop: it.stop, arret: it.action === "adopt" ? it.arret : null, item: it });
    }
  }
  return { served, added, removed };
}

/** Ce que deviendra l'arrêt GTFS (popup de suggestion, aperçu de mise à jour). */
export function describePlanItem(it: PlanItem): string {
  const nom = it.arret?.nom ?? "";
  switch (it.action) {
    case "served":
      return `Arrêt existant : ${nom} (déjà suivi)`;
    case "adopt":
      return `Arrêt existant : ${nom}`;
    case "group":
      return `Nouvel arrêt, regroupé avec « ${nom} »`;
    default:
      return it.groupe ? "Nouvel arrêt, regroupé avec les arrêts voisins du GTFS" : "Nouvel arrêt (créé à l'envoi)";
  }
}

/** Champs de regroupement d'un nouvel arrêt, tels qu'attendus par `api/add_ligne.php` (`nouveaux_arrets[]`). */
export function nouvelArretExtra(it: PlanItem): Record<string, string | number> {
  const extra: Record<string, string | number> = {};
  if (it.action === "group" && it.arret) extra.regrouper_avec = it.arret.id;
  if (it.action === "create" && it.groupe) extra.groupe = it.groupe;
  if ((it.action === "group" || it.action === "create") && it.groupeStopId) extra.groupe_stop_id = it.groupeStopId;
  return extra;
}
