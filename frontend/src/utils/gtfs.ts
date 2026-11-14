import { strFromU8, unzipSync } from "fflate";

/** Taille maximale du zip GTFS importé (l'analyse se fait dans le navigateur). */
export const MAX_GTFS_ZIP_BYTES = 200 * 1024 * 1024;

export type MultiLineString = {
  type: "MultiLineString";
  coordinates: number[][][];
};

export interface GtfsFeed {
  agencies: Record<string, string>[];
  routes: Record<string, string>[];
  trips: Record<string, string>[];
  stops: Record<string, string>[];
  /** Contenu brut de stop_times.txt (très volumineux sur les grands réseaux : analysé à la demande), null si absent. */
  stopTimesText: string | null;
  /** Contenu brut de shapes.txt (volumineux : analysé à la demande), null si absent. */
  shapesText: string | null;
}

export interface GtfsStop {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  /** `stop_id` de la station parente (`parent_station`), null pour un arrêt sans parent. */
  parentId: string | null;
}

/** Clé d'une paire d'arrêts, indépendante du sens (`a|b` avec a ≤ b). */
export const pairKey = (a: string, b: string) => (a <= b ? `${a}|${b}` : `${b}|${a}`);

export type Modalite = "ter" | "tgv" | "bus" | "tram" | "telepherique";

export interface GtfsRoute {
  id: string;
  agencyId: string;
  numero: string | null;
  nom: string;
  couleur: string | null;
  routeType: string;
  shapeIds: string[];
  tripCount: number;
}

/** Champs du formulaire ligne alimentés par une route GTFS. */
export interface LigneFields {
  nom: string;
  numero: string | null;
  operateur: string | null;
  operateur_url: string | null;
  horaire_url: string | null;
  ref: string;
  couleur: string | null;
}

/** CSV GTFS → lignes indexées par en-tête (BOM, guillemets, CRLF, lignes vides gérés). */
export function parseCsv(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const endRow = () => {
    row.push(field);
    field = "";
    // ligne totalement vide (un seul champ vide) : ignorée
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") endRow();
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) endRow();

  const header = rows.shift();
  if (!header) return [];
  return rows.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

const WANTED = [
  "agency.txt",
  "routes.txt",
  "trips.txt",
  "shapes.txt",
  "stops.txt",
  "stop_times.txt",
];

/** Dézippe un GTFS et lit les fichiers utiles à l'import d'une ligne. */
export function readGtfs(zip: Uint8Array): GtfsFeed {
  const files = unzipSync(zip, {
    filter: (f) => WANTED.includes(f.name.split("/").pop() ?? ""),
  });
  const text: Record<string, string> = {};
  for (const [name, data] of Object.entries(files))
    text[name.split("/").pop()!] = strFromU8(data);

  if (!text["routes.txt"])
    throw new Error("GTFS invalide : routes.txt introuvable dans le zip");
  return {
    agencies: parseCsv(text["agency.txt"] ?? ""),
    routes: parseCsv(text["routes.txt"]),
    trips: parseCsv(text["trips.txt"] ?? ""),
    stops: parseCsv(text["stops.txt"] ?? ""),
    stopTimesText: text["stop_times.txt"] ?? null,
    shapesText: text["shapes.txt"] ?? null,
  };
}

/** Lignes de routes.txt, avec leurs shape_id déduits de trips.txt. */
export function listRoutes(feed: GtfsFeed): GtfsRoute[] {
  const shapesByRoute = new Map<string, Set<string>>();
  const tripCount = new Map<string, number>();
  for (const t of feed.trips) {
    tripCount.set(t.route_id!, (tripCount.get(t.route_id!) ?? 0) + 1);
    if (!t.shape_id) continue;
    if (!shapesByRoute.has(t.route_id!))
      shapesByRoute.set(t.route_id!, new Set());
    shapesByRoute.get(t.route_id!)!.add(t.shape_id);
  }
  return feed.routes.map((r) => ({
    id: r.route_id!,
    agencyId: r.agency_id ?? "",
    numero: r.route_short_name || null,
    nom: r.route_long_name || r.route_short_name || r.route_id!,
    couleur: r.route_color ? "#" + r.route_color.replace(/^#/, "") : null,
    routeType: r.route_type ?? "",
    shapeIds: [...(shapesByRoute.get(r.route_id!) ?? [])],
    tripCount: tripCount.get(r.route_id!) ?? 0,
  }));
}

/** Précision des coordonnées stockées : 5 décimales ≈ 1 m. */
const COORD_DECIMALS = 5;
/** Tolérance de simplification (degrés, ≈ 3 m) : invisible à l'écran, divise la taille par ~10. */
const SIMPLIFY_TOLERANCE_DEG = 0.00003;

/** Douglas-Peucker itératif (les shapes GTFS peuvent compter des dizaines de milliers de points). */
export function simplifyLine(
  pts: number[][],
  tolerance = SIMPLIFY_TOLERANCE_DEG,
): number[][] {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a]!;
    const [bx, by] = pts[b]!;
    const dx = bx! - ax!;
    const dy = by! - ay!;
    const len2 = dx * dx + dy * dy;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!;
      let t = len2 ? ((px! - ax!) * dx + (py! - ay!) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px! - (ax! + t * dx), py! - (ay! + t * dy));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tolerance) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function roundCoord(n: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(n * f) / f;
}

/**
 * shapes.txt → MultiLineString GeoJSON ([lng, lat]), une ligne par shape_id,
 * points ordonnés par shape_pt_sequence, formes géométriquement identiques
 * dédoublonnées, coordonnées arrondies et tracé simplifié (sinon la requête
 * dépasse max_allowed_packet de MySQL). Sans `shapeIds`, toutes les formes du fichier.
 */
export function shapesToMultiLineString(
  shapesText: string | null,
  shapeIds?: string[],
): MultiLineString | null {
  if (!shapesText) return null;
  const wanted = shapeIds ? new Set(shapeIds) : null;
  const byShape = new Map<string, { seq: number; pt: number[] }[]>();
  for (const r of parseCsv(shapesText)) {
    const id = r.shape_id!;
    if (wanted && !wanted.has(id)) continue;
    if (!byShape.has(id)) byShape.set(id, []);
    byShape
      .get(id)!
      .push({
        seq: Number(r.shape_pt_sequence),
        pt: [Number(r.shape_pt_lon), Number(r.shape_pt_lat)],
      });
  }
  const seen = new Set<string>();
  const lines: number[][][] = [];
  for (const pts of byShape.values()) {
    if (pts.length < 2) continue;
    const line = simplifyLine(
      pts
        .sort((a, b) => a.seq - b.seq)
        .map((p) => [roundCoord(p.pt[0]!), roundCoord(p.pt[1]!)]),
    );
    if (line.length < 2) continue;
    const key = JSON.stringify(line);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines.length ? { type: "MultiLineString", coordinates: lines } : null;
}

export function agencyForRoute(
  feed: GtfsFeed,
  route: GtfsRoute,
): { operateur: string; operateur_url: string | null } | null {
  const agency =
    feed.agencies.find(
      (a) => route.agencyId && a.agency_id === route.agencyId,
    ) ?? (feed.agencies.length === 1 ? feed.agencies[0] : undefined);
  if (!agency) return null;
  return {
    operateur: agency.agency_name ?? "",
    operateur_url: agency.agency_url || null,
  };
}

export function routeToLigneFields(
  feed: GtfsFeed,
  route: GtfsRoute,
): LigneFields {
  const agency = agencyForRoute(feed, route);
  const raw = feed.routes.find((r) => r.route_id === route.id);
  return {
    nom: route.nom,
    numero: route.numero,
    operateur: agency?.operateur || null,
    operateur_url: agency?.operateur_url ?? null,
    horaire_url: raw?.route_url || null,
    ref: route.id,
    couleur: route.couleur,
  };
}

/** Arrêts de chaque trajet de la ligne (trips.txt → stop_times.txt), dans l'ordre de `stop_sequence`. */
function routeTrips(feed: GtfsFeed, route: GtfsRoute): string[][] {
  if (!feed.stopTimesText || !feed.stops.length) return [];
  const tripIds = new Set(
    feed.trips.filter((t) => t.route_id === route.id).map((t) => t.trip_id),
  );
  if (!tripIds.size) return [];
  const byTrip = new Map<string, { seq: number; stop: string }[]>();
  for (const r of parseCsv(feed.stopTimesText)) {
    if (!tripIds.has(r.trip_id!)) continue;
    if (!byTrip.has(r.trip_id!)) byTrip.set(r.trip_id!, []);
    byTrip
      .get(r.trip_id!)!
      .push({ seq: Number(r.stop_sequence), stop: r.stop_id! });
  }
  return [...byTrip.values()].map((rows) =>
    rows.sort((a, b) => a.seq - b.seq).map((r) => r.stop),
  );
}

/**
 * Arrêts desservis par une ligne (trips.txt → stop_times.txt → stops.txt) : un arrêt GTFS par `stop_id`
 * (les quais / sens d'une même station restent distincts, avec leur `parentId`), dans l'ordre de première
 * desserte le long des trajets. Un arrêt sans nom prend celui de sa station parente.
 */
export function listRouteStops(feed: GtfsFeed, route: GtfsRoute): GtfsStop[] {
  const trips = routeTrips(feed, route);
  const stopsById = new Map(feed.stops.map((s) => [s.stop_id!, s]));
  const seen = new Set<string>();
  const result: GtfsStop[] = [];
  for (const stops of trips) {
    for (const id of stops) {
      const raw = stopsById.get(id);
      if (!raw || seen.has(id)) continue;
      const lat = Number(raw.stop_lat);
      const lng = Number(raw.stop_lon);
      if (!raw.stop_lat || !raw.stop_lon || isNaN(lat) || isNaN(lng)) continue;
      const parentId = raw.parent_station || null;
      seen.add(id);
      result.push({
        id,
        nom: raw.stop_name || (parentId ? stopsById.get(parentId)?.stop_name : "") || "",
        lat,
        lng,
        parentId,
      });
    }
  }
  return result;
}

/** Paires d'arrêts consécutifs dans au moins un trajet de la ligne (clés `pairKey`) : jamais le même lieu. */
export function listRouteStopPairs(feed: GtfsFeed, route: GtfsRoute): Set<string> {
  const pairs = new Set<string>();
  for (const stops of routeTrips(feed, route)) {
    for (let i = 1; i < stops.length; i++) {
      if (stops[i - 1] !== stops[i]) pairs.add(pairKey(stops[i - 1]!, stops[i]!));
    }
  }
  return pairs;
}

/** Modalité(s) de la ligne d'après `route_type` (GTFS de base et étendu) ; bus par défaut. */
export function routeModalites(route: GtfsRoute): Modalite[] {
  const t = Number(route.routeType);
  if (route.routeType === "" || isNaN(t)) return ["bus"];
  if (
    t === 0 ||
    t === 1 ||
    t === 5 ||
    (t >= 900 && t < 1000) ||
    (t >= 400 && t < 500)
  )
    return ["tram"];
  if (t === 6 || t === 7 || (t >= 1300 && t < 1400)) return ["telepherique"];
  if (t === 2 || (t >= 100 && t < 200)) return ["ter"];
  return ["bus"];
}
