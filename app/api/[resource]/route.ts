import { getCatalog, publicProduct } from "@/lib/catalog";
import { resolveCategory, searchProducts, validOffers } from "@/lib/agent/contracts";
import { offerView } from "@/lib/agent/tools";
import { autoCheckPrices } from "@/lib/inquiries";
import { bazaars } from "@/lib/bazaar";
import { hours, json, norm, Row } from "@/lib/shopping";
export const runtime = "nodejs";
// Read-only catalog endpoints: search, product, offers, offer, categories, hubs, meta.
function intentFrom(u: URLSearchParams): Row {
  const n = (k: string) => (u.get(k) ? Number(u.get(k)) : undefined);
  const sort = u.get("sort");
  return {
    query: u.get("q") || undefined,
    category: u.get("category") || undefined,
    size: u.get("size") || null,
    brand: u.get("brand") || null,
    group: u.get("group") || null,
    hub: u.get("hub") || null,
    cheap: u.get("cheap") === "1",
    phone_type: u.get("phone_type") === "smart" || u.get("phone_type") === "basic" ? u.get("phone_type") : null,
    features: u.get("f")?.slice(0, 300) || null,
    min: n("min") ?? null,
    max: n("max") ?? null,
    // A chosen shopping centre is the place; the distance limit would only hide it.
    radius: u.get("hub") ? 30 : Math.min(30, Math.max(0.1, n("radius") ?? 3)),
    lat: n("lat"),
    lon: n("lon"),
    payment: u.get("payment") === "1",
    sort: sort === "cheap" || sort === "near" || sort === "expensive" ? sort : "best",
  };
}
const shopView = (s: Row) => ({
  shop_id: s.shop_id,
  name: s.name,
  address: s.address,
  lat: s.lat,
  lon: s.lon,
  hub_id: s.hub_id,
  location_label: s.location_label,
  floor: s.floor,
  unit: s.unit,
  torob_pay: s.torob_pay,
  payment_options: json(s.payment_options),
  phone: json(s.contacts).find((c: Row) => c.display_number)?.display_number,
  hours: hours(s),
});
export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const u = new URL(request.url).searchParams;
  try {
    const d = await getCatalog();
    const id = u.get("id") || undefined;
    switch (resource) {
      case "search": {
        const intent = intentFrom(u);
        const limit = Math.min(48, Number(u.get("limit")) || 24),
          offset = Math.max(0, Number(u.get("offset")) || 0);
        return Response.json({ ...searchProducts(d, intent, { limit, offset, facets: offset === 0 }), intent });
      }
      case "product": {
        const p = d.product(id);
        if (!p) return Response.json({ error: "محصول پیدا نشد" }, { status: 404 });
        const place = d.place(p.category_name);
        // This product's values for its category's filters, e.g. [{key:"رم", value:"۸ گیگ", share: 0.14}].
        const features = d.facets(p.category_name).flatMap((f, ki) => {
          const vi = f.values.findIndex((_, vi) => String(p.attrs || "").includes(`|${ki}.${vi}|`));
          if (vi < 0) return [];
          const total = f.values.reduce((n, x) => n + x.n, 0);
          return [{ key: f.key, value: f.values[vi].v, count: f.values[vi].n, share: f.values[vi].n / total }];
        });
        return Response.json({ ...publicProduct(p, true), features, top: place.top ? { id: place.top.id, name: place.top.name } : null, sub: place.sub ?? null });
      }
      case "offers": {
        const p = d.product(id);
        if (!p) return Response.json({ error: "محصول پیدا نشد" }, { status: 404 });
        const intent = intentFrom(u);
        const all = u.get("all") === "1";
        // Opening a product's sellers triggers (at most one per offer every few days) a price
        // check for offers far below the others.
        autoCheckPrices(d.offersOf(p.product_id), p);
        const offers = (all ? [...d.offersOf(p.product_id)] : validOffers(p, d, intent)).sort((a, b) =>
          intent.sort === "cheap" ? (a.price_toman ?? Infinity) - (b.price_toman ?? Infinity) : 0,
        );
        return Response.json({
          total: offers.length,
          offers: offers.slice(0, 60).map((o) => offerView(d, o, intent)),
        });
      }
      case "offer": {
        const o = d.offer(id);
        return o
          ? Response.json(offerView(d, o))
          : Response.json({ error: "پیشنهاد پیدا نشد" }, { status: 404 });
      }
      case "categories": {
        const q = norm(u.get("q") || "");
        return Response.json(
          (q ? d.categories.filter((c) => norm(c.name).includes(q)) : d.categories).slice(0, 60),
        );
      }
      case "category":
        return Response.json({ name: resolveCategory(d, u.get("q") || "") ?? null });
      case "bazaar": {
        // ?group=mobile | ?group=mobile/گوشی | ?category=<leaf>; optional lat/lon for distances.
        const category = u.get("category") ? resolveCategory(d, u.get("category")!) : undefined;
        const group = u.get("group") || "";
        const leaves = category ? [category] : d.leaves(group);
        if (!leaves.length) return Response.json({ error: "دسته پیدا نشد" }, { status: 404 });
        const title = category || (group.includes("/") ? group.split("/")[1] : d.taxonomy.top.find((t) => t.id === group)?.name) || group;
        const lat = Number(u.get("lat")) || 35.695, lon = Number(u.get("lon")) || 51.407;
        const areas = bazaars(d, leaves).map((a) => ({ ...a, km: Math.round(Math.hypot((a.lat - lat) * 111, (a.lon - lon) * 90) * 10) / 10 }));
        return Response.json({ title, areas });
      }
      case "hubs":
        return Response.json(
          d.hubs.map((h) => ({ ...h, shop_count: d.shops.filter((s) => s.hub_id === h.hub_id).length })),
        );
      case "hub": {
        const h = d.hub(id);
        if (!h) return Response.json({ error: "مرکز خرید پیدا نشد" }, { status: 404 });
        return Response.json({ ...h, shops: d.shops.filter((s) => s.hub_id === h.hub_id).slice(0, 200).map(shopView) });
      }
      case "shop": {
        const s = d.shop(id);
        return s
          ? Response.json(shopView(s))
          : Response.json({ error: "فروشگاه پیدا نشد" }, { status: 404 });
      }
      case "taxonomy": {
        const count = new Map(d.categories.map((c) => [c.name, c.count]));
        const sum = (names: string[]) => names.reduce((s, c) => s + (count.get(c) || 0), 0);
        return Response.json(
          d.taxonomy.top.map((t) => ({
            ...t,
            count: sum(d.leaves(t.id)),
            subs: t.subs.map((name) => {
              const leaves = d.leaves(t.id + "/" + name).sort((a, b) => (count.get(b) || 0) - (count.get(a) || 0));
              return { name, count: sum(leaves), leaves: leaves.slice(0, 40) };
            }),
          })),
        );
      }
      case "meta":
        return Response.json(d.meta);
      default:
        return Response.json({ error: "مسیر پیدا نشد" }, { status: 404 });
    }
  } catch (e) {
    console.error(e);
    return Response.json({ error: "دریافت داده ناموفق بود" }, { status: 503 });
  }
}
