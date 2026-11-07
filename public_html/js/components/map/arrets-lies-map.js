/**
 * Carte « lier des arrêts à une falaise » (formulaire d'ajout de falaise).
 *
 * Seconde carte, distincte de la carte de placement de la falaise : centrée sur
 * la falaise (zoom 14) dès qu'elle est placée, elle affiche les arrêts du
 * catalogue de la zone visible (icône colorée par type s'ils sont liés, grisée
 * sinon). Un clic ouvre « Lier cet arrêt » / « Délier cet arrêt ». L'état des
 * arrêts liés appartient à l'appelant (composant Vue du formulaire) :
 *
 *   - entrée  : événement `velogrimpe:arrets-pietons-changed` { detail: { ids } }
 *   - sortie  : `setLinked(id, linked)` (callback)
 *   - position de la falaise : événement `velogrimpe:falaise-position`
 *     { detail: { lat, lng } } ; visibilité du bloc : `velogrimpe:arrets-pietons-toggle`
 *     { detail: { visible } } (la carte doit recalculer sa taille à l'affichage).
 *
 * Repères DOM : chaque marqueur porte `data-arret-id` (+ `data-linked="true"`).
 *
 * @module arrets-lies-map
 */
import { createAjoutMap } from "/js/components/map/ajout-map.js";
import { arretDivIcon } from "/js/components/map/arret-icon.js";

const FALAISE_ZOOM = 14;
const MIN_ZOOM = 11; // en deçà, trop d'arrêts : on n'en dessine aucun
const MAX_MARKERS = 300;
const ICON_SIZE = 26;
const UNLINKED_COLOR = "#9ca3af";

const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * @param {Object} opts
 * @param {string} opts.elId id du conteneur de la carte
 * @param {HTMLElement|null} opts.instructionsEl message affiché tant que la falaise n'est pas placée
 * @param {Array<{id:number, nom:string, lat:number, lng:number, types:string[]}>} opts.arrets catalogue
 * @param {function(number, boolean): void} opts.setLinked demande de lier/délier un arrêt
 * @returns {{ map: L.Map }}
 */
export function initArretsLiesMap({ elId, instructionsEl, arrets, setLinked }) {
  const { map } = createAjoutMap(elId);
  const layer = L.layerGroup().addTo(map);
  let linked = new Set();
  let falaisePos = null;
  let falaisePin = null;
  let visible = false;

  const popupFor = (arret) => {
    const estLie = linked.has(arret.id);
    const div = document.createElement("div");
    div.className = "flex flex-col gap-2 w-[220px]";
    div.innerHTML = `<div class="font-bold">${escapeHtml(arret.nom)}${
      estLie ? ' <span class="badge badge-success badge-xs">lié</span>' : ""
    }</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn btn-xs ${estLie ? "btn-error" : "btn-primary"}`;
    btn.textContent = estLie ? "Délier cet arrêt" : "Lier cet arrêt";
    btn.addEventListener("click", () => {
      setLinked(arret.id, !estLie);
      map.closePopup();
    });
    div.appendChild(btn);
    return div;
  };

  const render = () => {
    layer.clearLayers();
    if (!visible || map.getZoom() < MIN_ZOOM) return;
    const bounds = map.getBounds().pad(0.2);
    // Les arrêts liés sont toujours dessinés (même hors vue) pour garder le lien visible.
    const aDessiner = arrets
      .filter((a) => linked.has(a.id) || bounds.contains([a.lat, a.lng]))
      .slice(0, MAX_MARKERS + linked.size);
    for (const arret of aDessiner) {
      const estLie = linked.has(arret.id);
      const marker = L.marker([arret.lat, arret.lng], {
        icon: arretDivIcon(arret.types, ICON_SIZE, estLie ? {} : { color: UNLINKED_COLOR }),
        keyboard: false,
      }).addTo(layer);
      const el = marker.getElement();
      if (el) {
        el.setAttribute("data-arret-id", String(arret.id));
        if (estLie) el.setAttribute("data-linked", "true");
      }
      marker.bindTooltip(escapeHtml(arret.nom), { direction: "right", offset: [ICON_SIZE / 2, 0] });
      marker.on("click", () => {
        L.popup({ offset: [0, -ICON_SIZE / 2] }).setLatLng([arret.lat, arret.lng]).setContent(popupFor(arret)).openOn(map);
      });
    }
  };

  const recentrer = () => {
    if (!falaisePos) return;
    if (falaisePin) map.removeLayer(falaisePin);
    // Repère de la falaise, non interactif : ne masque pas les arrêts voisins.
    falaisePin = L.marker([falaisePos.lat, falaisePos.lng], {
      interactive: false,
      keyboard: false,
      icon: L.icon({ iconUrl: "/images/map/icone_falaise_carte.png", iconSize: [24, 24], iconAnchor: [12, 24] }),
    }).addTo(map);
    map.setView([falaisePos.lat, falaisePos.lng], FALAISE_ZOOM);
    if (instructionsEl) instructionsEl.classList.add("hidden");
    render();
  };

  map.on("moveend", render);

  document.addEventListener("velogrimpe:falaise-position", (e) => {
    falaisePos = { lat: e.detail.lat, lng: e.detail.lng };
    if (visible) recentrer();
  });
  document.addEventListener("velogrimpe:arrets-pietons-changed", (e) => {
    linked = new Set((e.detail?.ids || []).map(Number));
    render();
  });
  document.addEventListener("velogrimpe:arrets-pietons-toggle", (e) => {
    visible = !!e.detail?.visible;
    if (!visible) return;
    // Le conteneur vient d'être affiché : taille à recalculer avant tout recadrage.
    requestAnimationFrame(() => {
      map.invalidateSize();
      recentrer();
    });
  });

  window.arretsLiesMap = map; // repère de debug / tests, comme window.map sur la page falaise
  return { map };
}
