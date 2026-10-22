import "server-only";
import { collection, save, now, id } from "./store";
import { isClaimed } from "./auth";
import type { Row } from "./shopping";

// Questions to sellers are shared by everyone: if one buyer (or the automatic price check)
// already asked a shop about an offer, every other buyer sees that answer instead of the shop
// getting the same message again.
export type Inquiry = {
  id: string;
  offerId: string;
  productId: string;
  shopId: string;
  title: string;
  reason: "price_check" | "stock" | "buyer";
  question: string;
  recordedPrice: number | null;
  marketPrice?: number | null; // median of the product's sellers when asked (for price checks)
  status: "pending" | "answered";
  createdAt: string;
  answeredAt?: string;
  answer?: { available: boolean | null; price: number | null; note?: string; simulated?: boolean };
  askers: number; // how many requests were answered from this one message
};
export type PriceUpdate = { offerId: string; price: number | null; available: boolean | null; at: string };

// A fresh answer is reused for this long; after that a buyer may ask again (prices move).
export const REASK_DAYS = 3;
// No shop receives more than this many new questions per day from the whole platform.
export const SHOP_DAILY_LIMIT = 15;
// An offer this far below the median of the other sellers is probably stale or a typo.
export const LOW_PRICE_RATIO = 0.6;

const DAY = 86400000;
const raw = () => collection<Inquiry[]>("inquiries", () => []);

// Demo mode (DEMO_SELLER_REPLY_SECONDS): shops that no real seller has claimed answer by
// themselves after a few seconds, so the whole ask → answer → alternative loop can be shown
// without a second person at the seller panel. Every such answer is marked simulated.
const DEMO_DELAY = Number(process.env.DEMO_SELLER_REPLY_SECONDS) || 0;
function settleDemo() {
  if (!DEMO_DELAY) return;
  let changed = false;
  for (const q of raw()) {
    if (q.status !== "pending" || Date.now() - Date.parse(q.createdAt) < DEMO_DELAY * 1000 || isClaimed(q.shopId)) continue;
    let h = 0;
    for (const c of q.offerId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const roll = h % 100;
    const round = (v: number) => Math.round(v / 10000) * 10000;
    q.answer =
      q.reason === "price_check"
        ? roll < 70 && q.marketPrice
          ? { available: true, price: round(q.marketPrice * 0.97), note: "قیمت ثبت‌شده قدیمی بود؛ این قیمت امروز است.", simulated: true }
          : { available: false, price: null, note: "این کالا دیگر موجود نیست.", simulated: true }
        : roll < 65
          ? { available: true, price: q.recordedPrice, note: "موجود است؛ تشریف بیاورید.", simulated: true }
          : roll < 85
            ? { available: false, price: null, note: "فعلاً موجود نداریم.", simulated: true }
            : { available: true, price: q.recordedPrice ? round(q.recordedPrice * 1.03) : null, note: "موجود است؛ قیمت کمی تغییر کرده.", simulated: true };
    q.status = "answered";
    q.answeredAt = new Date(Date.parse(q.createdAt) + DEMO_DELAY * 1000).toISOString();
    updates()[q.offerId] = { offerId: q.offerId, price: q.answer.price ?? q.recordedPrice, available: q.answer.available, at: q.answeredAt };
    changed = true;
  }
  if (changed) {
    save("inquiries");
    save("price-updates");
  }
}
const list = () => {
  settleDemo();
  return raw();
};
const updates = () => collection<Record<string, PriceUpdate>>("price-updates", () => ({}));

const fresh = (q: Inquiry) =>
  q.status === "pending" || (q.answeredAt && Date.now() - Date.parse(q.answeredAt) < REASK_DAYS * DAY);
export const latestFor = (offerId: string) =>
  list()
    .filter((q) => q.offerId === offerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
const sentToday = (shopId: string) =>
  list().filter((q) => q.shopId === shopId && Date.now() - Date.parse(q.createdAt) < DAY).length;

export type AskResult = { inquiry: Inquiry | null; outcome: "reused" | "sent" | "rate_limited" };

/** Ask a shop about an offer, unless a recent question already covers it or the shop is at its daily limit. */
export function ask(offer: Row, product: Row, reason: Inquiry["reason"], question?: string): AskResult {
  const existing = latestFor(offer.offer_id);
  if (existing && fresh(existing)) {
    existing.askers++;
    save("inquiries");
    return { inquiry: existing, outcome: "reused" };
  }
  if (sentToday(offer.shop_id) >= SHOP_DAILY_LIMIT) return { inquiry: existing ?? null, outcome: "rate_limited" };
  const q: Inquiry = {
    id: id("inq"),
    offerId: offer.offer_id,
    productId: product.product_id,
    shopId: offer.shop_id,
    title: product.persian_title,
    reason,
    question:
      question ||
      (reason === "price_check"
        ? `سلام، قیمت «${product.persian_title}» در ترب‌جو ${offer.price_toman?.toLocaleString("fa-IR")} تومان ثبت شده که از بقیهٔ فروشنده‌ها خیلی کمتر است. این قیمت هنوز معتبر است و کالا موجود است؟`
        : `سلام، «${product.persian_title}» را موجود دارید؟ قیمت فعلی چند است؟`),
    recordedPrice: offer.price_toman ?? null,
    marketPrice: product.median_price ?? null,
    status: "pending",
    createdAt: now(),
    askers: 1,
  };
  list().push(q);
  save("inquiries");
  return { inquiry: q, outcome: "sent" };
}

/** Offers priced far below the others; each gets one automatic price check (deduplicated by ask()). */
export function suspiciousOffers(offers: Row[]) {
  const prices = offers.map((o) => o.price_toman).filter((p): p is number => p != null);
  if (prices.length < 4) return [];
  const sorted = [...prices].sort((a, b) => a - b),
    median = sorted[Math.floor(sorted.length / 2)];
  return offers.filter((o) => o.price_toman != null && (o.flagged || o.price_toman < median * LOW_PRICE_RATIO));
}
export function autoCheckPrices(offers: Row[], product: Row) {
  for (const o of suspiciousOffers(offers)) {
    const last = latestFor(o.offer_id);
    if (last && fresh(last)) continue;
    ask(o, product, "price_check");
  }
}

export function answer(inquiryId: string, shopId: string, a: { available: boolean | null; price: number | null; note?: string }) {
  const q = list().find((x) => x.id === inquiryId && x.shopId === shopId);
  if (!q) return null;
  q.status = "answered";
  q.answeredAt = now();
  q.answer = { available: a.available, price: a.price, note: a.note?.slice(0, 300) };
  updates()[q.offerId] = { offerId: q.offerId, price: a.price ?? q.recordedPrice, available: a.available, at: q.answeredAt };
  save("inquiries");
  save("price-updates");
  return q;
}
/** A seller editing a price directly in their panel. */
export function setPrice(offerId: string, price: number | null, available: boolean | null) {
  updates()[offerId] = { offerId, price, available, at: now() };
  save("price-updates");
}
export const priceUpdate = (offerId: string): PriceUpdate | undefined => {
  settleDemo();
  return updates()[offerId];
};
export const inquiriesForShop = (shopId: string) =>
  list()
    .filter((q) => q.shopId === shopId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const inquiriesForOffers = (offerIds: string[]) => {
  const set = new Set(offerIds);
  const latest = new Map<string, Inquiry>();
  for (const q of list()) if (set.has(q.offerId) && (!latest.has(q.offerId) || latest.get(q.offerId)!.createdAt < q.createdAt)) latest.set(q.offerId, q);
  return latest;
};
/** What a buyer sees about an offer: the seller's confirmed price/stock, a pending question, or nothing. */
export function offerStatus(offerId: string) {
  const q = latestFor(offerId),
    u = priceUpdate(offerId);
  return {
    confirmed: u ? { price: u.price, available: u.available, at: u.at, simulated: !!q?.answer?.simulated && q.answeredAt === u.at, note: q?.answeredAt === u.at ? q?.answer?.note : undefined } : null,
    inquiry: q ? { status: q.status, reason: q.reason, createdAt: q.createdAt, answeredAt: q.answeredAt, answer: q.answer } : null,
  };
}
