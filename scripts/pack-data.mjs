// Compresses the built catalog (≈320 MB → ≈75 MB) into data/packed/ for uploading to a
// remote builder; the Dockerfile unpacks it. Run after build-data: node scripts/pack-data.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";

const dir = path.resolve("data"),
  out = path.join(dir, "packed");
fs.mkdirSync(out, { recursive: true });
for (const f of ["products.json", "offers.json", "details.ndjson", "shops.json", "hubs.json", "categories.json", "taxonomy.json", "meta.json", "places.json", "facets.json"]) {
  if (!fs.existsSync(path.join(dir, f))) throw Error(`data/${f} missing; run scripts/build-data.mjs first`);
  await pipeline(fs.createReadStream(path.join(dir, f)), zlib.createGzip({ level: 9 }), fs.createWriteStream(path.join(out, f + ".gz")));
  console.log(f, "→", (fs.statSync(path.join(out, f + ".gz")).size / 1e6).toFixed(1), "MB");
}
