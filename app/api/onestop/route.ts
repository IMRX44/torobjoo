import { getCatalog } from "@/lib/catalog";
import { offerView } from "@/lib/agent/tools";
import { offerStatus } from "@/lib/inquiries";
import { distance, type Row } from "@/lib/shopping";
export const runtime = "nodejs";

// "Buy it all in one place": for the products in a shopping plan, the shopping centres where
// one visit covers the most of them, cheapest total first, then nearest.
export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const d = await getCatalog();
  const ids = [...new Set((u.get("products") || "").split(",").filter(Boolean))].slice(0, 8);
  const origin = { lat: Number(u.get("lat")) || 35.695, lon: Number(u.get("lon")) || 51.407 };
  if (ids.length < 2) return Response.json({ hubs: [] });
  const byHub = new Map<string, Map<string, Row>>();
  for (const pid of ids)
    for (const o of d.offersOf(pid)) {
      if (!o.hub_id || o.price_toman == null || o.is_outlier === "yes") continue;
      if (offerStatus(o.offer_id).confirmed?.available === false) continue;
      const m = byHub.get(o.hub_id) ?? byHub.set(o.hub_id, new Map()).get(o.hub_id)!;
      const best = m.get(pid);
      if (!best || o.price_toman < best.price_toman) m.set(pid, o);
    }
  const hubs = [...byHub]
    .map(([hubId, m]) => {
      const h = d.hub(hubId)!;
      const offers = [...m.values()];
      return {
        hub_id: hubId,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        covered: offers.length,
        total: offers.reduce((s, o) => s + o.price_toman, 0),
        km: distance(origin, h),
        offers: offers.map((o) => offerView(d, o, origin)),
        missing: ids.filter((pid) => !m.has(pid)).map((pid) => d.product(pid)?.persian_title),
      };
    })
    .filter((h) => h.covered >= 2)
    .sort((a, b) => b.covered - a.covered || a.total - b.total || a.km - b.km)
    .slice(0, 5);
  return Response.json({ products: ids.length, hubs });
}
