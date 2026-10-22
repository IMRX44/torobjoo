import { getCatalog } from "@/lib/catalog";
import { health } from "@/lib/agent/provider";
export const runtime = "nodejs";

// Readiness probe for Docker/load balancers: 200 once the catalog is in memory.
export async function GET() {
  try {
    const d = await getCatalog();
    return Response.json({ ok: true, products: d.products.length, offers: d.offers.length, builtAt: d.meta.builtAt, llm: health() });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "CATALOG" }, { status: 503 });
  }
}
