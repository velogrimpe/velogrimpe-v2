import { watch } from "vue";
import type { FilterState, Exposition, Cotation } from "@/types";
import { useFiltersStore } from "@/stores/filters";

const VALID_EXPOSITIONS: Exposition[] = ["N", "E", "S", "O"];
const VALID_COTATIONS: Cotation[] = [
  "40",
  "50",
  "59",
  "60",
  "69",
  "70",
  "79",
  "80",
];

// Preserved params that are not filter-related
const PRESERVED_PARAMS = ["h"];

function parseNumber(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Read URL query params and return a partial FilterState */
function paramsToFilters(params: URLSearchParams): Partial<FilterState> {
  const partial: Partial<FilterState> = {};

  // Exposition
  const expo = params.get("expo");
  if (expo) {
    const values = expo
      .split(",")
      .filter((v): v is Exposition =>
        VALID_EXPOSITIONS.includes(v as Exposition),
      );
    if (values.length) partial.exposition = values;
  }

  // Cotations
  const cot = params.get("cot");
  if (cot) {
    const values = cot
      .split(",")
      .filter((v): v is Cotation => VALID_COTATIONS.includes(v as Cotation));
    if (values.length) partial.cotations = values;
  }

  // Type voies
  const couenne = params.get("couenne");
  const gv = params.get("gv");
  const bloc = params.get("bloc");
  const psycho = params.get("psycho");
  if (couenne || gv || bloc || psycho) {
    partial.typeVoies = {
      couenne: couenne === "1",
      grandeVoie: gv === "1",
      bloc: bloc === "1",
      psychobloc: psycho === "1",
    };
  }

  // Nb voies min
  const nbmin = parseNumber(params.get("nbmin"));
  if (nbmin !== null && nbmin > 0) partial.nbVoiesMin = nbmin;

  // Ville
  const ville = params.get("ville");
  if (ville) partial.villeId = ville;

  // Train
  const tmax = parseNumber(params.get("tmax"));
  const cmax = parseNumber(params.get("cmax"));
  const ter = params.get("ter");
  if (tmax !== null || cmax !== null || ter === "1") {
    partial.train = {
      tempsMax: tmax,
      correspMax: cmax,
      terOnly: ter === "1",
    };
  }

  // Velo
  const vtmax = parseNumber(params.get("vtmax"));
  const vdmax = parseNumber(params.get("vdmax"));
  const vdnmax = parseNumber(params.get("vdnmax"));
  const apied = params.get("apied");
  if (vtmax !== null || vdmax !== null || vdnmax !== null || apied === "1") {
    partial.velo = {
      tempsMax: vtmax,
      distMax: vdmax,
      denivMax: vdnmax,
      apiedPossible: apied === "1",
    };
  }

  // Approche
  const amax = parseNumber(params.get("amax"));
  if (amax !== null) {
    partial.approche = { tempsMax: amax };
  }

  // Total
  const ttv = parseNumber(params.get("ttv"));
  const ttva = parseNumber(params.get("ttva"));
  if (ttv !== null || ttva !== null) {
    partial.total = { tempsTV: ttv, tempsTVA: ttva };
  }

  return partial;
}

/** Serialize filter state to URL query params (omitting defaults) */
function filtersToParams(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.exposition.length > 0)
    params.set("expo", state.exposition.join(","));

  if (state.cotations.length > 0)
    params.set("cot", state.cotations.join(","));

  if (state.typeVoies.couenne) params.set("couenne", "1");
  if (state.typeVoies.grandeVoie) params.set("gv", "1");
  if (state.typeVoies.bloc) params.set("bloc", "1");
  if (state.typeVoies.psychobloc) params.set("psycho", "1");

  if (state.nbVoiesMin > 0) params.set("nbmin", String(state.nbVoiesMin));

  if (state.villeId !== null) params.set("ville", state.villeId);

  if (state.train.tempsMax !== null)
    params.set("tmax", String(state.train.tempsMax));
  if (state.train.correspMax !== null)
    params.set("cmax", String(state.train.correspMax));
  if (state.train.terOnly) params.set("ter", "1");

  if (state.velo.tempsMax !== null)
    params.set("vtmax", String(state.velo.tempsMax));
  if (state.velo.distMax !== null)
    params.set("vdmax", String(state.velo.distMax));
  if (state.velo.denivMax !== null)
    params.set("vdnmax", String(state.velo.denivMax));
  if (state.velo.apiedPossible) params.set("apied", "1");

  if (state.approche.tempsMax !== null)
    params.set("amax", String(state.approche.tempsMax));

  if (state.total.tempsTV !== null)
    params.set("ttv", String(state.total.tempsTV));
  if (state.total.tempsTVA !== null)
    params.set("ttva", String(state.total.tempsTVA));

  return params;
}

/** Update browser URL without reloading, preserving non-filter params */
function updateUrl(filterParams: URLSearchParams) {
  const currentParams = new URLSearchParams(window.location.search);

  // Build new params: preserved params first, then filter params
  const newParams = new URLSearchParams();
  for (const key of PRESERVED_PARAMS) {
    const val = currentParams.get(key);
    if (val !== null) newParams.set(key, val);
  }
  filterParams.forEach((val, key) => newParams.set(key, val));

  const search = newParams.toString();
  const newUrl =
    window.location.pathname + (search ? `?${search}` : "") + window.location.hash;

  history.replaceState(null, "", newUrl);
}

/** Activate bidirectional sync between filters store and URL */
export function useUrlSync() {
  const store = useFiltersStore();

  // 1. Hydrate store from URL on init
  const params = new URLSearchParams(window.location.search);
  const initial = paramsToFilters(params);

  if (Object.keys(initial).length > 0) {
    store.hydrate(initial);
  }

  // 2. Watch store changes → update URL
  watch(
    store.filters,
    (newFilters) => {
      updateUrl(filtersToParams(newFilters));
    },
    { deep: true },
  );
}
