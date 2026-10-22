import "server-only";
import type { Catalog } from "@/lib/catalog";
import { distance, type Row } from "@/lib/shopping";

// «بورسِ» a kind of product: the neighbourhoods where most of its in-person sellers sit
// (mobile → جمهوری / شیخ هادی, lighting → لاله‌زار …), with the shopping centres inside them.
// Built from offers, so a shop counts only if it actually lists products of that kind.
export type Bazaar = {
  name: string;
  lat: number;
  lon: number;
  shops: number;
  offers: number;
  min_price: number | null;
  radius_m: number;
  km?: number;
  hubs: { hub_id: string; name: string; shops: number; lat: number; lon: number }[];
};

const cache = new Map<string, Bazaar[]>();

export function bazaars(d: Catalog, leaves: string[], limit = 6): Bazaar[] {
  const key = d.meta.builtAt + "|" + leaves.slice().sort().join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const want = new Set(leaves);
  const areas = new Map<string, { shops: Map<string, Row>; offers: number; min: number | null; hubs: Map<string, Set<string>> }>();
  for (const o of d.offers) {
    const p = d.product(o.product_id);
    if (!p || !want.has(p.category_name)) continue;
    const s = d.shop(o.shop_id);
    const area = s?.location_label;
    if (!s || !area) continue;
    let a = areas.get(area);
    if (!a) areas.set(area, (a = { shops: new Map(), offers: 0, min: null, hubs: new Map() }));
    a.shops.set(s.shop_id, s);
    a.offers++;
    if (o.price_toman != null && o.is_outlier !== "yes" && (a.min == null || o.price_toman < a.min)) a.min = o.price_toman;
    if (s.hub_id) {
      if (!a.hubs.has(s.hub_id)) a.hubs.set(s.hub_id, new Set());
      a.hubs.get(s.hub_id)!.add(s.shop_id);
    }
  }
  const list: Bazaar[] = [...areas]
    .filter(([, a]) => a.shops.size >= 2)
    .map(([name, a]) => {
      const shops = [...a.shops.values()];
      const lat = shops.reduce((n, s) => n + s.lat, 0) / shops.length,
        lon = shops.reduce((n, s) => n + s.lon, 0) / shops.length;
      // Circle holding most of the area's shops (60th-percentile distance from the centre, 150–650 m).
      const ds = shops.map((s) => distance({ lat, lon }, s) * 1000).sort((x, y) => x - y);
      const radius_m = Math.max(150, Math.min(650, ds[Math.floor(ds.length * 0.6)] || 0));
      const hubs = [...a.hubs]
        .map(([id, set]) => ({ hub: d.hub(id), shops: set.size }))
        .filter((h) => h.hub && h.hub.kind === "building")
        .sort((x, y) => y.shops - x.shops)
        .slice(0, 3)
        .map(({ hub, shops }) => ({ hub_id: hub!.hub_id, name: hub!.name, shops, lat: hub!.lat, lon: hub!.lon }));
      return { name, lat, lon, shops: a.shops.size, offers: a.offers, min_price: a.min, radius_m: Math.round(radius_m), hubs };
    })
    .sort((x, y) => y.shops - x.shops || y.offers - x.offers)
    .slice(0, limit);
  cache.set(key, list);
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return list;
}
