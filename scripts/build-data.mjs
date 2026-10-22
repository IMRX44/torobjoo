// Builds the compact server-side catalog in ./data.
//
//   node scripts/build-data.mjs --raw <starcoach export .zip|dir> --clean <torobgard-prepared-data .zip|dir>
//
// Products (titles, specs, images) come from the raw export; shops, offers and hubs come from the
// prepared ETL output, which already removed 20k duplicate shop/product offers, flagged price
// outliers and parsed building/floor/unit from addresses. Without --clean the raw files are used.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const rawSource = arg("--raw") || (process.argv[2]?.startsWith("--") ? undefined : process.argv[2]);
const cleanSource = arg("--clean");
if (!rawSource) {
  console.error("usage: node scripts/build-data.mjs --raw <export.zip|dir> [--clean <prepared.zip|dir>]");
  process.exit(1);
}
const temps = [];
function open(source) {
  if (!source.toLowerCase().endsWith(".zip")) return source;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "torobjoo-"));
  temps.push(dir);
  console.log("extracting", source);
  if (process.platform === "win32")
    execFileSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-xf", path.resolve(source), "-C", dir]);
  else execFileSync("unzip", ["-oq", path.resolve(source), "-d", dir]);
  return dir;
}
const find = (dir, file) => {
  for (const candidate of [path.join(dir, file), path.join(dir, "clean", file)])
    if (fs.existsSync(candidate)) return candidate;
  throw Error(`${file} not found in ${dir}`);
};
const rawDir = open(rawSource);
const cleanDir = cleanSource ? open(cleanSource) : null;
const out = path.resolve("data");
fs.mkdirSync(out, { recursive: true });

// Streaming RFC 4180 parser; the exports write missing values as the literal null.
async function* rows(file) {
  const stream = fs.createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 20 });
  let header = null,
    row = [],
    field = "",
    quoted = false,
    pendingQuote = false;
  const finish = () => {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    field = "";
    const r = row;
    row = [];
    if (!header) {
      header = r.map((h) => h.replace(/^\uFEFF/, ""));
      return null;
    }
    const o = {};
    header.forEach((h, i) => (o[h] = r[i] === "null" || r[i] === undefined || r[i] === "" ? null : r[i]));
    return o;
  };
  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          field += '"';
          quoted = true;
          continue;
        }
      }
      if (quoted) {
        if (c !== '"') field += c;
        else if (i + 1 === chunk.length) {
          quoted = false;
          pendingQuote = true;
        } else if (chunk[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        const o = finish();
        if (o) yield o;
      } else field += c;
    }
  }
  if (field || row.length) {
    const o = finish();
    if (o) yield o;
  }
}
const parse = (v, fallback) => {
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const fa = (s) =>
  String(s ?? "")
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
// Keep in sync with norm() in lib/shopping.ts.
const norm = (s) =>
  fa(String(s || "").toLowerCase())
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ً-ٟ‌]/g, " ")
    .replace(/سامسونگ/g, "samsung")
    .replace(/شیائومی/g, "xiaomi")
    .replace(/کیو\s*سی\s*وای/g, "qcy")
    .replace(/آیفون|اپل|iphone/g, "apple")
    .replace(/گوشی/g, "موبایل")
    .replace(/\s+/g, " ")
    .trim();
const median = (xs) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : null;
};
const yes = (v) => v === "yes" || v === "true" || v === true;

// ---- sizes and colors -------------------------------------------------------------------
// Size lives in specs ("سایز", "سایزبندی", "سایز کفش", …) as "37, 38, 39", "۳۸ تا ۴۲", "XL, 2XL",
// "سایز۳۴" or "فری سایز", and sometimes in the title ("… - 37", "سایز 41"). Searching titles for
// "45" matched product codes like «کد 045», so sizes become an explicit, exact field.
const sizedCategory = new RegExp(
  // Whole words only: «تاپ» must not match «لپ تاپ», nor «ست» «بست» or «دست».
  "(?<![؀-ۿ])(" +
    "کفش|کتانی|صندل|دمپایی|بوت|نیم بوت|چکمه|لباس|تی ?شرت|تیشرت|پولوشرت|شلوار|مانتو|پیراهن|کاپشن|هودی|سویشرت|جوراب|" +
    "کت|دامن|شومیز|بلوز|لگ|ژاکت|پلیور|جین|شورت|زیرپوش|سوتین|کلاه|دستکش|کمربند|پالتو|بارانی|تاپ|تونیک|سرهمی|" +
    "اسلش|گرمکن|جلیقه|روسری|شال|حوله تن پوش|پانچ|رویه|یونیفرم" +
    ")(?![؀-ۿ])",
);
const sizeKey = /^(سایز|سایزها|اندازه|سایزبندی|سایز\s*بندی|سایز\s*کفش|سایزکفش|سایزبندی\s*موجود|سایز\s*موجود|size|sizes)\s*:?$/i;
const letters = { XS: "XS", S: "S", M: "M", L: "L", XL: "XL", XXL: "2XL", "2XL": "2XL", XXXL: "3XL", "3XL": "3XL", XXXXL: "4XL", "4XL": "4XL", "5XL": "5XL", "6XL": "6XL" };
function sizesFrom(text) {
  const t = fa(text).toUpperCase().replace(/[()]/g, " ");
  const found = new Set();
  if (/فری\s*سایز|FREE\s*SIZE|فری\s*سایز/.test(t)) found.add("FREE");
  for (const m of t.matchAll(/(\d{1,2})\s*(?:تا|-|–|الی)\s*(\d{1,2})(?!\d)/g)) {
    const a = Number(m[1]),
      b = Number(m[2]);
    if (a >= 1 && b <= 60 && b > a && b - a <= 20) for (let x = a; x <= b; x++) found.add(String(x));
  }
  for (const m of t.matchAll(/(?<![\d.])(\d{1,2})(?![\d.])/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 60) found.add(String(n));
  }
  for (const m of t.matchAll(/(?<![A-Z])(X{0,4}[SL]|[2-6]XL|M)(?![A-Z])/g)) if (letters[m[1]]) found.add(letters[m[1]]);
  return found;
}
function productSizes(title, category, specs) {
  if (!sizedCategory.test(category || "") || /لپ\s*تاپ|نوت\s*بوک|کلاه\s*گیس/.test(category || "")) return "";
  const found = new Set();
  for (const s of specs) if (sizeKey.test(String(s.key || "").trim())) for (const v of sizesFrom(s.value)) found.add(v);
  // Title forms: «سایز ۴۱»، «سایز 40 تا 44» or a trailing «- 37».
  const t = fa(title || "");
  const inTitle = t.match(/سایز\s*([\dXSLMx\s,تا\-–]{1,30})/i) || t.match(/[-–]\s*(\d{2})\s*$/);
  if (inTitle) for (const v of sizesFrom(inTitle[1])) found.add(v);
  return found.size ? "|" + [...found].join("|") + "|" : "";
}
const colorOf = (specs) =>
  specs
    .filter((s) => /^(رنگ|رنگ‌ها|رنگ ها|رنگبندی|رنگ بندی|color)\s*:?$/i.test(String(s.key || "").trim()))
    .map((s) => String(s.value))
    .join(" ")
    .slice(0, 120);

// ---- hubs and shops ---------------------------------------------------------------------
const hubs = [];
const hubById = new Map();
if (cleanDir) {
  console.log("hubs…");
  for await (const h of rows(find(cleanDir, "hubs.csv"))) {
    const cats = parse(h.category_counts_json, {});
    const hub = {
      hub_id: h.hub_id,
      name: h.name,
      kind: h.kind,
      district: h.location_label,
      lat: Number(h.lat),
      lon: Number(h.lon),
      shop_count: Number(h.shop_count) || 0,
      top_categories: Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([c]) => c),
    };
    hubs.push(hub);
    hubById.set(hub.hub_id, hub);
  }
}
console.log("shops…");
const shops = [];
for await (const s of rows(cleanDir ? find(cleanDir, "shops.csv") : find(rawDir, "shops.csv"))) {
  const payments = parse(s.payment_options, [])
    .map((p) => p.provider_name)
    .filter(Boolean);
  const lat = Number(s.lat),
    lon = Number(s.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  shops.push({
    shop_id: s.shop_id,
    name: s.name,
    address: s.address,
    category_names: s.category_names || "[]",
    contacts: s.contacts || "[]",
    instagram: s.instagram,
    website_url: s.website_url,
    lat,
    lon,
    location_label: s.location_label,
    hub_id: hubById.has(s.hub_id) ? s.hub_id : null,
    building: s.building_name || null,
    floor: s.floor || null,
    unit: s.unit || null,
    payment_options: [...new Set(payments)],
    torob_pay: payments.includes("ترب‌پی") || yes(s.torob_pay) ? "yes" : "no",
    installment: yes(s.installment),
    express: yes(s.express) || s.supports_fast_delivery === "true",
    weekly_hours: s.weekly_hours || "{}",
  });
}
// Without the prepared hubs, fall back to one hub per district label.
if (!hubs.length) {
  const groups = new Map();
  for (const s of shops) {
    if (!s.location_label) continue;
    if (!groups.has(s.location_label)) groups.set(s.location_label, []);
    groups.get(s.location_label).push(s);
  }
  [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([label, list], i) => {
      const hub = {
        hub_id: "hub_" + String(i + 1).padStart(2, "0"),
        name: label,
        kind: "district",
        district: label,
        lat: median(list.map((s) => s.lat)),
        lon: median(list.map((s) => s.lon)),
        shop_count: list.length,
        top_categories: [],
      };
      for (const s of list) s.hub_id = hub.hub_id;
      hubs.push(hub);
      hubById.set(hub.hub_id, hub);
    });
}
// Street clusters share district names; number them so two «محدودهٔ خرید فردوسی» are distinguishable.
const seen = new Map();
for (const h of [...hubs].sort((a, b) => b.shop_count - a.shop_count)) {
  const n = (seen.get(h.name) || 0) + 1;
  seen.set(h.name, n);
  if (n > 1) h.name = `${h.name} (${n})`;
}
const shopById = new Map(shops.map((s) => [s.shop_id, s]));

// ---- offers -----------------------------------------------------------------------------
console.log("offers…");
const offerRows = new Map(); // shop|product → freshest offer
let rawOffers = 0,
  duplicates = 0;
for await (const o of rows(cleanDir ? find(cleanDir, "offers.csv") : find(rawDir, "offers.csv"))) {
  rawOffers++;
  if (!shopById.has(o.shop_id) || !o.product_id) continue;
  const key = o.shop_id + "|" + o.product_id;
  const prev = offerRows.get(key);
  if (prev) {
    duplicates++;
    if ((prev.last_price_changed_at || "") >= (o.last_price_changed_at || "")) continue;
  }
  offerRows.set(key, o);
}
const offers = [],
  stats = new Map();
for (const o of offerRows.values()) {
  const price = o.price_toman == null ? null : Number(o.price_toman);
  const w = parse(o.warranty, null);
  const warranty =
    typeof w === "object" && w ? w.description || w.provider || null : o.warranty ? String(o.warranty) : null;
  offers.push({
    offer_id: o.offer_id,
    product_id: o.product_id,
    shop_id: o.shop_id,
    price_toman: Number.isFinite(price) && price > 0 ? price : null,
    last_price_changed_at: o.last_price_changed_at,
    seller_title: (o.seller_title || "").slice(0, 160),
    warranty: warranty ? warranty.slice(0, 120) : null,
    description: o.description ? o.description.replace(/\s+\n/g, "\n").trim().slice(0, 700) : null,
    flagged: o.is_outlier === "yes",
  });
}
for (const o of offers) {
  let st = stats.get(o.product_id);
  if (!st) stats.set(o.product_id, (st = { prices: [], count: 0, latest: null, hubs: new Set() }));
  st.count++;
  if (o.price_toman != null && !o.flagged) st.prices.push(o.price_toman);
  if (o.last_price_changed_at && (!st.latest || o.last_price_changed_at > st.latest)) st.latest = o.last_price_changed_at;
  const hub = shopById.get(o.shop_id).hub_id;
  if (hub) st.hubs.add(hub);
}
// A price below a fifth of the product median is almost always a placeholder or an accessory listing.
for (const st of stats.values()) {
  st.median = median(st.prices);
  if (st.prices.length >= 3) st.prices = st.prices.filter((p) => p >= st.median / 5);
}

// ---- products ---------------------------------------------------------------------------
console.log("products…");
const local = new Set(
  fs.existsSync("public/products") ? fs.readdirSync("public/products").map((f) => f.replace(/\.jpg$/, "")) : [],
);
const detail = fs.openSync(path.join(out, "details.ndjson"), "w");
let offset = 0,
  sized = 0;
const products = [],
  categories = {};
for await (const p of rows(find(rawDir, "products.csv"))) {
  const st = stats.get(p.product_id);
  if (!st || !p.persian_title) continue; // a product nobody sells is not useful for in-person shopping
  const specs = parse(p.specs, []).filter((s) => s && s.key);
  const images = parse(p.image_urls, []).filter((u) => typeof u === "string").slice(0, 10);
  const sizes = productSizes(p.persian_title, p.category_name, specs);
  if (sizes) sized++;
  const colors = colorOf(specs);
  const line = Buffer.from(JSON.stringify({ specs, images }) + "\n");
  fs.writeSync(detail, line);
  products.push([
    p.product_id,
    p.persian_title.replace(/\s+/g, " ").trim(), // some titles carry line breaks
    p.brand_name,
    p.category_name,
    p.model,
    local.has(p.product_id) ? `/products/${p.product_id}.jpg` : images[0] || null,
    st.prices.length ? Math.min(...st.prices) : null,
    st.prices.length ? Math.max(...st.prices) : null,
    st.median,
    st.count,
    st.latest,
    st.hubs.size,
    sizes,
    colors || null,
    images.length,
    specs.length,
    norm([p.persian_title, p.brand_name, p.model, p.category_name, colors].filter(Boolean).join(" ")),
    offset,
    line.length,
  ]);
  offset += line.length;
  categories[p.category_name] = (categories[p.category_name] || 0) + 1;
}
fs.closeSync(detail);
const known = new Set(products.map((p) => p[0]));
const offerCols = ["offer_id", "product_id", "shop_id", "price_toman", "last_price_changed_at", "seller_title", "warranty", "description", "flagged"];
const keptOffers = offers.filter((o) => known.has(o.product_id));

const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value));
write("products.json", {
  cols: ["product_id", "persian_title", "brand_name", "category_name", "model", "image_url", "min_price", "max_price", "median_price", "offer_count", "latest_price_at", "hub_count", "sizes", "colors", "image_count", "spec_count", "search_text", "detail_offset", "detail_length"],
  rows: products,
});
write("offers.json", { cols: offerCols, rows: keptOffers.map((o) => offerCols.map((c) => o[c])) });
write("shops.json", shops);
write("hubs.json", hubs);
write(
  "categories.json",
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count })),
);
const meta = {
  source: path.basename(rawSource) + (cleanSource ? " + " + path.basename(cleanSource) : ""),
  builtAt: new Date().toISOString(),
  products: products.length,
  offers: keptOffers.length,
  shops: shops.length,
  hubs: hubs.length,
  categories: Object.keys(categories).length,
  quality: {
    raw_offers: rawOffers,
    duplicate_offers_removed: duplicates,
    flagged_price_outliers: keptOffers.filter((o) => o.flagged).length,
    offers_without_price: keptOffers.filter((o) => o.price_toman == null).length,
    products_with_sizes: sized,
    shops_with_floor: shops.filter((s) => s.floor).length,
  },
};
write("meta.json", meta);
console.log(JSON.stringify(meta, null, 1));
for (const t of temps) fs.rmSync(t, { recursive: true, force: true });
