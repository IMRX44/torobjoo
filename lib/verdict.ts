import "server-only";
import { collection, save, now } from "./store";
import { completion } from "./agent/provider";
import type { Row } from "./shopping";

// "Which one should I buy?" for 2-4 products, written from their specs and recorded prices
// only, cached per product set.
export type Verdict = { summary: string; picks: { product_id: string; best_for: string }[]; differences: string[]; generated_at: string };
const cache = () => collection<Record<string, Verdict>>("verdicts", () => ({}));

const PROMPT = `You compare products for «ترب‌جو», a Persian price-comparison site. Use ONLY the specs and prices given. Write natural Persian.
Return ONLY JSON: {"summary": "2-3 sentences: the key trade-off and who should pick which",
"picks": [{"product_id": "...", "best_for": "one short phrase: who/what this one is best for"}],
"differences": ["3-6 concrete differences that matter, each naming the products and the values"]}
If specs are missing for something, don't guess; say what to check in the shop instead.`;

export async function verdict(products: Row[], signal: AbortSignal): Promise<Verdict | null> {
  const key = products.map((p) => p.product_id).sort().join(",");
  if (cache()[key]) return cache()[key];
  const body = products
    .map(
      (p) =>
        `### ${p.product_id}\nTitle: ${p.persian_title}\nLowest recorded price: ${p.min_price ?? "?"} toman, sellers: ${p.offer_count}\n` +
        (p.specs || [])
          .slice(0, 45)
          .map((s: Row) => `${s.key}: ${s.value}`)
          .join("\n"),
    )
    .join("\n\n");
  try {
    const r = await completion([{ role: "system", content: PROMPT }, { role: "user", content: body }], [], signal, () => {});
    const text = r.content || "";
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const ids = new Set(products.map((p) => p.product_id));
    const v: Verdict = {
      summary: String(j.summary || "").slice(0, 900),
      picks: (Array.isArray(j.picks) ? j.picks : []).filter((x: Row) => ids.has(x.product_id)).map((x: Row) => ({ product_id: x.product_id, best_for: String(x.best_for).slice(0, 120) })),
      differences: (Array.isArray(j.differences) ? j.differences : []).map(String).slice(0, 6),
      generated_at: now(),
    };
    if (!v.summary) return null;
    cache()[key] = v;
    save("verdicts");
    return v;
  } catch {
    return null;
  }
}
