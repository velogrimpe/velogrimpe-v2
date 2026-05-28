#!/usr/bin/env python3
"""
Extrait les gares ferroviaires des GTFS téléchargés, puis calcule la matrice
gare-à-gare (durée + nombre de correspondances) via l'API /api/v5/plan de Motis.

Pré-requis : `setup.sh` a tourné, et `motis server` écoute sur localhost:8080.

Usage :
    python3 matrix.py                       # full France (~3000 gares, ~9M paires)
    python3 matrix.py --stations 50         # smoke test
    python3 matrix.py --time 2026-10-13T08:00:00+02:00
    python3 matrix.py --concurrency 60 --max-transfers 3
    python3 matrix.py --restart             # ignore matrix.csv existant, repart de zéro

Reprise :
    Le script est résumable. Chaque paire tentée est écrite dans matrix.csv
    (avec duration_s/transfers vides quand aucun trajet n'est trouvé). Au
    relancement, les paires déjà présentes sont sautées. Ctrl-C est intercepté :
    le script flush et sort proprement → on relance, ça reprend là où ça s'était
    arrêté.

    ⚠ Changer --max-transfers ou --max-travel-minutes en cours de matrice
    laisse les paires déjà écrites avec l'ancien filtre. Utiliser --restart
    pour repartir avec de nouveaux paramètres.

Sortie :
    $MOTIS_DIR/stations.csv  liste des gares (id, name, lat, lon, source)
    $MOTIS_DIR/matrix.csv    from_id,to_id,from_name,to_name,duration_s,transfers
                             duration_s/transfers vides = pas de trajet trouvé
                             ou élagué par --max-travel-minutes
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import os
import signal
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# GTFS route_type rail : 2 (legacy) + 100-117 (Extended Route Types européens)
# Réf : https://developers.google.com/transit/gtfs/reference/extended-route-types
RAIL_ROUTE_TYPES = {2} | set(range(100, 118))


# ─── Args ────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    default_dir = os.environ.get("MOTIS_DIR", str(Path.home() / "dev" / "motis-fr"))
    p.add_argument("--motis-dir", default=default_dir, help="Dossier de travail motis")
    p.add_argument("--motis-url", default=os.environ.get("MOTIS_URL", "http://localhost:8080"))
    p.add_argument("--stations", type=int, default=0,
                   help="Limite N gares (0 = toutes). Utile pour un smoke test.")
    p.add_argument("--time", default="2026-10-13T08:00:00+02:00",
                   help="Heure de référence (ISO 8601). Mardi 8h en octobre par défaut.")
    p.add_argument("--max-transfers", type=int, default=3)
    p.add_argument("--max-travel-minutes", type=int, default=480,
                   help="Élague les trajets > N minutes (def: 480 = 8h)")
    p.add_argument("--concurrency", type=int, default=40)
    p.add_argument("--out", default=None, help="Chemin de sortie CSV (def: $MOTIS_DIR/matrix.csv)")
    p.add_argument("--restart", action="store_true",
                   help="Supprime matrix.csv existant et repart de zéro (sinon : reprise auto)")
    return p.parse_args()


# ─── Resume : load des paires déjà traitées ─────────────────────────────────

def load_done_set(out_path: Path) -> set[tuple[str, str]]:
    """Lit matrix.csv existant et retourne {(from_id, to_id), ...}."""
    if not out_path.exists() or out_path.stat().st_size == 0:
        return set()
    done: set[tuple[str, str]] = set()
    with open(out_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        try:
            first = next(reader)
        except StopIteration:
            return done
        has_header = bool(first) and first[0] == "from_id"
        if not has_header and len(first) >= 2:
            done.add((first[0], first[1]))
        for row in reader:
            if len(row) >= 2:
                done.add((row[0], row[1]))
    return done


# ─── Extraction des gares ferroviaires ──────────────────────────────────────

def _open_csv(zf: zipfile.ZipFile, name: str):
    return io.TextIOWrapper(zf.open(name), encoding="utf-8-sig", errors="replace", newline="")


def extract_rail_stations(gtfs_dir: Path) -> list[dict]:
    """Renvoie [{id, name, lat, lon, source}, ...] dédupliqué par (nom, ~500m)."""
    stations: dict[tuple, dict] = {}

    for zip_path in sorted(gtfs_dir.glob("*.zip")):
        try:
            with zipfile.ZipFile(zip_path) as zf:
                names = set(zf.namelist())
                required = {"routes.txt", "trips.txt", "stop_times.txt", "stops.txt"}
                if not required.issubset(names):
                    continue

                # 1. routes rail
                with _open_csv(zf, "routes.txt") as f:
                    rail_route_ids = set()
                    for r in csv.DictReader(f):
                        rt = (r.get("route_type") or "").strip()
                        if rt.isdigit() and int(rt) in RAIL_ROUTE_TYPES:
                            rail_route_ids.add(r["route_id"])
                if not rail_route_ids:
                    continue

                # 2. trips rail
                with _open_csv(zf, "trips.txt") as f:
                    rail_trip_ids = {
                        t["trip_id"] for t in csv.DictReader(f)
                        if t.get("route_id") in rail_route_ids
                    }
                if not rail_trip_ids:
                    continue

                # 3. stop_ids touchés par les trips rail (stream)
                rail_stop_ids: set[str] = set()
                with _open_csv(zf, "stop_times.txt") as f:
                    for st in csv.DictReader(f):
                        if st.get("trip_id") in rail_trip_ids:
                            sid = st.get("stop_id")
                            if sid:
                                rail_stop_ids.add(sid)
                if not rail_stop_ids:
                    continue

                # 4. stops + résolution parent_station
                with _open_csv(zf, "stops.txt") as f:
                    stop_by_id = {s["stop_id"]: s for s in csv.DictReader(f)}

                kept: set[str] = set()
                for sid in rail_stop_ids:
                    s = stop_by_id.get(sid)
                    if not s:
                        continue
                    parent = (s.get("parent_station") or "").strip()
                    if parent and parent in stop_by_id:
                        kept.add(parent)
                    else:
                        kept.add(sid)

                feed_name = zip_path.stem
                for sid in kept:
                    s = stop_by_id[sid]
                    name = (s.get("stop_name") or "").strip()
                    if not name:
                        continue
                    try:
                        lat = float(s["stop_lat"])
                        lon = float(s["stop_lon"])
                    except (KeyError, ValueError, TypeError):
                        continue
                    # Clé de dédup : nom normalisé + grille ~500m
                    key = (name.lower(), round(lat * 200) / 200, round(lon * 200) / 200)
                    stations.setdefault(key, {
                        "id": f"{feed_name}:{sid}",
                        "name": name,
                        "lat": lat,
                        "lon": lon,
                        "source": feed_name,
                    })
        except (zipfile.BadZipFile, KeyError, UnicodeDecodeError) as e:
            print(f"  skip {zip_path.name}: {e}", file=sys.stderr)
            continue

    return list(stations.values())


# ─── Appels /plan ────────────────────────────────────────────────────────────

def do_plan(motis_url: str, t_iso: str, o_lat: float, o_lon: float,
            d_lat: float, d_lon: float, max_transfers: int) -> tuple[int, int] | None:
    """Appelle /api/v5/plan une fois (avec retry). Renvoie (duration_s, transfers) ou None."""
    params = {
        "fromPlace": f"{o_lat},{o_lon}",
        "toPlace":   f"{d_lat},{d_lon}",
        "time":      t_iso,
        "transitModes": "RAIL",
        "maxTransfers": str(max_transfers),
        "numItineraries": "1",
    }
    url = f"{motis_url}/api/v5/plan?{urllib.parse.urlencode(params)}"

    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            itins = data.get("itineraries") or []
            if not itins:
                return None
            it = itins[0]
            duration = int(it.get("duration") or 0)
            legs = it.get("legs") or []
            transit_legs = [leg for leg in legs if (leg.get("mode") or "WALK") != "WALK"]
            if not transit_legs:
                return None
            transfers = max(0, len(transit_legs) - 1)
            return duration, transfers
        except Exception:
            if attempt == 2:
                return None
            time.sleep(0.3 * (attempt + 1))
    return None


# ─── Boucle matricielle ──────────────────────────────────────────────────────

async def compute_matrix(stations: list[dict], motis_url: str, t_iso: str,
                         max_transfers: int, max_travel_s: int,
                         concurrency: int, out_path: Path,
                         done_set: set[tuple[str, str]]) -> None:
    loop = asyncio.get_running_loop()
    executor = ThreadPoolExecutor(max_workers=concurrency)

    # ─── Signal handling : Ctrl-C / SIGTERM → arrêt propre ───────────────────
    stop_flag = asyncio.Event()

    def request_stop():
        if not stop_flag.is_set():
            print("\n→ Arrêt demandé — flush en cours, patience "
                  "(jusqu'à 30s pour les requêtes en vol)…", file=sys.stderr)
        stop_flag.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, request_stop)
        except (NotImplementedError, RuntimeError):
            pass  # Windows, ou contexte sans event loop signal support

    n = len(stations)
    total = n * (n - 1)
    todo = total - len(done_set)

    if todo == 0:
        print("→ Rien à faire — toutes les paires sont déjà dans matrix.csv",
              file=sys.stderr)
        executor.shutdown(wait=False)
        return

    # Append mode pour préserver les paires déjà écrites
    file_existed = out_path.exists() and out_path.stat().st_size > 0
    out_f = open(out_path, "a", newline="", encoding="utf-8")
    writer = csv.writer(out_f)
    if not file_existed:
        writer.writerow(["from_id", "to_id", "from_name", "to_name", "duration_s", "transfers"])
        out_f.flush()

    done = 0
    found = 0
    start = time.monotonic()
    queue: asyncio.Queue = asyncio.Queue(maxsize=concurrency * 4)

    async def producer():
        try:
            for i in range(n):
                if stop_flag.is_set():
                    return
                for j in range(n):
                    if i == j:
                        continue
                    if stop_flag.is_set():
                        return
                    key = (stations[i]["id"], stations[j]["id"])
                    if key in done_set:
                        continue
                    await queue.put((i, j))
        finally:
            # Toujours envoyer les sentinelles — même sur stop — pour que les
            # consumers sortent de leur await queue.get().
            for _ in range(concurrency):
                await queue.put(None)

    async def consumer():
        nonlocal done, found
        while True:
            item = await queue.get()
            if item is None:
                return
            i, j = item
            o, d = stations[i], stations[j]
            res = await loop.run_in_executor(
                executor, do_plan,
                motis_url, t_iso, o["lat"], o["lon"], d["lat"], d["lon"], max_transfers,
            )
            done += 1
            # Toujours écrire une ligne — vide si pas de trajet ou élagué.
            # Permet la reprise sans retenter les "no route".
            if res is not None and res[0] <= max_travel_s:
                duration, transfers = res
                writer.writerow([o["id"], d["id"], o["name"], d["name"], duration, transfers])
                found += 1
            else:
                writer.writerow([o["id"], d["id"], o["name"], d["name"], "", ""])

            if done % 1000 == 0:
                elapsed = time.monotonic() - start
                rate = done / elapsed if elapsed else 0
                eta = (todo - done) / rate if rate else 0
                print(f"  {done:,}/{todo:,} ({100*done/todo:.1f}%) — "
                      f"{found:,} routes — {rate:.0f}/s — ETA {eta/60:.0f} min",
                      file=sys.stderr)
                out_f.flush()

    try:
        consumers = [asyncio.create_task(consumer()) for _ in range(concurrency)]
        await producer()
        await asyncio.gather(*consumers)
    finally:
        out_f.flush()
        out_f.close()
        executor.shutdown(wait=False)

    elapsed = time.monotonic() - start
    if stop_flag.is_set():
        print(f"⚠ Interrompu après {done:,}/{todo:,} paires "
              f"({elapsed/60:.1f} min, {found:,} nouvelles routes). "
              f"Relance le même script pour reprendre.", file=sys.stderr)
        sys.exit(130)
    else:
        print(f"✓ {found:,} nouvelles routes / {done:,} paires en "
              f"{elapsed/60:.1f} min → {out_path}", file=sys.stderr)


# ─── main ────────────────────────────────────────────────────────────────────

def main() -> int:
    args = parse_args()
    motis_dir = Path(args.motis_dir).expanduser()
    gtfs_dir = motis_dir / "gtfs"
    out_path = Path(args.out).expanduser() if args.out else motis_dir / "matrix.csv"

    if not gtfs_dir.is_dir():
        print(f"FAIL: pas de dossier GTFS à {gtfs_dir} — lance setup.sh d'abord", file=sys.stderr)
        return 1

    if args.restart and out_path.exists():
        print(f"→ --restart : suppression de {out_path}", file=sys.stderr)
        out_path.unlink()

    print(f"→ Extraction des gares ferroviaires depuis {gtfs_dir}", file=sys.stderr)
    stations = extract_rail_stations(gtfs_dir)
    stations.sort(key=lambda s: (s["name"], s["id"]))
    print(f"  {len(stations)} gares après dédup", file=sys.stderr)

    if args.stations and args.stations < len(stations):
        stations = stations[:args.stations]
        print(f"  ↳ limité à {len(stations)}", file=sys.stderr)

    stations_csv = motis_dir / "stations.csv"
    with open(stations_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "lat", "lon", "source"])
        for s in stations:
            w.writerow([s["id"], s["name"], s["lat"], s["lon"], s["source"]])
    print(f"  → {stations_csv}", file=sys.stderr)

    # Probe serveur
    try:
        with urllib.request.urlopen(f"{args.motis_url}/", timeout=5) as r:
            r.read(200)
    except Exception as e:
        print(f"FAIL: motis server injoignable sur {args.motis_url} ({e})", file=sys.stderr)
        print(f"      lance : cd {motis_dir} && ./motis server", file=sys.stderr)
        return 2

    n = len(stations)
    total_pairs = n * (n - 1)

    # ─── Reprise : charge les paires déjà écrites ──────────────────────────
    done_set: set[tuple[str, str]] = set()
    if out_path.exists():
        print(f"→ Lecture de {out_path.name} pour reprise…", file=sys.stderr)
        done_set = load_done_set(out_path)
        if done_set:
            pct = 100 * len(done_set) / total_pairs if total_pairs else 0
            print(f"  {len(done_set):,} paires déjà traitées "
                  f"({pct:.1f}%) — reprise auto", file=sys.stderr)

    print(f"→ Calcul matrice {n}×{n} = {total_pairs:,} paires "
          f"(restant : {total_pairs - len(done_set):,})", file=sys.stderr)
    print(f"  motis        : {args.motis_url}", file=sys.stderr)
    print(f"  time         : {args.time}", file=sys.stderr)
    print(f"  maxTransfers : {args.max_transfers}", file=sys.stderr)
    print(f"  maxTravel    : {args.max_travel_minutes} min", file=sys.stderr)
    print(f"  concurrency  : {args.concurrency}", file=sys.stderr)
    print(f"  out          : {out_path}", file=sys.stderr)

    asyncio.run(compute_matrix(
        stations,
        args.motis_url,
        args.time,
        args.max_transfers,
        args.max_travel_minutes * 60,
        args.concurrency,
        out_path,
        done_set,
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
