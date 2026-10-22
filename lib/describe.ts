import "server-only";
import { collection, save, now } from "./store";
import { completion } from "./agent/provider";
import type { Row } from "./shopping";

// Reader-friendly product write-ups, generated once per product from its own title and specs
// and cached. The model is told to use only those facts; when specs are thin it says so
// instead of guessing.
export type Description = {
  intro: string;
  highlights: string[];
  good_for: string[];
  consider: string[];
  checklist: string[];
  generated_at: string;
  source: "ai" | "specs";
};
const cache = () => collection<Record<string, Description>>("descriptions", () => ({}));
const inflight = new Map<string, Promise<Description>>();

const PROMPT = `You write product descriptions for «ترب‌جو», a Persian price-comparison site for buying in physical shops in Tehran.
Write in fluent, natural Persian for a normal shopper. Use ONLY facts in the title and specs below; never invent numbers, features, compatibility or warranty. If specs are few, keep sections short and general (how to choose/check this kind of product) and do not pretend to know more.
Return ONLY JSON:
{"intro": "3-5 sentences: what it is, its main characteristics from the specs, and for whom it fits",
 "highlights": ["4-7 short bullet facts drawn from the specs, each with the actual value"],
 "good_for": ["2-4 kinds of users or uses it suits"],
 "consider": ["2-4 honest limitations or things to compare (only if supported by specs or common sense for the category)"],
 "checklist": ["4-6 things to check in the shop before paying for THIS kind of product (seal, model code, warranty card, test, invoice…)"]}`;

function fromSpecs(p: Row, specs: Row[]): Description {
  const facts = specs.filter((s) => s.value != null && String(s.value).length < 80).slice(0, 7);
  return {
    intro: `${p.persian_title}${p.brand_name ? ` از برند ${p.brand_name}` : ""} در دستهٔ «${p.category_name}» است.${facts.length ? " مهم‌ترین مشخصات ثبت‌شده‌اش را پایین می‌بینی." : " مشخصات زیادی برای این کالا ثبت نشده؛ پیش از خرید جزئیات را از فروشنده بپرس."}`,
    highlights: facts.map((s) => `${s.key}: ${s.value}`),
    good_for: [],
    consider: [],
    checklist: ["سالم بودن بسته‌بندی و پلمب", "تطبیق مدل و کد کالا با فاکتور", "شرایط و مدت گارانتی", "تست کالا پیش از پرداخت", "دریافت فاکتور با نام فروشگاه"],
    generated_at: now(),
    source: "specs",
  };
}

export async function describe(p: Row, specs: Row[], signal?: AbortSignal): Promise<Description> {
  const hit = cache()[p.product_id];
  if (hit) return hit;
  if (inflight.has(p.product_id)) return inflight.get(p.product_id)!;
  const job = (async () => {
    try {
      const facts = specs.slice(0, 60).map((s) => `${s.section ? s.section + " › " : ""}${s.key}: ${s.value}`).join("\n");
      const result = await completion(
        [
          { role: "system", content: PROMPT },
          { role: "user", content: `Title: ${p.persian_title}\nBrand: ${p.brand_name || "-"}\nCategory: ${p.category_name}\nSpecs:\n${facts || "(none)"}` },
        ],
        [],
        signal ?? AbortSignal.timeout(60000),
        () => {},
      );
      const text = result.content || "";
      const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, n) : []);
      const d: Description = {
        intro: String(j.intro || "").slice(0, 1200),
        highlights: list(j.highlights, 8),
        good_for: list(j.good_for, 5),
        consider: list(j.consider, 5),
        checklist: list(j.checklist, 7),
        generated_at: now(),
        source: "ai",
      };
      if (!d.intro) throw Error("EMPTY");
      cache()[p.product_id] = d;
      save("descriptions");
      return d;
    } catch {
      return fromSpecs(p, specs); // not cached: a later visit can still get the AI version
    } finally {
      inflight.delete(p.product_id);
    }
  })();
  inflight.set(p.product_id, job);
  return job;
}
