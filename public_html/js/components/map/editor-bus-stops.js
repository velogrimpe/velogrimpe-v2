/**
 * Calque de tous les arrêts multimodaux (gares TER/TGV, bus, tram, téléphérique)
 * issus de la DB pour l'éditeur de détails falaise.
 *
 * - Affiche les arrêts existants : liés à la falaise (icône colorée par type) vs
 *   non liés (icône grisée, même symbole).
 * - Clic sur un arrêt non lié : « Cet arrêt est pertinent pour cette falaise » → Lier.
 * - Clic sur un arrêt lié : Délier.
 * - Recharge sur déplacement de carte (debouncé) ; les arrêts liés sont toujours inclus.
 *
 * @module editor-bus-stops
 */
import { arretDivIcon } from "/js/components/map/arret-icon.js";

const MIN_ZOOM = 11;
const ICON_SIZE = 26;
const UNLINKED_COLOR = "#9ca3af"; // gris

const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * @param {L.Map} map
 * @param {Object} opts
 * @param {number} opts.falaiseId
 * @param {function(): Promise<{nom:string,email:string}|null>} opts.ensureContrib
 *        Retourne les infos contributeur (en demandant via modal si besoin), ou null si annulé.
 * @returns {{ refresh: function, destroy: function }}
 */
export function initEditorBusStops(map, { falaiseId, ensureContrib }) {
  const layer = L.layerGroup().addTo(map);

  const buildPopup = (arret) => {
    const lignes =
      Array.isArray(arret.lignes) && arret.lignes.length
        ? `<div class="text-xs opacity-70">${escapeHtml(arret.lignes.join(", "))}</div>`
        : "";
    // arret.description est du HTML déjà assaini côté serveur (rt_sanitize_html).
    const desc = arret.description
      ? `<div class="text-sm">${arret.description}</div>`
      : "";
    const veloLink = `<a class="btn btn-xs btn-primary" target="_blank" rel="noopener"
            href="/ajout/ajout_velo.php?arret_id=${arret.id}&falaise_id=${falaiseId}">Ajouter un accès depuis cet arrêt</a>`;

    // Compléter l'accès à pied existant (description, km, D+, D-, GPX) : formulaire dédié,
    // qui ne renseigne que les champs encore vides.
    const detailLink = `<a class="btn btn-xs btn-outline btn-primary" target="_blank" rel="noopener"
            href="/ajout/ajout_velo.php?mode=pied&arret_id=${arret.id}&falaise_id=${falaiseId}">Détailler l'accès à pied</a>`;
    // Détails facultatifs envoyés avec le lien (lus dans doLink)
    const detailsFields = `
        <details class="text-xs" data-testid="acces-details">
          <summary class="cursor-pointer text-primary">Détails de l'accès à pied (optionnel)</summary>
          <div class="flex flex-col gap-1 mt-1">
            <textarea class="acces-description textarea textarea-xs w-full" rows="2" placeholder="Description : durée, sentier, passages délicats…"></textarea>
            <div class="flex gap-1">
              <input class="acces-km input input-xs w-16" type="number" step="0.1" min="0" placeholder="km" aria-label="Distance (km)">
              <input class="acces-dplus input input-xs w-16" type="number" min="0" placeholder="D+" aria-label="D+ (m)">
              <input class="acces-dmoins input input-xs w-16" type="number" min="0" placeholder="D-" aria-label="D- (m)">
            </div>
            <input class="acces-gpx file-input file-input-xs w-full" type="file" accept=".gpx" aria-label="Trace GPS (optionnel)">
          </div>
        </details>`;

    if (arret.linked) {
      return `
        <div class="flex flex-col gap-2 w-[260px]">
          <div class="font-bold">${escapeHtml(arret.nom)} <span class="badge badge-success badge-xs">lié</span></div>
          ${lignes}
          ${desc}
          ${detailLink}
          <button class="btn btn-xs btn-error unlink-bus-btn" type="button">Délier de cette falaise</button>
          ${veloLink}
        </div>`;
    }
    return `
      <div class="flex flex-col gap-2 w-[260px]">
        <div class="font-bold">${escapeHtml(arret.nom)}</div>
        ${lignes}
        ${desc}
        <div class="text-sm font-semibold mt-1">Cet arrêt est pertinent pour cette falaise ?</div>
        <div class="text-xs opacity-70">Pertinent = accessible à pied ou à vélo depuis la falaise, et le vélo est transportable dans le bus qui dessert cet arrêt.</div>
        ${detailsFields}
        <button class="btn btn-xs btn-primary link-bus-btn" type="button">Lier cet arrêt à la falaise</button>
        ${veloLink}
      </div>`;
  };

  const doLink = async (arret, action, root = null) => {
    const contrib = await ensureContrib();
    if (!contrib) return;
    try {
      const base = {
        arret_id: arret.id,
        falaise_id: falaiseId,
        action,
        nom_prenom: contrib.nom,
        email: contrib.email,
      };
      // Détails facultatifs de l'accès à pied (uniquement pour « lier »)
      const champ = (cls) => root?.querySelector?.(`.${cls}`)?.value?.trim() ?? "";
      const details = action === "link"
        ? { description: champ("acces-description"), km: champ("acces-km"), dplus: champ("acces-dplus"), dmoins: champ("acces-dmoins") }
        : {};
      const gpx = action === "link" ? root?.querySelector?.(".acces-gpx")?.files?.[0] : null;
      let init;
      if (gpx) {
        // Avec une trace GPX : multipart (le JSON ne peut pas porter de fichier)
        const fd = new FormData();
        Object.entries({ ...base, ...details }).forEach(([k, v]) => fd.append(k, v));
        fd.append("gpx_file", gpx);
        init = { method: "POST", body: fd };
      } else {
        init = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, ...details }),
        };
      }
      const res = await fetch("/api/link_arret_falaise.php", init);
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        alert("Erreur : " + (result.error || res.status));
        return;
      }
      map.closePopup();
      await refresh();
    } catch (e) {
      alert("Erreur réseau lors de la mise à jour du lien.");
    }
  };

  const addMarker = (arret) => {
    const icon = arret.linked
      ? arretDivIcon(arret.types, ICON_SIZE)
      : arretDivIcon(arret.types, ICON_SIZE, {
          color: UNLINKED_COLOR,
          extraClassName: "vg-arret-unlinked",
        });
    const marker = L.marker([arret.lat, arret.lng], { icon });
    marker.bindTooltip(escapeHtml(arret.nom), {
      direction: "right",
      offset: [ICON_SIZE / 2, 0],
    });
    marker.bindPopup(buildPopup(arret), { minWidth: 260, maxWidth: 300 });
    marker.on("popupopen", (e) => {
      const root = e?.popup?.getElement?.();
      const linkBtn = root?.querySelector?.(".link-bus-btn");
      const unlinkBtn = root?.querySelector?.(".unlink-bus-btn");
      linkBtn?.addEventListener("click", () => doLink(arret, "link", root), { once: true });
      unlinkBtn?.addEventListener("click", () => doLink(arret, "unlink"), { once: true });
    });
    layer.addLayer(marker);
  };

  async function refresh() {
    let url = `/api/fetch_arrets.php?falaise_id=${falaiseId}`;
    if (map.getZoom() >= MIN_ZOOM) {
      const b = map.getBounds();
      url += `&bbox=${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch_bus_arrets failed");
      const data = await res.json();
      layer.clearLayers();
      (data.arrets || []).forEach(addMarker);
    } catch (e) {
      console.error("[editor-bus-stops] refresh failed:", e);
    }
  }

  let debounce = null;
  const onMoveEnd = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(refresh, 400);
  };
  map.on("moveend", onMoveEnd);

  // Chargement initial
  refresh();

  return {
    refresh,
    destroy() {
      map.off("moveend", onMoveEnd);
      layer.clearLayers();
      map.removeLayer(layer);
    },
  };
}
