import type { GtfsStop } from "./gtfs";

/** Distance max (m) pour rapprocher un arrêt GTFS d'un arrêt existant (même seuil que le formulaire). */
export const MATCH_METERS = 100;

export interface ArretGeo {
  id: number;
  nom: string;
  lat: number;
  lng: number;
  /** ter / tgv / bus / tram / telepherique (absent : compatible avec tout). */
  types?: string[];
}

/** Famille de modalité : TER et TGV (gares) ne forment qu'une famille, les autres sont distinctes. */
const family = (t: string) => (t === "ter" || t === "tgv" ? "rail" : t);

/** Un arrêt existant ne peut être rapproché que d'un arrêt GTFS de même famille (bus ≠ gare TER). */
export function typesCompatibles(arretTypes: string[] | undefined, stopTypes: string[] | undefined): boolean {
  if (!arretTypes?.length || !stopTypes?.length) return true;
  const fams = new Set(stopTypes.map(family));
  return arretTypes.some((t) => fams.has(family(t)));
}

export interface GtfsDiff {
  /** Arrêts GTFS déjà liés à la ligne (par stop_id mémorisé, sinon par proximité). */
  served: Array<{ stop: GtfsStop; arret: ArretGeo; by: "id" | "proximite" }>;
  /** Arrêts GTFS non liés : à lier à un arrêt existant proche, ou à créer (`arret: null`). */
  added: Array<{ stop: GtfsStop; arret: ArretGeo | null }>;
  /** Arrêts liés à la ligne mais absents du GTFS. */
  removed: ArretGeo[];
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearest<T extends ArretGeo>(
  stop: GtfsStop,
  candidates: T[],
  maxMeters: number,
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = distanceMeters(stop, c);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return bestD <= maxMeters ? best : null;
}

/**
 * Compare les arrêts d'un GTFS rechargé avec ceux déjà liés à la ligne.
 * Ordre de rapprochement : stop_id mémorisé (`refs`) parmi les arrêts liés, puis proximité
 * parmi les arrêts liés restants, puis proximité parmi le reste du catalogue (arrêt à lier),
 * sinon nouvel arrêt. Seuls les arrêts de même famille de modalité que `stopTypes` sont rapprochables
 * (bus ≠ gare TER ; TER et TGV vont ensemble). Les arrêts liés jamais rapprochés sont « retirés ».
 */
export function compareGtfsStops(
  stops: GtfsStop[],
  linked: ArretGeo[],
  catalog: ArretGeo[],
  refs: Record<number, string[]>,
  maxMeters = MATCH_METERS,
  stopTypes?: string[],
): GtfsDiff {
  const compatibles = <T extends ArretGeo>(list: T[]) => list.filter((a) => typesCompatibles(a.types, stopTypes));
  const served: GtfsDiff["served"] = [];
  const added: GtfsDiff["added"] = [];
  const matched = new Set<number>();

  // 1. stop_id mémorisé
  const byRef = new Map<string, ArretGeo>();
  for (const a of linked) for (const r of refs[a.id] ?? []) byRef.set(r, a);
  const pending: GtfsStop[] = [];
  for (const stop of stops) {
    const a = byRef.get(stop.id);
    if (a && !matched.has(a.id)) {
      matched.add(a.id);
      served.push({ stop, arret: a, by: "id" });
    } else pending.push(stop);
  }

  // 2. proximité parmi les arrêts liés restants
  const stillPending: GtfsStop[] = [];
  for (const stop of pending) {
    const a = nearest(
      stop,
      compatibles(linked.filter((l) => !matched.has(l.id))),
      maxMeters,
    );
    if (a) {
      matched.add(a.id);
      served.push({ stop, arret: a, by: "proximite" });
    } else stillPending.push(stop);
  }

  // 3. proximité parmi les arrêts non liés, sinon nouvel arrêt
  const linkedIds = new Set(linked.map((l) => l.id));
  const unlinked = catalog.filter((c) => !linkedIds.has(c.id));
  // Deux arrêts GTFS proches (aller/retour) sans arrêt existant ne donnent qu'un seul arrêt à créer.
  const created: GtfsStop[] = [];
  for (const stop of stillPending) {
    const arret = nearest(stop, compatibles(unlinked), maxMeters);
    if (!arret) {
      if (created.some((c) => distanceMeters(stop, c) <= maxMeters)) continue;
      created.push(stop);
    }
    added.push({ stop, arret });
  }

  return { served, added, removed: linked.filter((l) => !matched.has(l.id)) };
}
