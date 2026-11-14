import { describe, expect, test } from "bun:test";
import { enveloppe, fusionnable, memeMode } from "../../public_html/js/components/map/arrets-groupes.js";

const arret = (id, types, extra = {}) => ({ id, types, deleted: false, parent_id: null, ...extra });

describe("memeMode (intra-mode : TER et TGV ensemble, les autres modes distincts)", () => {
  test("même famille", () => {
    expect(memeMode(["bus"], ["bus"])).toBe(true);
    expect(memeMode(["ter"], ["tgv"])).toBe(true);
    expect(memeMode(["bus", "tram"], ["tram"])).toBe(true);
  });
  test("familles différentes", () => {
    expect(memeMode(["bus"], ["ter"])).toBe(false);
    expect(memeMode(["tram"], ["telepherique"])).toBe(false);
  });
  test("arrêt sans type : aucune famille en commun", () => {
    expect(memeMode([], ["bus"])).toBe(false);
  });
});

describe("fusionnable", () => {
  test("deux orphelins de même mode", () => {
    expect(fusionnable(arret(1, ["bus"]), arret(2, ["bus"]))).toEqual({ ok: true });
  });
  test("un parent (sans parent_id) est fusionnable : parent + orphelin, parent + parent", () => {
    expect(fusionnable(arret(1, ["bus"], { nb_enfants: 2 }), arret(2, ["bus"])).ok).toBe(true);
    expect(fusionnable(arret(1, ["bus"], { nb_enfants: 2 }), arret(2, ["bus"], { nb_enfants: 3 })).ok).toBe(true);
  });
  test("refus avec une raison : même arrêt, supprimé, enfant, modes différents", () => {
    expect(fusionnable(arret(1, ["bus"]), arret(1, ["bus"]))).toMatchObject({ ok: false });
    expect(fusionnable(arret(1, ["bus"], { deleted: true }), arret(2, ["bus"]))).toMatchObject({ ok: false, raison: expect.stringMatching(/supprimé/) });
    expect(fusionnable(arret(1, ["bus"]), arret(2, ["bus"], { parent_id: 9 }))).toMatchObject({ ok: false, raison: expect.stringMatching(/enfant/) });
    expect(fusionnable(arret(1, ["bus"]), arret(2, ["ter"]))).toMatchObject({ ok: false, raison: expect.stringMatching(/mode/) });
  });
});

/** Point dans un anneau [[lng, lat], …] (lancer de rayon). */
function dansAnneau([x, y], ring) {
  let dedans = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

describe("enveloppe : enveloppe convexe + buffer d'un groupe d'arrêts", () => {
  test("moins de deux positions distinctes : pas d'enveloppe", () => {
    expect(enveloppe([])).toBeNull();
    expect(enveloppe([{ lat: 45, lng: 5 }])).toBeNull();
    expect(enveloppe([{ lat: 45, lng: 5 }, { lat: 45, lng: 5 }])).toBeNull();
  });

  test("deux arrêts : une « gélule » fermée qui contient les deux arrêts et leur milieu", () => {
    const a = { lat: 45.0, lng: 5.0 };
    const b = { lat: 45.0, lng: 5.002 };
    const ring = enveloppe([a, b], 15);
    expect(ring[0]).toEqual(ring[ring.length - 1]); // anneau fermé
    expect(ring.length).toBeGreaterThan(8);
    for (const p of [a, b, { lat: 45, lng: 5.001 }]) expect(dansAnneau([p.lng, p.lat], ring)).toBe(true);
  });

  test("le buffer déborde des arrêts d'environ le rayon demandé", () => {
    const ring = enveloppe([{ lat: 45, lng: 5 }, { lat: 45, lng: 5.002 }], 20);
    const lngs = ring.map((p) => p[0]);
    const metresParDegLng = 111320 * Math.cos((45 * Math.PI) / 180);
    expect((5 - Math.min(...lngs)) * metresParDegLng).toBeGreaterThan(19);
    expect((5 - Math.min(...lngs)) * metresParDegLng).toBeLessThan(21);
  });

  test("trois arrêts : tous à l'intérieur, y compris le sommet d'un triangle", () => {
    const pts = [{ lat: 45, lng: 5 }, { lat: 45, lng: 5.003 }, { lat: 45.002, lng: 5.0015 }];
    const ring = enveloppe(pts, 10);
    for (const p of pts) expect(dansAnneau([p.lng, p.lat], ring)).toBe(true);
    expect(dansAnneau([5.0015, 45.0006], ring)).toBe(true); // centre du triangle
    expect(dansAnneau([5.01, 45.01], ring)).toBe(false); // loin
  });

  test("un point intérieur au triangle ne change pas l'enveloppe (convexité)", () => {
    const tri = [{ lat: 45, lng: 5 }, { lat: 45, lng: 5.003 }, { lat: 45.002, lng: 5.0015 }];
    const a = enveloppe(tri, 10);
    const b = enveloppe([...tri, { lat: 45.0006, lng: 5.0015 }], 10);
    expect(b.length).toBe(a.length);
  });
});
