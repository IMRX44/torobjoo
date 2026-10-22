import { getCatalog } from "@/lib/catalog";
import { describe } from "@/lib/describe";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  const d = await getCatalog();
  const p = d.product(id);
  if (!p) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json(await describe(p, d.details(p).specs, AbortSignal.any([request.signal, AbortSignal.timeout(60000)])));
}
