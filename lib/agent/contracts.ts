import { z } from "zod";
import { norm, Row, distance } from "../shopping";
import type { Catalog } from "../catalog";
export const intentSchema = z
  .object({
    query: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    min: z.number().nonnegative().nullable().optional(),
    max: z.number().nonnegative().nullable().optional(),
    radius: z.number().min(0.1).max(30).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    locationLabel: z.string().max(100).optional(),
    payment: z.boolean().optional(),
    arrival: z.string().max(30).optional(),
    size: z.string().max(12).nullable().optional(),
    brand: z.string().max(60).nullable().optional(),
    group: z.string().max(80).nullable().optional(),
    hub: z.string().max(60).nullable().optional(),
    // «ارزون/اقتصادی/پول ندارم» without a number: stays on until a budget is given or the buyer
    // says price doesn't matter. Shows the cheaper part of the same kind of product.
    cheap: z.boolean().nullable().optional(),
    phone_type: z.enum(["smart", "basic"]).nullable().optional(),
    // Category-specific filters as "name:value|name:value", e.g. "رم:۸ گیگ|حافظه:۲۵۶ گیگ".
    features: z.string().max(300).nullable().optional(),
    sort: z.enum(["best", "cheap", "expensive", "near"]).optional(),
  })
  .strict();
const categories: [RegExp, string][] = [
  [/هدفون|هندزفری|ایرپاد|qcy|انکر|soundcore/, "هدفون، هدست و هندزفری"],
  [/موبایل|تلفن|آیفون|iphone/, "گوشی موبایل"],
  [/لپ\s*تاپ|نوت\s*بوک/, "لپ تاپ و نوت بوک"],
  [/ساعت|واچ/, "ساعت و مچ بند هوشمند"],
  [/دوربین/, "دوربین عکاسی و فیلمبرداری"],
  [/جارو\s*رباتیک|جارو\s*رباتی/, "جارو رباتیک"],
  [/جارو\s*شارژی/, "جارو شارژی"],
  [/جارو/, "جارو برقی"],
  [/تبلت/, "تبلت"],
  [/تلویزیون/, "تلویزیون"],
  [/اسپیکر|بلندگو/, "اسپیکر و سیستم صوتی"],
  [/پاوربانک/, "پاوربانک و شارژر همراه"],
  [/ایکس\s*باکس|xbox/, "کنسول بازی Xbox"],
  [/ps\s*5|پلی\s*استیشن/, "کنسول بازی  PS5"],
];
const words: Record<string, string> = {
  یک: "1",
  دو: "2",
  سه: "3",
  چهار: "4",
  پنج: "5",
  شش: "6",
  هفت: "7",
  هشت: "8",
  نه: "9",
  ده: "10",
  بیست: "20",
  سی: "30",
  چهل: "40",
  پنجاه: "50",
  صد: "100",
};
const unit = (u?: string) =>
  !u ? 0 : /^(میلیون|ملیون|میلیونی|ملیونی|م|m)$/.test(u) ? 1e6 : /^(هزار|هزارتومن|k)$/.test(u) ? 1000 : 1;
const num = (v: string) => Number(v.replace(/,/g, ""));
/**
 * Budget phrases on normalized text (Persian digits already converted):
 * «۷۰ تا ۹۰ میلیون» / «بین ۷۰ و ۹۰» → range, «حدود ۸۰» → ±10%, «تا/زیر ۸۰» or «۸۰ میلیون» → max.
 * Bare numbers without a unit or budget word are ignored (they are usually model names).
 */
export function parseBudget(t: string): { min?: number; max?: number } | null {
  // A unit must end the word, so «۸۰ مدل» is not «۸۰ م(یلیون)»; a number glued to letters («a56») is a model.
  const U = "((?:میلیون|ملیون|میلیونی|ملیونی|م|m|هزار|k|تومن|تومان)(?![\\u0600-\\u06FFa-z]))";
  const N = "(?<![a-z\\d.])(\\d[\\d,]*(?:\\.\\d+)?)";
  const notDistance = "(?!\\s*(?:کیلومتر|km|متر|دقیقه|ساعت|روز|نفر|عدد|تا\\b))";
  // Bare budget numbers are millions in practice: «تا ۸۰» for a phone means 80 million toman.
  const scale = (v: number, u?: string) => v * (unit(u) || (v < 1000 ? 1e6 : 1));
  const range =
    t.match(new RegExp(`بین\\s*${N}\\s*${U}?\\s*(?:و|تا|-|–)\\s*${N}\\s*${U}?${notDistance}`)) ||
    t.match(new RegExp(`${N}\\s*${U}?\\s*(?:تا|-|–)\\s*${N}\\s*${U}?${notDistance}`));
  if (range) {
    const hi = scale(num(range[3]), range[4]),
      lo = scale(num(range[1]), range[2] || range[4]);
    if (lo > 0 && hi > lo && hi < 1e12) return { min: lo, max: hi };
  }
  const one = t.match(new RegExp(`${N}\\s*(و\\s*نیم\\s*)?${U}`));
  const word = t.match(
    new RegExp(`(?:تا|زیر|کمتر از|حداکثر|سقف|بودجه(?:\\s*ام|\\s*م)?|حدود|حدودا|دور و بر|بالای|بیشتر از|حداقل)\\s*${N}${notDistance}`),
  );
  let value = 0;
  if (one) value = (num(one[1]) + (one[2] ? 0.5 : 0)) * unit(one[3]);
  else if (word) value = scale(num(word[1]));
  if (!value || value < 1000) return null;
  if (/(حدود|حدودا|دور و بر|اطراف)\s*\d/.test(t)) return { min: Math.round(value * 0.85), max: Math.round(value * 1.1) };
  if (/(بالای|بیشتر از|حداقل)\s*\d/.test(t)) return { min: value };
  return { max: value };
}
export function fallbackIntent(
  text: string,
  old: Row = {},
  products: Row[] = [],
) {
  const n = norm(text);
  const next = { ...old };
  let amounts = n.replace(/٫/g, ".").replace(/٬/g, ",");
  for (const [word, digit] of Object.entries(words))
    amounts = amounts.replace(
      new RegExp("(^|\\s)" + word + "(?=\\s|$)", "g"),
      "$1" + digit,
    );
  const budget = parseBudget(amounts);
  if (budget) {
    next.min = budget.min ?? null;
    next.max = budget.max ?? null;
  }
  // «کفش سایز ۴۵», «سایز XL»: exact size filter, never a text token.
  const size = n.match(/سایز\s*([0-9]{1,2}|x{0,4}[sml]|[2-6]?xl|فری)(?![0-9a-z])/i);
  if (size) next.size = normSize(size[1]);
  if (/بدون محدودیت بودجه|بودجه آزاد/.test(n)) next.min = next.max = null;
  if (/هوشمند|اسمارت|smart/.test(n)) next.phone_type = "smart";
  else if (/دکمه\s*ای|ساده|نوکیایی/.test(n)) next.phone_type = "basic";
  if (/اقتصادی|پول\s*ندارم|بودجه(م)?\s*(کم|محدود)|قیمت\s*پایین|ارزون\s*می\s*خوام|ارزان\s*می\s*خواهم/.test(n) && !budget) next.cheap = true;
  if (/ارزون\s*ترین|ارزان\s*ترین/.test(n)) next.sort = "cheap";
  else if (/ارزون|ارزان/.test(n) && !budget) {
    // «ارزون‌تر» within a budget = a cheaper tier, not the 1-million feature phone.
    if (old.max != null) {
      next.max = Math.round(old.max * 0.8);
      next.min = null;
      next.sort = "best";
    } else next.sort = "cheap";
  }
  if (/نزدیک/.test(n)) next.sort = "near";
  if (/اقساط|ترب\s*پی/.test(n)) next.payment = true;
  if (/نقدی|بدون شرط پرداخت/.test(n)) next.payment = false;
  const radius = amounts.match(/(\d+)\s*کیلومتر/);
  if (radius) next.radius = Math.max(0.1, Math.min(30, Number(radius[1])));
  const cat = categories.find(([r]) => r.test(n))?.[1];
  if (cat) {
    if (cat !== old.category) next.query = "";
    next.category = cat;
  }
  const model = n
    .match(
      /\b(?:a\s*\d{2}|s\s*\d{2}(?:\s*(?:fe|ultra))?|t\s*13(?:\s*anc\s*2)?|ps\s*5(?:\s*pro)?)\b/i,
    )?.[0]
    ?.replace(/([ast])\s+(\d)/g, "$1$2")
    .replace(/ps\s+5/, "ps5");
  if (model) {
    next.query = model;
    // The first title containing "ps5" is usually a case or cable; use the main product category.
    const counts = new Map<string, number>();
    if (!cat)
      for (const p of products)
        if ((p.search_text ?? norm(p.persian_title)).includes(model) && !accessory.test(p.category_name || ""))
          counts.set(p.category_name, (counts.get(p.category_name) || 0) + 1);
    const top = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0];
    if (cat) next.category = cat;
    else if (top) next.category = top;
    else if (/^[as]\d/.test(model)) next.category = "گوشی موبایل";
    else if (/^t13/.test(model)) next.category = "هدفون، هدست و هندزفری";
  } else if (/qcy|کیو/.test(n)) {
    next.query = "QCY";
    next.category = "هدفون، هدست و هندزفری";
  } else if (/samsung/.test(n)) {
    next.query = "samsung";
    if (!cat) next.category = "گوشی موبایل";
  } else if (/xiaomi/.test(n)) {
    next.query = "xiaomi";
  } else if (/انکر|soundcore|anker/.test(n)) {
    next.query = "انکر";
    next.category = "هدفون، هدست و هندزفری";
  } else if (/apple|ایرپاد/.test(n)) {
    next.query = "اپل";
  }
  if (/آیفون|آيفون|iphone/i.test(text)) {
    next.category = "گوشی موبایل";
    if (!model) next.query = "apple";
  }
  if (/جمهوری/.test(n)) {
    next.lat = 35.695;
    next.lon = 51.407;
    next.locationLabel = "جمهوری";
  }
  return next;
}
const origin = (i: Row) => ({ lat: i.lat ?? 35.695, lon: i.lon ?? 51.407 });
const accessory =
  /کیف|کاور|قاب|محافظ|گلس|لوازم جانبی|لوازم یدکی|قطعات|تاچ|ال سی دی|باتری|شارژر|کابل|پایه|فلت|آی سی|شیشه|پاکت|فیلتر/;
const tokens = (q?: string) =>
  norm(q || "")
    .replace(/سایز\s*\S+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !["و", "با", "برای", "مدل", "یه", "یک", "میخوام", "می خوام", "دارید"].includes(t));
/**
 * Token test against normalized product text. Numbers must be whole numbers: "45" matches
 * «سایز 45» but not «کد 045» or «725845» (that substring match put size-41 shoes in size-45 results).
 */
function tokenTest(t: string) {
  if (!/^\d+$/.test(t)) return (hay: string) => hay.includes(t);
  const re = new RegExp(String.raw`(^|[^\d])${t}([^\d]|$)`);
  return (hay: string) => re.test(hay);
}
/** "۴۵" → "45", "xxl" → "2XL", "فری سایز" → "FREE". */
export function normSize(v?: string | null) {
  if (!v) return null;
  const t = norm(v).toUpperCase().replace(/سایز|SIZE/g, "").trim();
  if (/فری|FREE/.test(t)) return "FREE";
  const map: Record<string, string> = { XXL: "2XL", XXXL: "3XL", XXXXL: "4XL" };
  return map[t] || t || null;
}
/** Exact category name, or the most common category whose name contains the text. */
export function resolveCategory(d: Catalog, value?: string) {
  if (!value) return undefined;
  if (d.categories.some((c) => c.name === value)) return value;
  const n = norm(value).replace(/\s+/g, " ");
  const exact = d.categories.find((c) => norm(c.name) === n);
  if (exact) return exact.name;
  // "گوشی" should mean phones, not the bigger "کیف و کاور گوشی": prefer names that start with the term.
  const containing = d.categories.filter((c) => norm(c.name).includes(n));
  return (
    containing.find((c) => norm(c.name).startsWith(n)) ||
    containing[0] ||
    d.categories.find((c) => n.includes(norm(c.name)))
  )?.name;
}
export function matches(p: Row, i: Row) {
  const hay =
    p.search_text ??
    norm(p.persian_title + " " + p.model + " " + p.brand_name + " " + p.category_name);
  const size = normSize(i.size);
  return (
    tokens(i.query).every((t) => tokenTest(t)(hay)) &&
    (!i.category || p.category_name === i.category) &&
    (!size || String(p.sizes || "").includes("|" + size + "|"))
  );
}
export function validOffers(p: Row, d: Catalog, i: Row) {
  const o0 = origin(i);
  return d
    .offersOf(p.product_id)
    .filter(
      (o) =>
        (i.max == null || (o.price_toman != null && o.price_toman <= i.max)) &&
        (i.min == null || (o.price_toman != null && o.price_toman >= i.min)) &&
        (!i.payment || o.torob_pay === "yes") &&
        distance(o0, o) <= (i.radius ?? 3),
    )
    .sort((a, b) =>
      i.sort === "near"
        ? distance(o0, a) - distance(o0, b)
        : (a.price_toman ?? Infinity) - (b.price_toman ?? Infinity),
    );
}
/** "رم:۸ گیگ|حافظه:۲۵۶ گیگ" → [["رم","۸ گیگ"],["حافظه","۲۵۶ گیگ"]] */
export function parseFeatures(s?: string | null): [string, string][] {
  return String(s || "")
    .split("|")
    .map((x) => x.split(":").map((t) => t.trim()) as [string, string])
    .filter(([k, v]) => k && v);
}
const looseKey = (s: string) => norm(s).replace(/[\s‌\-_/()]/g, "");
/**
 * Category filters as `|key.value|` tokens. Names are matched loosely («۸ گیگ» = «8گیگ»), so
 * values the assistant writes slightly differently still apply. Unknown names match nothing.
 */
function featureTokens(d: Catalog, category: string | undefined, features: [string, string][]) {
  const defs = d.facets(category);
  return features.map(([k, v]) => {
    const ki = defs.findIndex((f) => looseKey(f.key) === looseKey(k));
    const vi = ki < 0 ? -1 : defs[ki].values.findIndex((x) => looseKey(x.v) === looseKey(v));
    return vi < 0 ? null : `|${ki}.${vi}|`;
  });
}
type Hit = { p: Row; min: number | null; count: number; near: number; relevance: number };
// Recent ranked lists, so paging and repeated questions skip the 330k-offer scan.
const recent = new Map<string, Hit[]>();
/** Ranked products with at least one offer inside the buyer's budget, payment and radius. */
export function searchProducts(
  d: Catalog,
  intent: Row,
  { limit = 6, offset = 0, facets = false }: { limit?: number; offset?: number; facets?: boolean } = {},
) {
  const i: Row = { ...intent, category: resolveCategory(d, intent.category) };
  if (intent.category && !i.category) return { total: 0, items: [] as Row[], facets: undefined as Row | undefined };
  const q = tokens(i.query),
    o0 = origin(i),
    key = JSON.stringify([d.meta.builtAt, q, i.category, i.group, i.hub, !!i.cheap, i.phone_type, i.brand, normSize(i.size), i.features, i.min, i.max, !!i.payment, i.radius ?? 3, o0.lat, o0.lon, i.sort]);
  const found = recent.get(key) ?? rank(d, i, q, o0);
  recent.delete(key);
  recent.set(key, found);
  if (recent.size > 40) recent.delete(recent.keys().next().value!);
  return {
    total: found.length,
    items: found.slice(offset, offset + limit).map(({ p, min, count, near }) => {
      const { search_text, detail_offset, detail_length, ...rest } = p;
      return { ...rest, matching_min_price: min, matching_count: count, nearest_distance: near } as Row;
    }),
    facets: facets ? facetsOf(d, found, i) : undefined,
  };
}
/**
 * The category-specific filters for a result list, with counts: shown when the results are
 * (mostly) one category. Selected values stay visible even when nothing else matches them.
 */
export function specFacets(d: Catalog, found: { p: Row }[], i: Row) {
  let category = i.category as string | undefined;
  if (!category) {
    const counts = new Map<string, number>();
    for (const { p } of found) counts.set(p.category_name, (counts.get(p.category_name) || 0) + 1);
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] || [];
    if (top && n >= found.length * 0.5) category = top;
  }
  const defs = d.facets(category);
  if (!category || !defs.length) return null;
  const chosen = new Map(parseFeatures(i.features).map(([k, v]) => [looseKey(k), looseKey(v)]));
  const groups = defs.map((f, ki) => {
    const counts = f.values.map(() => 0);
    for (const { p } of found)
      if (p.category_name === category && p.attrs)
        for (let vi = 0; vi < f.values.length; vi++) if (p.attrs.includes(`|${ki}.${vi}|`)) counts[vi]++;
    return {
      key: f.key,
      values: f.values
        .map((x, vi) => ({ v: x.v, n: counts[vi], on: chosen.get(looseKey(f.key)) === looseKey(x.v) }))
        .filter((x) => x.n > 0 || x.on),
    };
  });
  return { category, groups: groups.filter((g) => g.values.length > 1 || g.values.some((x) => x.on)) };
}
/** Filter options for a result list: brands, leaf categories, sizes and the price span. */
function facetsOf(d: Catalog, found: Hit[], i: Row) {
  const brands = new Map<string, number>(),
    cats = new Map<string, number>(),
    sizes = new Map<string, number>();
  let lo = Infinity,
    hi = 0;
  for (const { p, min } of found) {
    if (p.brand_name) brands.set(p.brand_name, (brands.get(p.brand_name) || 0) + 1);
    cats.set(p.category_name, (cats.get(p.category_name) || 0) + 1);
    if (p.sizes) for (const z of String(p.sizes).split("|")) if (z) sizes.set(z, (sizes.get(z) || 0) + 1);
    if (min != null) {
      lo = Math.min(lo, min);
      hi = Math.max(hi, min);
    }
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));
  const order = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL", "FREE"];
  return {
    brands: top(brands, 14),
    categories: top(cats, 14).map((c) => ({ ...c, top: d.place(c.name).top?.id })),
    sizes: [...sizes]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => (isNaN(+a[0]) || isNaN(+b[0]) ? order.indexOf(a[0]) - order.indexOf(b[0]) : +a[0] - +b[0]))
      .map(([name, count]) => ({ name, count })),
    price: lo === Infinity ? null : { min: lo, max: hi },
    specs: specFacets(d, found, i),
  };
}
function rank(d: Catalog, i: Row, q: string[], o0: { lat: number; lon: number }) {
  const wantsAccessory = accessory.test(norm(i.query || "") + " " + (i.category || ""));
  // Filter offers first: distance is computed once per shop, and only products that
  // have an eligible seller are text-matched (most of the 225k products have none nearby).
  const shopDistance = new Map<string, number>(),
    matched = new Map<string, boolean>(),
    eligible = new Map<string, Row[]>();
  const tests = q.map(tokenTest),
    size = normSize(i.size),
    group = i.group ? new Set(d.leaves(i.group)) : null,
    brand = i.brand ? norm(i.brand) : null;
  // Filters belong to one category: with no category chosen, use the one they were picked from.
  const features = parseFeatures(i.features);
  const featureCategory =
    i.category || (features.length ? d.categories.map((c) => c.name).find((c) => featureTokens(d, c, features).every(Boolean)) : undefined);
  const want = features.length ? featureTokens(d, featureCategory, features) : [];
  const isMatch = (id: string) => {
    let ok = matched.get(id);
    if (ok === undefined) {
      const p = d.product(id);
      const hay = p && (p.search_text ?? norm(p.persian_title + " " + p.model + " " + p.brand_name + " " + p.category_name));
      ok =
        !!p &&
        (!i.category || p.category_name === i.category) &&
        (!group || group.has(p.category_name)) &&
        (!brand || norm(p.brand_name || "") === brand || hay.includes(brand)) &&
        (!size || String(p.sizes || "").includes("|" + size + "|")) &&
        (!want.length || (p.category_name === featureCategory && want.every((t) => t && String(p.attrs || "").includes(t)))) &&
        tests.every((test) => test(hay));
      matched.set(id, ok);
    }
    return ok;
  };
  for (const o of d.offers) {
    if (i.max != null && (o.price_toman == null || o.price_toman > i.max)) continue;
    if (i.min != null && (o.price_toman == null || o.price_toman < i.min)) continue;
    if (i.payment && o.torob_pay !== "yes") continue;
    if (i.hub && o.hub_id !== i.hub) continue;
    let km = shopDistance.get(o.shop_id);
    if (km === undefined) shopDistance.set(o.shop_id, (km = distance(o0, o)));
    if (km > (i.radius ?? 3) || !isMatch(o.product_id)) continue;
    const list = eligible.get(o.product_id);
    if (list) list.push(o);
    else eligible.set(o.product_id, [o]);
  }
  const found: Hit[] = [];
  const wantsReplica = q.includes("طرح") || q.includes("کپی") || q.includes("replica");
  for (const [id, offers] of eligible) {
    const p = d.product(id)!;
    const t = p.persian_title || "";
    // Phones: basic (button) phones list memory in «مگابایت»; smartphones in «گیگابایت».
    if (i.phone_type === "smart" && (/مگابایت/.test(t) || !/گیگ/.test(t))) continue;
    if (i.phone_type === "basic" && !/مگابایت/.test(t)) continue;
    let min: number | null = null,
      near = Infinity;
    for (const o of offers) {
      if (o.price_toman != null && o.is_outlier !== "yes" && (min == null || o.price_toman < min)) min = o.price_toman;
      near = Math.min(near, shopDistance.get(o.shop_id)!);
    }
    let relevance = Math.log2(1 + offers.length);
    if (q.length) {
      const title = norm(p.persian_title || "");
      relevance += q.filter((t) => title.includes(t)).length * 2;
      if (norm(p.category_name || "").includes(q[0])) relevance += 3;
    }
    if (!wantsAccessory && accessory.test(p.category_name || "")) relevance -= 6;
    // «گوشی طرح سامسونگ» is a look-alike, not a Samsung: below the real thing unless asked for.
    if (!wantsReplica && /(^|\s)(طرح|کپی|فیک|های کپی)\s/.test(t)) relevance -= 8;
    // A buyer who says «تا ۸۰ میلیون» wants phones near 80, not the cheapest: reward budget use.
    if (i.max != null && min != null) relevance += 6 * Math.min(1, min / i.max) ** 2;
    found.push({ p, min, count: offers.length, near, relevance });
  }
  const price = (h: Hit) => h.min ?? Infinity;
  if (i.cheap && i.max == null) {
    // "Cheap" relative to what matches: keep the lower ~35% of prices of this kind of product,
    // then prefer the cheaper ones among the relevant results.
    const prices = found
      .map((h) => h.min)
      .filter((m): m is number => m != null)
      .sort((a, b) => a - b);
    if (prices.length >= 6) {
      const cap = prices[Math.floor(prices.length * 0.35)];
      for (let k = found.length - 1; k >= 0; k--) if (found[k].min == null || found[k].min! > cap) found.splice(k, 1);
      for (const h of found) h.relevance += 4 * (1 - (h.min ?? cap) / cap);
    }
  }
  found.sort((a, b) =>
    i.sort === "near"
      ? a.near - b.near || price(a) - price(b)
      : i.sort === "cheap"
        ? price(a) - price(b)
        : i.sort === "expensive"
          ? (b.min ?? -1) - (a.min ?? -1)
          : b.relevance - a.relevance || price(a) - price(b),
  );
  return found;
}
export function productResults(d: Catalog, i: Row) {
  return searchProducts(d, i).items;
}
export function ordinal(text: string) {
  const n = norm(text);
  if (/اولی|اولین|به اول/.test(n)) return 0;
  if (/دومی|دومین|به دوم/.test(n)) return 1;
  if (/سومی|سومین|به سوم/.test(n)) return 2;
  return null;
}
