#!/usr/bin/env bash
# Install Motis (macOS), download france.osm.pbf and tous les feeds GTFS rail
# du PAN, puis lance `motis config` + `motis import`.
#
# Idempotent : peut être relancé sans tout retélécharger.
#
# Variables d'environnement :
#   MOTIS_DIR       Dossier de travail              (def: $HOME/dev/motis-fr)
#   MOTIS_VERSION   Tag de release motis            (def: latest)
#   OSM_REGION      Région Geofabrik                (def: france)
#   GTFS_REFRESH    1 = re-télécharger les GTFS     (def: 0)

set -euo pipefail

MOTIS_DIR="${MOTIS_DIR:-$HOME/dev/motis-fr}"
MOTIS_VERSION="${MOTIS_VERSION:-latest}"
OSM_REGION="${OSM_REGION:-france}"
GTFS_REFRESH="${GTFS_REFRESH:-0}"

mkdir -p "$MOTIS_DIR"
cd "$MOTIS_DIR"

echo "→ Working dir: $MOTIS_DIR"

# ─── 1. Binaire motis ────────────────────────────────────────────────────────
if [ ! -x ./motis ]; then
  arch="$(uname -m)"
  case "$arch" in
    arm64|aarch64) arch_re='(arm64|aarch64)' ;;
    x86_64)        arch_re='(amd64|x86_64|x64)' ;;
    *) echo "Arch non supportée: $arch" >&2; exit 1 ;;
  esac

  if [ "$MOTIS_VERSION" = "latest" ]; then
    api_url="https://api.github.com/repos/motis-project/motis/releases/latest"
  else
    api_url="https://api.github.com/repos/motis-project/motis/releases/tags/$MOTIS_VERSION"
  fi

  echo "→ Résolution de l'asset macOS ($arch) sur $api_url"
  asset_url="$(curl -fsSL "$api_url" \
    | grep -oE '"browser_download_url"[^"]*"https://[^"]+"' \
    | sed -E 's/.*"(https:[^"]+)"$/\1/' \
    | grep -Ei '(darwin|macos|osx)' \
    | grep -Ei "$arch_re" \
    | grep -Ei '\.(tar\.gz|tar\.bz2|zip)$' \
    | head -1)"

  if [ -z "$asset_url" ]; then
    echo "FAIL: pas d'asset macOS $arch dans la release $MOTIS_VERSION" >&2
    echo "      vérifie https://github.com/motis-project/motis/releases" >&2
    exit 1
  fi

  echo "→ Téléchargement: $asset_url"
  case "$asset_url" in
    *.tar.gz)  curl -fL --retry 3 -o motis.archive "$asset_url"; tar xzf motis.archive ;;
    *.tar.bz2) curl -fL --retry 3 -o motis.archive "$asset_url"; tar xjf motis.archive ;;
    *.zip)     curl -fL --retry 3 -o motis.archive "$asset_url"; unzip -q motis.archive ;;
  esac
  rm -f motis.archive

  if [ ! -x ./motis ]; then
    found="$(find . -maxdepth 3 -type f -name motis | head -1)"
    if [ -n "$found" ]; then
      mv "$found" ./motis
    else
      echo "FAIL: binaire motis introuvable après extraction" >&2
      exit 1
    fi
  fi
  chmod +x ./motis
fi

echo -n "→ motis: "; ./motis --version || true

# ─── 2. OSM France ───────────────────────────────────────────────────────────
osm_file="$OSM_REGION-latest.osm.pbf"
if [ ! -f "$osm_file" ]; then
  case "$OSM_REGION" in
    france) osm_url="https://download.geofabrik.de/europe/france-latest.osm.pbf" ;;
    *)      osm_url="https://download.geofabrik.de/europe/$OSM_REGION-latest.osm.pbf" ;;
  esac
  echo "→ Téléchargement OSM ($OSM_REGION, ~5 Go pour france)..."
  curl -fL --retry 3 -o "$osm_file.tmp" "$osm_url"
  mv "$osm_file.tmp" "$osm_file"
fi
echo "→ OSM: $(du -h "$osm_file" | awk '{print $1}') ($osm_file)"

# ─── 3. GTFS depuis le PAN (tous les feeds rail) ─────────────────────────────
mkdir -p gtfs
feeds_list="gtfs/feeds.tsv"

if [ ! -f "$feeds_list" ] || [ "$GTFS_REFRESH" = "1" ]; then
  echo "→ Listing des feeds GTFS rail sur transport.data.gouv.fr..."
  # Heredoc cat → python3 -c pour éviter tout conflit de quoting bash/python.
  curl -fsSL 'https://transport.data.gouv.fr/api/datasets' \
    | python3 -c "$(cat <<'PY'
import json, re, sys

# Le PAN expose les modes au niveau de la ressource, pas du dataset.
# Vérifié 2026-05 : ~20 datasets GTFS contiennent rail dans resource.metadata.modes.
data = json.load(sys.stdin)
seen = set()
for ds in data:
    if ds.get("type") != "public-transit":
        continue
    for r in ds.get("resources", []) or []:
        if (r.get("format") or "").upper() != "GTFS":
            continue
        # modes peut être sur r["modes"] OU r["metadata"]["modes"]
        modes = r.get("modes") or (r.get("metadata") or {}).get("modes") or []
        modes_lower = [str(m).lower() for m in modes]
        if "rail" not in modes_lower:
            continue
        url = r.get("original_url") or r.get("url") or r.get("latest_url")
        if not url:
            continue
        rid = str(r.get("id") or r.get("datagouv_id") or "")
        slug = ds.get("slug") or ""
        name = f"{slug}__{rid}" if rid else slug
        name = re.sub(r"[^A-Za-z0-9_.-]+", "-", name).strip("-")[:120]
        if not name or name in seen:
            continue
        seen.add(name)
        modes_str = ",".join(modes)
        print(f"{name}\t{url}", file=sys.stdout)
        print(f"  - {slug} [{modes_str}]", file=sys.stderr)
PY
)" > "$feeds_list.tmp"
  mv "$feeds_list.tmp" "$feeds_list"
fi

n_feeds=$(wc -l < "$feeds_list" | tr -d ' ')
echo "→ $n_feeds feeds rail référencés"

# Téléchargement (skip si zip déjà valide)
while IFS=$'\t' read -r id url; do
  out="gtfs/$id.zip"
  if [ -f "$out" ] && unzip -tq "$out" >/dev/null 2>&1; then
    continue
  fi
  echo "  ↓ $id"
  if curl -fL --retry 2 --max-time 900 -o "$out.tmp" "$url" 2>/dev/null; then
    if unzip -tq "$out.tmp" >/dev/null 2>&1; then
      mv "$out.tmp" "$out"
    else
      echo "    BAD ZIP, skipping"
      rm -f "$out.tmp"
    fi
  else
    echo "    FAIL (auth requis ?) skipping"
    rm -f "$out.tmp"
  fi
done < "$feeds_list"

n_ok=$(find gtfs -maxdepth 1 -name '*.zip' | wc -l | tr -d ' ')
echo "→ $n_ok feeds téléchargés valides"

# ─── 4. config + import ──────────────────────────────────────────────────────
if [ ! -f config.yml ]; then
  echo "→ motis config..."
  zips=( gtfs/*.zip )
  if [ ${#zips[@]} -eq 0 ] || [ ! -f "${zips[0]}" ]; then
    echo "FAIL: aucun GTFS valide téléchargé" >&2
    exit 1
  fi
  ./motis config "$osm_file" "${zips[@]}"
fi

if [ ! -d data ]; then
  echo "→ motis import (~10-30 min)..."
  ./motis import
fi

echo "✓ Setup OK. Pour lancer le serveur : cd $MOTIS_DIR && ./motis server"
