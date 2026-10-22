import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Catalog } from "./catalog";
import { distance, json, type Row } from "./shopping";

// "Night mode": when no Torob-registered shop near the buyer is open at the time they want to go
// (e.g. 1 a.m.), suggest places that are open and LIKELY to have it — from OpenStreetMap, not
// Torob, so stock and prices are unknown — plus the earliest-opening Torob shops that do sell it.

// ---- schedules -----------------------------------------------------------------------------
type Span = [number, number]; // minutes from local midnight; end may exceed 1440 (past midnight)
const TEHRAN_OFFSET = 210 * 60000;
const tehranClock = (d: Date) => {
  const local = new Date(d.getTime() + TEHRAN_OFFSET);
  return { day: local.getUTCDay(), min: local.getUTCHours() * 60 + local.getUTCMinutes() };
};
const OSM_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** OSM opening_hours → spans per weekday (0 = Sunday). null when the format isn't understood. */
export function parseOsmHours(spec: string | null): Span[][] | null {
  if (!spec) return null;
  const week: Span[][] = Array.from({ length: 7 }, () => []);
  if (/^\s*24\/7\s*$/.test(spec)) return week.map(() => [[0, 1440]]);
  for (const raw of spec.split(";")) {
    const rule = raw.trim().replace(/\s+/g, " ");
    if (!rule || /^PH\b/.test(rule)) continue;
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(.*)$/);
    if (!m) return null;
    const days = new Set<number>();
    if (!m[1]) for (let i = 0; i < 7; i++) days.add(i);
    else
      for (const part of m[1].split(",").filter(Boolean)) {
        const [a, b] = part.split("-").map((x) => OSM_DAYS.indexOf(x));
        if (a < 0 || (b !== undefined && b < 0)) return null;
        if (b === undefined) days.add(a);
        else for (let i = a; ; i = (i + 1) % 7) {
          days.add(i);
          if (i === b) break;
        }
      }
    const times = m[2].trim();
    const spans: Span[] = [];
    if (times && times !== "off" && times !== "closed") {
      for (const t of times.split(",")) {
        const r = t.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/);
        if (!r) return null;
        const s = toMin(r[1]);
        let e = toMin(r[2]);
        if (e <= s) e += 1440;
        spans.push([s, e]);
      }
    }
    for (const d of days) week[d] = spans; // later rules override earlier ones (OSM semantics)
  }
  return week;
}
/** Torob weekly_hours JSON → spans per weekday. */
export function torobSchedule(shop: Row): Span[][] | null {
  const h = json(shop.weekly_hours, {});
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  if (!keys.some((k) => h[k])) return null;
  return keys.map((k) => {
    const d = h[k];
    if (!d || d.status === "closed") return [];
    return (d.shifts || [])
      // Placeholder shifts like 00:00:00–00:00:01 mean "closed", not "open all day".
      .filter((s: Row) => {
        const sec = (t: string) => t.split(":").reduce((acc, x) => acc * 60 + Number(x || 0), 0);
        const len = sec(s.end_time) - sec(s.start_time);
        return s.start_time !== s.end_time && (len >= 60 || len < 0);
      })
      .map((s: Row): Span => {
        const a = toMin(s.start_time),
          b = toMin(s.end_time);
        return [a, b <= a ? b + 1440 : b];
      });
  });
}
export type OpenState = { open: boolean | null; until?: number; opensIn?: number; label: string };
const hm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`.replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[+x]);
};
/** Open at `at`? If open, until when; if closed, how many minutes until it opens (within 7 days). */
export function openState(week: Span[][] | null, at: Date): OpenState {
  if (!week) return { open: null, label: "ساعت کاری نامشخص" };
  if (week.every((d) => d.length === 1 && d[0][0] === 0 && d[0][1] >= 1440)) return { open: true, label: "شبانه‌روزی" };
  const { day, min } = tehranClock(at);
  // Today's spans, plus yesterday's spans that run past midnight.
  const candidates: Span[] = [...week[day], ...week[(day + 6) % 7].filter(([, e]) => e > 1440).map(([s, e]): Span => [s - 1440, e - 1440])];
  for (const [s, e] of candidates) if (min >= s && min < e) return { open: true, until: e - min, label: `باز تا ${hm(e)}` };
  for (let k = 0; k < 8; k++) {
    const spans = [...week[(day + k) % 7]].sort((a, b) => a[0] - b[0]);
    for (const [s] of spans) {
      const wait = k * 1440 + s - min;
      if (wait > 0) {
        const when = k === 0 ? `امروز ساعت ${hm(s)}` : k === 1 ? `فردا ساعت ${hm(s)}` : `${["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"][(day + k) % 7]} ساعت ${hm(s)}`;
        return { open: false, opensIn: wait, label: `بسته · باز می‌شود ${when}` };
      }
    }
  }
  return { open: false, label: "تعطیل" };
}

// ---- places ----------------------------------------------------------------------------------
type Place = { id: string; name: string; kind: string; lat: number; lon: number; hours: string | null; street: string | null; brand: string | null; week: Span[][] | null };
let cache: Place[] | null = null;
function places(): Place[] {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "places.json");
  if (!fs.existsSync(file)) return (cache = []);
  const { cols, rows } = JSON.parse(fs.readFileSync(file, "utf8"));
  cache = rows.map((r: unknown[]) => {
    const o: Row = {};
    cols.forEach((c: string, i: number) => (o[c] = r[i]));
    return { ...o, week: parseOsmHours(o.hours) } as Place;
  });
  return cache!;
}

export const KIND_FA: Record<string, string> = {
  mall: "مرکز خرید",
  marketplace: "بازار",
  department_store: "فروشگاه بزرگ",
  supermarket: "سوپرمارکت / هایپرمارکت",
  convenience: "سوپرمارکت محله",
  kiosk: "دکه",
  pharmacy: "داروخانه",
  chemist: "بهداشتی",
  mobile_phone: "موبایل‌فروشی",
  electronics: "لوازم الکترونیکی",
  computer: "کامپیوتر",
  appliance: "لوازم خانگی",
  hardware: "ابزار‌فروشی",
  doityourself: "ابزار و یراق",
  electrical: "لوازم برقی",
  houseware: "لوازم خانه",
  clothes: "پوشاک",
  shoes: "کفش‌فروشی",
  cosmetics: "آرایشی",
  beauty: "آرایشی",
  books: "کتاب‌فروشی",
  stationery: "لوازم‌التحریر",
  toys: "اسباب‌بازی",
  baby_goods: "لوازم کودک",
  sports: "ورزشی",
  car_parts: "لوازم یدکی",
  variety_store: "فروشگاه همه‌چیز",
  general: "فروشگاه عمومی",
  gift: "کادویی",
  bag: "کیف‌فروشی",
  watches: "ساعت‌فروشی",
  optician: "عینک‌فروشی",
  medical_supply: "تجهیزات پزشکی",
  tobacco: "دخانیات",
  trade: "عمده‌فروشی",
};
// Mis-tagged offices and services that OSM lists as shops.
const NOT_A_SHOP = /شرکت|دفتر|خدمات|مهندسی|سمپاشی|کلینیک|آموزشگاه|مشاور|بیمه|املاک|آژانس|اداره|انجمن/;
// Chains whose big branches stock small electronics, chargers, household items late at night.
const HYPER = /هایپر|افق\s*کوروش|شهروند|رفاه|جانبو|اتکا|کوروش|هایپرمی|ویستا|سپه|یاس|\b24\b|۲۴/;

/** How likely a kind of place sells something from this department (0–1). */
function likelihood(kind: string, top: string | undefined, leaf: string, name: string): number {
  const big = HYPER.test(name);
  const table: Record<string, Record<string, number>> = {
    mobile: { mobile_phone: 0.95, electronics: 0.75, computer: 0.5, mall: 0.55, department_store: 0.5, supermarket: big ? 0.55 : 0.25, convenience: 0.2, kiosk: 0.2, variety_store: 0.35, general: 0.3 },
    computer: { computer: 0.95, electronics: 0.65, mobile_phone: 0.45, mall: 0.5, department_store: 0.4, stationery: 0.25, supermarket: big ? 0.25 : 0 },
    av: { electronics: 0.9, mobile_phone: 0.55, computer: 0.5, department_store: 0.45, mall: 0.5, supermarket: big ? 0.35 : 0.05 },
    appliance: { appliance: 0.95, electronics: 0.7, electrical: 0.5, department_store: 0.55, houseware: 0.4, mall: 0.4, supermarket: big ? 0.4 : 0.05 },
    home: { houseware: 0.9, department_store: 0.7, variety_store: 0.6, supermarket: big ? 0.6 : 0.3, marketplace: 0.5, mall: 0.45, hardware: 0.3, convenience: 0.15 },
    fashion: { clothes: 0.9, shoes: 0.9, bag: 0.7, mall: 0.8, department_store: 0.6, marketplace: 0.55, watches: 0.6 },
    beauty: { cosmetics: 0.9, beauty: 0.7, chemist: 0.85, pharmacy: 0.75, supermarket: big ? 0.6 : 0.35, convenience: 0.25, department_store: 0.5 },
    tools: { hardware: 0.95, doityourself: 0.9, electrical: 0.8, marketplace: 0.3, supermarket: big ? 0.2 : 0 },
    car: { car_parts: 0.95, hardware: 0.3 },
    sport: { sports: 0.95, mall: 0.5, department_store: 0.4 },
    kids: { toys: 0.95, baby_goods: 0.95, department_store: 0.5, mall: 0.5, supermarket: big ? 0.45 : 0.15, pharmacy: 0.35 },
    culture: { books: 0.9, stationery: 0.9, kiosk: 0.25, supermarket: big ? 0.3 : 0.05 },
    market: { supermarket: 0.95, convenience: 0.9, kiosk: 0.5, marketplace: 0.6, department_store: 0.4 },
    industry: { trade: 0.6, hardware: 0.5, electrical: 0.4 },
  };
  let p = (top && table[top]?.[kind]) || 0;
  // Leaf-level hints beat the department default.
  if (/شارژر|کابل|پاوربانک|هندزفری|باتری/.test(leaf)) p = Math.max(p, { mobile_phone: 0.95, electronics: 0.8, supermarket: big ? 0.6 : 0.3, convenience: 0.3, kiosk: 0.35, variety_store: 0.45 }[kind] || 0);
  if (/دارو|قرص|مکمل|بهداشت|ماسک|پوشک|شیر خشک/.test(leaf)) p = Math.max(p, { pharmacy: 0.95, chemist: 0.8, supermarket: big ? 0.6 : 0.4, convenience: 0.3 }[kind] || 0);
  if (/لامپ|سیم|چسب|پیچ|باتری قلمی/.test(leaf)) p = Math.max(p, { hardware: 0.9, electrical: 0.9, supermarket: big ? 0.45 : 0.25, convenience: 0.25 }[kind] || 0);
  return p;
}

/** Between 23:00 and 07:00 Tehran time. */
export const night = (at: Date) => {
  const { min } = tehranClock(at);
  return min >= 23 * 60 || min < 7 * 60;
};

export type LikelyPlace = { id: string; name: string; kind: string; kind_fa: string; lat: number; lon: number; km: number; hours: string; open: boolean | null; chance: "زیاد" | "متوسط" | "کم"; score: number; street: string | null; source: "osm" };

/**
 * Open places (not on Torob) that probably sell this kind of product, around the buyer at the
 * given time. Unknown hours count at reduced weight; closed places are dropped.
 */
export function likelyPlaces(opts: { top?: string; leaf?: string; lat: number; lon: number; at: Date; radiusKm?: number; limit?: number }): LikelyPlace[] {
  const { top, leaf = "", lat, lon, at, limit = 6 } = opts;
  // At night the buyer will travel further for something that is actually open.
  const radiusKm = opts.radiusKm ?? (night(at) ? 10 : 6);
  const out: LikelyPlace[] = [];
  for (const p of places()) {
    const km = distance({ lat, lon }, p);
    if (km > radiusKm || NOT_A_SHOP.test(p.name)) continue;
    // OSM often tags a hypermarket as a corner shop; the name tells.
    const kind = /هایپر/.test(p.name) ? "supermarket" : p.kind;
    const like = likelihood(kind, top, leaf, p.name);
    if (like < 0.15) continue;
    const st = openState(p.week, at);
    if (st.open === false) continue;
    // Unknown hours: plausible by day, unlikely late at night (most shops in Tehran close by ~23).
    const late = night(at);
    if (st.open === null && late && !HYPER.test(p.name) && p.kind !== "pharmacy") continue;
    const score = like * (st.open ? 1 : late ? 0.12 : 0.45) * Math.exp(-km / (late ? 4 : 2.5));
    out.push({
      id: p.id,
      name: p.name,
      kind,
      kind_fa: /هایپر/.test(p.name) ? "هایپرمارکت" : KIND_FA[kind] || kind,
      lat: p.lat,
      lon: p.lon,
      km,
      hours: st.label,
      open: st.open,
      chance: like >= 0.75 ? "زیاد" : like >= 0.45 ? "متوسط" : "کم",
      score,
      street: p.street,
      source: "osm",
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Torob shops that DO sell this product/category near the buyer, by how soon they open. */
export function torobByOpening(d: Catalog, opts: { productIds?: string[]; leaves?: string[]; lat: number; lon: number; at: Date; radiusKm?: number; limit?: number }) {
  const { lat, lon, at, radiusKm = 8, limit = 4 } = opts;
  const leaves = opts.leaves ? new Set(opts.leaves) : null;
  const ids = opts.productIds ? new Set(opts.productIds) : null;
  const best = new Map<string, Row>();
  for (const o of d.offers) {
    if (ids ? !ids.has(o.product_id) : !leaves?.has(d.product(o.product_id)?.category_name)) continue;
    const km = distance({ lat, lon }, o);
    if (km > radiusKm) continue;
    const prev = best.get(o.shop_id);
    if (!prev || (o.price_toman ?? Infinity) < (prev.price_toman ?? Infinity)) best.set(o.shop_id, { ...o, km });
  }
  const rows = [...best.values()].map((o) => {
    const shop = d.shop(o.shop_id)!;
    const st = openState(torobSchedule(shop), at);
    return { offer_id: o.offer_id, product_id: o.product_id, shop_id: o.shop_id, shop_name: shop.name, title: d.product(o.product_id)?.persian_title, price_toman: o.price_toman, km: o.km, lat: o.lat, lon: o.lon, hours: st.label, open: st.open, opensIn: st.open ? 0 : (st.opensIn ?? Infinity), express: !!shop.express, building: shop.building, floor: shop.floor };
  });
  return {
    openNow: rows.filter((r) => r.open).sort((a, b) => a.km - b.km).slice(0, limit),
    soonest: rows.filter((r) => r.open === false).sort((a, b) => a.opensIn - b.opensIn || a.km - b.km).slice(0, limit),
    express: rows.filter((r) => r.express).sort((a, b) => a.km - b.km).slice(0, 3),
  };
}
