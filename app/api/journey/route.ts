import { z } from "zod";
import { getCatalog } from "@/lib/catalog";
import { intentSchema, validOffers } from "@/lib/agent/contracts";
import { ask } from "@/lib/inquiries";
import { distance } from "@/lib/shopping";
import { offerView } from "@/lib/agent/tools";
export const runtime = "nodejs";
const schema = z.object({
  productId: z.string().max(80),
  anchorId: z.string().max(80),
  excluded: z.array(z.string().max(80)).max(100),
  intent: intentSchema,
});
export async function POST(request: Request) {
  try {
    const b = schema.parse(await request.json()),
      d = await getCatalog(),
      p = d.product(b.productId);
    if (!p) return Response.json({ error: "محصول پیدا نشد" }, { status: 404 });
    const anchor = d.offer(b.anchorId);
    if (!anchor || anchor.product_id !== b.productId)
      return Response.json({ error: "فروشنده پیدا نشد" }, { status: 400 });
    const offers = validOffers(p, d, b.intent)
      .filter(
        (o) =>
          o.offer_id !== b.anchorId && !b.excluded.includes(String(o.offer_id)),
      )
      .sort(
        (a, b) =>
          Number(b.hub_id === anchor.hub_id) -
            Number(a.hub_id === anchor.hub_id) ||
          distance(anchor, a) - distance(anchor, b),
      );
    const offer = offers[0];
    if (!offer)
      return Response.json({
        empty: true,
        message:
          "جایگزین مطابق در این محدوده نداریم؛ بودجه و شعاع تغییری نکرده‌اند.",
      });
    const shop = d.shop(offer.shop_id);
    // The buyer found the first shop out of stock: ask the backup shop (shared, rate-limited).
    const r = ask(offer, p, "stock");
    const q = r.inquiry;
    return Response.json({
      reply: {
        id: q?.id || offer.offer_id,
        offerId: offer.offer_id,
        productId: p.product_id,
        shopId: offer.shop_id,
        shopName: shop?.name,
        title: p.persian_title,
        question: q?.question,
        state: q?.status === "answered" ? "replied" : r.outcome === "rate_limited" ? "rate_limited" : "pending",
        availability: q?.answer ? (q.answer.available === false ? "unavailable" : q.answer.available ? "available" : "no_response") : undefined,
        timestamp: q?.answeredAt || q?.createdAt || new Date().toISOString(),
        isSimulated: !!q?.answer?.simulated,
      },
      offer: offerView(d, offer, b.intent),
      sameHub: offer.hub_id === anchor.hub_id,
      distance: distance(anchor, offer),
    });
  } catch (e) {
    return Response.json(
      { error: "بررسی جایگزین انجام نشد؛ دوباره تلاش کنید." },
      { status: e instanceof z.ZodError ? 400 : 503 },
    );
  }
}
