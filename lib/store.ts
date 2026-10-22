import "server-only";
import fs from "node:fs";
import path from "node:path";

// Small durable store: one JSON file per collection under data/store, kept in memory and
// written atomically (tmp + rename) a moment after each change. Enough for a single-server
// deployment; swap for a database by reimplementing collection()/save().
const dir = path.join(process.cwd(), "data", "store");
type Cache = { data: Map<string, any>; timers: Map<string, NodeJS.Timeout> };
const g = globalThis as unknown as { __tjStore?: Cache };
const cache = (g.__tjStore ??= { data: new Map(), timers: new Map() });

export function collection<T>(name: string, initial: () => T): T {
  if (!cache.data.has(name)) {
    let value: T;
    try {
      value = JSON.parse(fs.readFileSync(path.join(dir, name + ".json"), "utf8"));
    } catch {
      value = initial();
    }
    cache.data.set(name, value);
  }
  return cache.data.get(name);
}

export function save(name: string) {
  clearTimeout(cache.timers.get(name));
  cache.timers.set(
    name,
    setTimeout(() => {
      cache.timers.delete(name);
      try {
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, name + ".json"),
          tmp = file + "." + process.pid + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(cache.data.get(name)));
        fs.renameSync(tmp, file);
      } catch (e) {
        console.error("[store] write failed", name, e);
      }
    }, 250),
  );
}

export const now = () => new Date().toISOString();
export const id = (prefix: string) => prefix + "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
