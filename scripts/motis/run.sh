#!/usr/bin/env bash
# Pipeline complet :
#   1. setup.sh (install motis + télécharge OSM + GTFS + import)
#   2. lance `motis server` en arrière-plan, attend qu'il réponde
#   3. lance matrix.py
#
# Tous les arguments passés à run.sh sont relayés à matrix.py.
# Ex :   ./run.sh --stations 50           # smoke test
#        ./run.sh --concurrency 60
#        ./run.sh                         # full ~9M paires

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MOTIS_DIR="${MOTIS_DIR:-$HOME/dev/motis-fr}"
MOTIS_URL="${MOTIS_URL:-http://localhost:8080}"

# ─── 1. Setup (idempotent) ───────────────────────────────────────────────────
bash "$HERE/setup.sh"

cd "$MOTIS_DIR"

# ─── 2. Serveur ──────────────────────────────────────────────────────────────
server_started_here=0
if ! curl -fsS "$MOTIS_URL/" >/dev/null 2>&1; then
  echo "→ motis server (background)..."
  nohup ./motis server > motis.server.log 2>&1 &
  echo $! > motis.server.pid
  server_started_here=1

  echo -n "  attente readiness"
  for i in $(seq 1 90); do
    if curl -fsS "$MOTIS_URL/" >/dev/null 2>&1; then
      echo " — OK"
      break
    fi
    echo -n "."
    sleep 2
  done

  if ! curl -fsS "$MOTIS_URL/" >/dev/null 2>&1; then
    echo
    echo "FAIL: motis server pas prêt après 3 min. Voir $MOTIS_DIR/motis.server.log" >&2
    exit 1
  fi
fi

cleanup() {
  if [ "$server_started_here" = "1" ] && [ -f "$MOTIS_DIR/motis.server.pid" ]; then
    pid="$(cat "$MOTIS_DIR/motis.server.pid")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "→ Arrêt du serveur motis (pid $pid)..."
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$MOTIS_DIR/motis.server.pid"
  fi
}
trap cleanup EXIT INT TERM

# ─── 3. Matrice ──────────────────────────────────────────────────────────────
echo "→ Calcul de la matrice (matrix.py)"
python3 "$HERE/matrix.py" --motis-dir "$MOTIS_DIR" --motis-url "$MOTIS_URL" "$@"
