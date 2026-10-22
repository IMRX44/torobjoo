import { Row, distance, hours } from "./shopping";
import { validOffers } from "./agent/contracts";
import { offerView } from "./agent/tools";
import type { Catalog } from "./catalog";
export function journeyOptions(
  d: Catalog,
  productId: string,
  intent: Row,
  inquiries: Row[],
  excluded: string[] = [],
  anchorId?: string,
) {
  const p = d.product(productId);
  if (!p) return null;
  const { search_text, detail_offset, detail_length, ...product } = p;
  const all = validOffers(p, d, intent);
  const unavailable = new Set([
    ...excluded,
    ...inquiries
      .filter(
        (x) => x.productId === productId && x.availability === "unavailable",
      )
      .map((x) => x.offerId),
  ]);
  const origin = { lat: intent.lat ?? 35.695, lon: intent.lon ?? 51.407 };
  const entries = all
    .filter((o) => !unavailable.has(o.offer_id))
    .map((o) => {
      const shop = d.shop(o.shop_id);
      if (!shop) return null;
      const reply = inquiries.findLast((x) => x.offerId === o.offer_id);
      return {
        ...offerView(d, o, intent),
        shop: {
          shop_id: shop.shop_id,
          name: shop.name,
          address: shop.address,
          lat: shop.lat,
          lon: shop.lon,
          location_label: shop.location_label,
          contacts: shop.contacts,
          payment_options: shop.payment_options,
        },
        hub: d.hub(o.hub_id),
        distance: distance(origin, shop),
        hours: hours(shop),
        reply,
        positive:
          reply?.isSimulated === true && reply.availability === "available",
        options: all.filter(
          (x) =>
            x.hub_id === o.hub_id &&
            x.offer_id !== o.offer_id &&
            !unavailable.has(x.offer_id),
        ).length,
      } as Row;
    })
    .filter((x): x is Row => !!x);
  const anchor = all.find((x) => x.offer_id === anchorId);
  const score = (o: Row) =>
    o.distance + 0.5 / (o.options + 1) + (o.hours === "بسته" ? 2 : 0);
  entries.sort(
    (a, b) =>
      Number(b.positive) - Number(a.positive) ||
      (anchor
        ? Number(b.hub_id === anchor.hub_id) -
          Number(a.hub_id === anchor.hub_id)
        : 0) ||
      score(a) - score(b) ||
      (a.price_toman ?? Infinity) - (b.price_toman ?? Infinity),
  );
  const primary = entries[0];
  if (!primary)
    return { product, primary: null, backups: [], eligibleCount: 0 };
  const backups = entries
    .slice(1)
    .sort(
      (a, b) =>
        Number(b.hub_id === primary.hub_id) -
          Number(a.hub_id === primary.hub_id) ||
        distance(primary.shop, a.shop) - distance(primary.shop, b.shop),
    )
    .slice(0, 2)
    .map((o): Row => ({
      ...o,
      sameHub: o.hub_id === primary.hub_id,
      fromPrimary: distance(primary.shop, o.shop),
    }));
  return { product, primary, backups, eligibleCount: entries.length };
}
