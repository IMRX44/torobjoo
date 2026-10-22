import { getCatalog, publicProduct } from "@/lib/catalog";
import { verdict } from "@/lib/verdict";
export const runtime = "nodejs";

// GET /api/compare?ids=a,b[,c,d]            → products with full specs
// GET /api/compare?ids=a,b&verdict=1        → plus the AI "which one for whom" summary
export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const d = await getCatalog();
  const ids = [...new Set((u.get("ids") || "").split(",").filter(Boolean))].slice(0, 4);
  const products = ids.map((id) => d.product(id)).filter(Boolean).map((p) => publicProduct(p!, true));
  if (products.length < 2) return Response.json({ error: "حداقل دو کالا لازم است." }, { status: 400 });
  if (u.get("verdict") === "1")
    return Response.json({ verdict: await verdict(products, AbortSignal.any([request.signal, AbortSignal.timeout(60000)])) });
  return Response.json({ products });
}
