import { z } from "zod";
import { getCatalog } from "@/lib/catalog";
import { AuthError, currentSeller, isClaimed, sellerLogin, sellerLogout } from "@/lib/auth";
import { answer, inquiriesForShop, setPrice } from "@/lib/inquiries";
import { competition, myOffers, shopStats, shopSummary } from "@/lib/seller";
import { sellerAssistant } from "@/lib/agent/seller-agent";
import { ProviderError } from "@/lib/agent/provider";
import { norm } from "@/lib/shopping";
export const runtime = "nodejs";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const priceSchema = z.number().int().positive().max(1e11).nullable();

export async function GET(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const u = new URL(request.url).searchParams;
  const d = await getCatalog();
  if (action === "shops") {
    // Sign-in picker: find your shop by name or address.
    const q = norm(u.get("q") || "");
    if (q.length < 2) return json([]);
    return json(
      d.shops
        .filter((s) => norm(s.name + " " + (s.address || "")).includes(q))
        .slice(0, 12)
        .map((s) => ({ shop_id: s.shop_id, name: s.name, address: s.address, claimed: isClaimed(s.shop_id) })),
    );
  }
  const shopId = await currentSeller();
  if (action === "me") return json({ shop: shopId ? shopSummary(d, shopId) : null });
  if (!shopId) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  if (action === "inbox") return json(inquiriesForShop(shopId).slice(0, 200));
  if (action === "offers") {
    const list = myOffers(d, shopId, u.get("q") || "", u.get("filter") || "");
    const offset = Number(u.get("offset")) || 0;
    return json({ total: list.length, items: list.slice(offset, offset + 30) });
  }
  if (action === "stats") return json(shopStats(d, shopId));
  return json({ error: "NOT_FOUND" }, 404);
}

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const d = await getCatalog();
  if (action === "login") {
    try {
      const b = z.object({ shopId: z.string().max(80), password: z.string().max(100) }).parse(await request.json());
      await sellerLogin(b.shopId, b.password, (id) => !!d.shop(id));
      return json({ shop: shopSummary(d, b.shopId) });
    } catch (e) {
      return json({ error: e instanceof AuthError ? e.message : "اطلاعات ورود کامل نیست." }, 400);
    }
  }
  if (action === "logout") {
    await sellerLogout();
    return json({ ok: true });
  }
  const shopId = await currentSeller();
  if (!shopId) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  try {
    if (action === "answer") {
      const b = z
        .object({ inquiryId: z.string().max(60), available: z.boolean().nullable(), price: priceSchema.optional(), note: z.string().max(300).optional() })
        .parse(await request.json());
      const q = answer(b.inquiryId, shopId, { available: b.available, price: b.price ?? null, note: b.note });
      return q ? json(q) : json({ error: "NOT_FOUND" }, 404);
    }
    if (action === "price") {
      const b = z.object({ offerId: z.string().max(80), price: priceSchema, available: z.boolean().nullable() }).parse(await request.json());
      const o = d.offer(b.offerId);
      if (!o || o.shop_id !== shopId) return json({ error: "NOT_YOUR_OFFER" }, 403);
      setPrice(b.offerId, b.price, b.available);
      return json(competition(d, o));
    }
    if (action === "assistant") return json(await sellerAssistant(d, shopId, await request.json(), request.signal));
  } catch (e) {
    if (e instanceof ProviderError) return json({ error: "دستیار الان در دسترس نیست؛ کمی بعد دوباره امتحان کن." }, 503);
    return json({ error: "درخواست نامعتبر است." }, 400);
  }
  return json({ error: "NOT_FOUND" }, 404);
}
