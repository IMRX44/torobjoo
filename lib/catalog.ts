import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Row } from "@/lib/shopping";

// In-memory catalog built by scripts/build-data.mjs. Arrays keep the shapes the
// agent code already uses; the maps make id lookups O(1) on 200k+ products.
export type TopCategory = { id: string; name: string; subs: string[] };
export type Catalog = {
  products: Row[];
  offers: Row[];
  shops: Row[];
  hubs: Row[];
  categories: { name: string; count: number }[];
  taxonomy: { top: TopCategory[]; map: Record<string, [string, string]> };
  meta: Row;
  product(id: string | undefined): Row | undefined;
  offer(id: string | undefined): Row | undefined;
  shop(id: string | undefined): Row | undefined;
  hub(id: string | undefined): Row | undefined;
  offersOf(productId: string): Row[];
  details(p: Row): { specs: Row[]; images: string[] };
  /** Leaf category names under a top id ("fashion") or "top/sub" path. */
  leaves(path: string): string[];
  place(category: string): { top?: TopCategory; sub?: string };
  /** Category-specific filters (RAM for phones, watts for chargers, …); products carry `attrs` = "|key.value|…". */
  facets(category: string | undefined): Facet[];
};
export type Facet = { key: string; values: { v: string; n: number }[] };

const dir = path.join(process.cwd(), "data");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const table = ({ cols, rows }: { cols: string[]; rows: unknown[][] }) =>
  rows.map((r) => {
    const o: Row = {};
    cols.forEach((c, i) => (o[c] = r[i]));
    return o;
  });

function load(): Catalog {
  if (!fs.existsSync(path.join(dir, "meta.json")))
    throw Error("CATALOG_MISSING: run node scripts/build-data.mjs --raw <export> --clean <prepared>");
  const shops: Row[] = read("shops.json"),
    hubs: Row[] = read("hubs.json"),
    products = table(read("products.json")),
    offers = table(read("offers.json")),
    categories = read("categories.json");
  const taxonomy = fs.existsSync(path.join(dir, "taxonomy.json"))
    ? read("taxonomy.json")
    : { top: [], map: {} as Record<string, [string, string]> };
  const shopById = new Map(shops.map((s) => [s.shop_id, s])),
    hubById = new Map(hubs.map((h) => [h.hub_id, h])),
    productById = new Map(products.map((p) => [p.product_id, p])),
    offerById = new Map<string, Row>(),
    byProduct = new Map<string, Row[]>();
  for (const o of offers) {
    const s = shopById.get(o.shop_id)!,
      p = productById.get(o.product_id);
    o.lat = s.lat;
    o.lon = s.lon;
    o.hub_id = s.hub_id ?? null;
    o.torob_pay = s.torob_pay;
    o.is_outlier =
      o.flagged || (p?.median_price && o.price_toman != null && o.price_toman < p.median_price / 5) ? "yes" : "no";
    offerById.set(o.offer_id, o);
    const list = byProduct.get(o.product_id);
    if (list) list.push(o);
    else byProduct.set(o.product_id, [o]);
  }
  // Built by scripts/build-facets.mjs; optional so an older data folder still loads.
  const facetFile = path.join(dir, "facets.json");
  const facets: { cats: Record<string, Facet[]>; attrs: Record<string, string> } = fs.existsSync(facetFile)
    ? read("facets.json")
    : { cats: {}, attrs: {} };
  for (const [id, a] of Object.entries(facets.attrs)) {
    const p = productById.get(id);
    if (p) p.attrs = a;
  }
  const topById = new Map<string, TopCategory>(taxonomy.top.map((t: TopCategory) => [t.id, t]));
  const leavesByPath = new Map<string, string[]>();
  for (const c of categories) {
    const [top, sub] = taxonomy.map[c.name] || ["industry", "سایر"];
    for (const key of [top, top + "/" + sub]) {
      if (!leavesByPath.has(key)) leavesByPath.set(key, []);
      leavesByPath.get(key)!.push(c.name);
    }
  }
  return {
    products,
    offers,
    shops,
    hubs,
    categories,
    taxonomy,
    meta: read("meta.json"),
    product: (id) => (id ? productById.get(id) : undefined),
    offer: (id) => (id ? offerById.get(id) : undefined),
    shop: (id) => (id ? shopById.get(id) : undefined),
    hub: (id) => (id ? hubById.get(id) : undefined),
    offersOf: (id) => byProduct.get(id) || [],
    details: productDetails,
    leaves: (p) => leavesByPath.get(p) || [],
    facets: (category) => (category && facets.cats[category]) || [],
    place: (category) => {
      const [top, sub] = taxonomy.map[category] || [];
      return { top: topById.get(top), sub };
    },
  };
}

// Survives dev hot reloads so the ~300MB dataset is parsed once per process.
const cache = globalThis as unknown as { __torobgardCatalog?: Promise<Catalog> };
export function getCatalog() {
  cache.__torobgardCatalog ??= Promise.resolve()
    .then(load)
    .catch((e) => {
      cache.__torobgardCatalog = undefined;
      throw e;
    });
  return cache.__torobgardCatalog;
}

/** Specs and the full image list, read from disk only when a product is opened. */
export function productDetails(p: Row): { specs: Row[]; images: string[] } {
  if (p.detail_offset == null) return { specs: [], images: [] };
  const fd = fs.openSync(path.join(dir, "details.ndjson"), "r");
  try {
    const buffer = Buffer.alloc(p.detail_length);
    fs.readSync(fd, buffer, 0, p.detail_length, p.detail_offset);
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return { specs: [], images: [] };
  } finally {
    fs.closeSync(fd);
  }
}

/** Product without server-only index fields, safe to send to the browser or the model. */
export function publicProduct(p: Row, details = false): Row {
  const { search_text, detail_offset, detail_length, attrs, ...rest } = p;
  return details ? { ...rest, ...productDetails(p) } : rest;
}
