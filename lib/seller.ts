import "server-only";
import type { Catalog } from "./catalog";
import { norm, hours, json, distance, type Row } from "./shopping";
import { inquiriesForShop, priceUpdate } from "./inquiries";
import { collection } from "./store";
import type { Signal } from "./recs";

/** Price the buyer should see: the seller's confirmed price when they answered or edited it. */
export const effectivePrice = (o: Row) => {
  const u = priceUpdate(o.offer_id);
  return u && u.price != null ? u.price : o.price_toman;
};

export function shopSummary(d: Catalog, shopId: string) {
  const s = d.shop(shopId)!;
  const offers = d.offers.filter((o) => o.shop_id === shopId);
  const inbox = inquiriesForShop(shopId);
  return {
    shop_id: s.shop_id,
    name: s.name,
    address: s.address,
    building: s.building,
    floor: s.floor,
    unit: s.unit,
    hub: d.hub(s.hub_id)?.name,
    hours: hours(s),
    phone: json(s.contacts).find((c: Row) => c.display_number)?.display_number,
    offer_count: offers.length,
    pending: inbox.filter((q) => q.status === "pending").length,
    answered: inbox.filter((q) => q.status === "answered").length,
  };
}

/** One of the shop's offers against every other seller of the same product. */
export function competition(d: Catalog, o: Row) {
  const p = d.product(o.product_id)!;
  const mine = effectivePrice(o);
  const others = d
    .offersOf(o.product_id)
    .filter((x) => x.shop_id !== o.shop_id && x.is_outlier !== "yes")
    .map((x): Row => ({ ...x, price: effectivePrice(x) }))
    .filter((x) => x.price != null)
    .sort((a, b) => a.price - b.price);
  const prices = others.map((x) => x.price as number);
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
  const rank = mine == null ? null : prices.filter((x) => x < mine).length + 1;
  const ratio = mine != null && median ? mine / median : null;
  return {
    offer_id: o.offer_id,
    product_id: o.product_id,
    title: p.persian_title,
    image_url: p.image_url,
    category: p.category_name,
    my_price: mine,
    recorded_price: o.price_toman,
    updated_at: priceUpdate(o.offer_id)?.at ?? o.last_price_changed_at,
    competitors: others.length,
    min: prices[0] ?? null,
    median,
    max: prices.at(-1) ?? null,
    rank,
    // Same building/district competitors are the ones a walk-in buyer compares directly.
    nearby: others
      .filter((x) => distance(x, o) < 0.5)
      .slice(0, 5)
      .map((x) => ({ shop: d.shop(x.shop_id)?.name, price: x.price, km: Math.round(distance(x, o) * 100) / 100 })),
    flag:
      ratio == null
        ? null
        : ratio < 0.6
          ? "too_low" // likely stale or a typo; buyers get an automatic price check
          : ratio > 1.25
            ? "high"
            : rank === 1
              ? "cheapest"
              : null,
  };
}

export function myOffers(d: Catalog, shopId: string, query = "", filter = "") {
  const q = norm(query);
  return d.offers
    .filter((o) => o.shop_id === shopId)
    .filter((o) => !q || (d.product(o.product_id)?.search_text || "").includes(q))
    .map((o) => competition(d, o))
    .filter((c) => !filter || c.flag === filter)
    .sort((a, b) => (b.competitors || 0) - (a.competitors || 0));
}

export function shopStats(d: Catalog, shopId: string) {
  const mine = new Set(d.offers.filter((o) => o.shop_id === shopId).map((o) => o.product_id));
  const signals = collection<Record<string, Signal[]>>("signals", () => ({}));
  const week = Date.now() - 7 * 86400000;
  let views = 0,
    dwellMs = 0;
  const top = new Map<string, number>();
  for (const list of Object.values(signals))
    for (const s of list)
      if (s.productId && mine.has(s.productId) && Date.parse(s.at) > week) {
        if (s.type === "view") {
          views++;
          top.set(s.productId, (top.get(s.productId) || 0) + 1);
        }
        if (s.type === "dwell") dwellMs += s.ms || 0;
      }
  const inbox = inquiriesForShop(shopId);
  const answered = inbox.filter((q) => q.status === "answered");
  const responseMinutes = answered.length
    ? Math.round(answered.reduce((s, q) => s + (Date.parse(q.answeredAt!) - Date.parse(q.createdAt)), 0) / answered.length / 60000)
    : null;
  return {
    views_7d: views,
    reading_minutes_7d: Math.round(dwellMs / 60000),
    top_products: [...top]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => ({ product_id: id, title: d.product(id)?.persian_title, views: n })),
    inquiries: inbox.length,
    answer_rate: inbox.length ? Math.round((answered.length / inbox.length) * 100) : null,
    response_minutes: responseMinutes,
  };
}
