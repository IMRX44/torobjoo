import "server-only";
import { collection, save, now } from "./store";
import type { Catalog } from "./catalog";
import type { Row } from "./shopping";
import { searchProducts } from "./agent/contracts";

// Interest signals per profile (an account id or an anonymous device id). Incognito sessions
// never reach this module. Dwell time arrives already filtered by the browser (only while the
// tab is visible and the person interacted recently), and is capped again here so a page left
// open while AFK cannot dominate the profile.
export type Signal = {
  type: "view" | "dwell" | "search" | "chat" | "save" | "click" | "compare";
  productId?: string;
  category?: string;
  brand?: string;
  price?: number;
  query?: string;
  ms?: number;
  at: string;
};
const store = () => collection<Record<string, Signal[]>>("signals", () => ({}));
const MAX_SIGNALS = 600,
  DWELL_CAP_MS = 90_000,
  HALF_LIFE_DAYS = 7;

export function record(profile: string, signals: Omit<Signal, "at">[], d: Catalog) {
  const list = (store()[profile] ??= []);
  for (const s of signals.slice(0, 50)) {
    const p = s.productId ? d.product(s.productId) : undefined;
    list.push({
      ...s,
      category: s.category || p?.category_name,
      brand: s.brand || p?.brand_name || undefined,
      price: s.price ?? p?.min_price ?? undefined,
      ms: s.ms ? Math.min(DWELL_CAP_MS, Math.max(0, s.ms)) : undefined,
      at: now(),
    });
  }
  if (list.length > MAX_SIGNALS) list.splice(0, list.length - MAX_SIGNALS);
  save("signals");
}
/** Moves an anonymous device's history into the account on sign-in. */
export function merge(from: string, to: string) {
  const s = store();
  if (!s[from] || from === to) return;
  s[to] = [...(s[to] || []), ...s[from]].slice(-MAX_SIGNALS);
  delete s[from];
  save("signals");
}

const weight = (s: Signal) =>
  ({
    view: 1,
    click: 1,
    compare: 2,
    search: 1.5,
    chat: 2,
    save: 4,
    // 30s of real reading ≈ one extra view, up to 3.
    dwell: Math.min(3, (s.ms || 0) / 30_000),
  })[s.type] ?? 0;

// Audience words in queries and viewed titles: someone searching «کفش مردانه» should not get
// women's shoes in their feed.
const AUDIENCE = ["مردانه", "زنانه", "بچگانه", "دخترانه", "پسرانه", "نوزاد"];
const audienceOf = (text?: string) => AUDIENCE.find((a) => text?.includes(a));

export function profileOf(profile: string, d?: Catalog) {
  const audience = new Map<string, number>();
  const cats = new Map<string, number>(),
    brands = new Map<string, number>(),
    prices = new Map<string, number[]>(),
    seen = new Set<string>();
  const t = Date.now();
  for (const s of store()[profile] || []) {
    const decay = Math.pow(0.5, (t - Date.parse(s.at)) / (HALF_LIFE_DAYS * 86400000));
    const w = weight(s) * decay;
    if (s.category) cats.set(s.category, (cats.get(s.category) || 0) + w);
    if (s.brand) brands.set(s.brand, (brands.get(s.brand) || 0) + w);
    if (s.category && s.price) (prices.get(s.category) ?? prices.set(s.category, []).get(s.category)!).push(s.price);
    if (s.productId && (s.type === "view" || s.type === "save")) seen.add(s.productId);
    const a = audienceOf(s.query) || audienceOf(s.productId ? d?.product(s.productId)?.persian_title : undefined);
    if (a) audience.set(a, (audience.get(a) || 0) + w);
  }
  return { cats, brands, prices, seen, audience, size: (store()[profile] || []).length };
}

/** "For you" feed: nearby products from the categories, brands and price range the person engages with. */
export function recommend(d: Catalog, profile: string | null, origin: { lat?: number; lon?: number }, limit = 24) {
  const prof = profile ? profileOf(profile, d) : null;
  const who = prof ? [...prof.audience].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
  const topCats = prof ? [...prof.cats].sort((a, b) => b[1] - a[1]).slice(0, 6) : [];
  const out: Row[] = [],
    used = new Set<string>();
  const add = (items: Row[], reason: string, n: number) => {
    let added = 0;
    for (const p of items) {
      if (added >= n || used.has(p.product_id) || prof?.seen.has(p.product_id)) continue;
      used.add(p.product_id);
      out.push({ ...p, reason });
      added++;
    }
  };
  if (topCats.length) {
    const total = topCats.reduce((s, [, w]) => s + w, 0);
    for (const [category, w] of topCats) {
      const ps = (prof!.prices.get(category) || []).sort((a, b) => a - b);
      const mid = ps.length ? ps[Math.floor(ps.length / 2)] : null;
      const brand = [...prof!.brands].filter(([b]) => b).sort((a, b) => b[1] - a[1])[0]?.[0];
      const { items } = searchProducts(
        d,
        { category, radius: 8, ...origin, min: mid ? mid * 0.5 : null, max: mid ? mid * 1.6 : null },
        { limit: 30 },
      );
      // Same audience (مردانه/زنانه…) only, then same brand first, within the person's price range.
      const fits = who ? items.filter((p) => { const a = audienceOf(p.persian_title) || audienceOf(p.category_name); return !a || a === who; }) : items;
      const ranked = brand ? [...fits.filter((p) => p.brand_name === brand), ...fits.filter((p) => p.brand_name !== brand)] : fits;
      add(ranked, `چون به «${category}» سر زدی`, Math.max(3, Math.round((w / total) * limit)));
    }
  }
  if (out.length < limit) {
    // Cold start (or not enough signals): popular, well-stocked products nearby across departments.
    const groups = d.taxonomy.top.length ? d.taxonomy.top.map((t) => t.id) : [null];
    for (const group of groups) {
      const { items } = searchProducts(d, { group, radius: 5, ...origin }, { limit: 8 });
      add(items, "پرفروشنده در نزدیکی تو", 3);
      if (out.length >= limit) break;
    }
  }
  return { items: out.slice(0, limit), personalized: topCats.length > 0, signals: prof?.size || 0 };
}
