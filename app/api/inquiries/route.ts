import { z } from "zod";
import { getCatalog } from "@/lib/catalog";
import { ask, offerStatus } from "@/lib/inquiries";
export const runtime = "nodejs";

// Buyer asks the shops behind up to 3 offers. Shared and rate-limited in lib/inquiries: a shop
// asked in the last few days is not messaged again, the existing answer is returned instead.
const ipBudget = new Map<string, { at: number; count: number }>();
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local",
    b0 = ipBudget.get(ip);
  if (b0 && Date.now() - b0.at < 3600000 && b0.count >= 30)
    return Response.json({ error: "در این ساعت سؤال زیادی فرستادی؛ کمی بعد دوباره امتحان کن." }, { status: 429 });
  ipBudget.set(ip, b0 && Date.now() - b0.at < 3600000 ? { ...b0, count: b0.count + 1 } : { at: Date.now(), count: 1 });
  try {
    const b = z.object({ offerIds: z.array(z.string().max(80)).min(1).max(3) }).parse(await request.json());
    const d = await getCatalog();
    const results = b.offerIds.map((id) => {
      const o = d.offer(id);
      if (!o) return { offerId: id, outcome: "invalid" };
      const r = ask(o, d.product(o.product_id)!, "buyer");
      return { offerId: id, outcome: r.outcome, ...offerStatus(id) };
    });
    return Response.json({ results });
  } catch {
    return Response.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
}
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 60);
  return Response.json(Object.fromEntries(ids.map((id) => [id, offerStatus(id)])));
}
