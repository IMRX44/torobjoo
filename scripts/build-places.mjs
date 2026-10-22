// Compacts an OpenStreetMap extract of Tehran shops into data/places.json: places that are NOT
// on Torob (bazaars, hypermarkets, 24-hour shops, pharmacies, …) used as "likely" fallbacks when
// no registered shop is open. Source: Overpass query for nwr[shop] + amenity=marketplace|pharmacy
// in Tehran's bbox, saved to data/sources/osm-tehran.json (© OpenStreetMap contributors, ODbL).
//   node scripts/build-places.mjs
import fs from "node:fs";

const src = JSON.parse(fs.readFileSync("data/sources/osm-tehran.json", "utf8")).elements;
const keep = new Set([
  "mall", "marketplace", "department_store", "supermarket", "convenience", "kiosk", "pharmacy", "chemist", "mobile_phone",
  "electronics", "computer", "appliance", "hardware", "doityourself", "electrical", "houseware", "clothes", "shoes",
  "cosmetics", "beauty", "books", "stationery", "toys", "baby_goods", "sports", "car_parts", "variety_store",
  "general", "gift", "bag", "watches", "optician", "medical_supply", "tobacco", "trade",
]);
const places = [];
for (const e of src) {
  const t = e.tags || {};
  const kind = t.amenity === "marketplace" ? "marketplace" : t.amenity === "pharmacy" ? "pharmacy" : t.shop;
  if (!kind || !keep.has(kind)) continue;
  const lat = e.lat ?? e.center?.lat,
    lon = e.lon ?? e.center?.lon;
  const name = (t["name:fa"] || t.name || "").trim();
  if (!lat || !lon || !name) continue;
  // Persian names often say it outright: «داروخانه شبانه‌روزی», «۲۴ ساعته».
  const nameSays247 = /شبانه\s*‌?\s*روزی|24\s*ساعت|۲۴\s*ساعت/.test(name);
  places.push([
    e.type[0] + e.id,
    name.slice(0, 80),
    kind,
    Math.round(lat * 1e6) / 1e6,
    Math.round(lon * 1e6) / 1e6,
    t.opening_hours ? t.opening_hours.slice(0, 120) : nameSays247 ? "24/7" : null,
    [t["addr:street"], t["addr:place"]].filter(Boolean).join("، ").slice(0, 80) || null,
    t.brand || null,
  ]);
}
fs.writeFileSync("data/places.json", JSON.stringify({ cols: ["id", "name", "kind", "lat", "lon", "hours", "street", "brand"], rows: places, source: "© OpenStreetMap contributors (ODbL)" }));
const withHours = places.filter((p) => p[5]).length;
console.log(`${places.length} places, ${withHours} with opening hours, ${places.filter((p) => p[5] === "24/7").length} open 24/7`);
