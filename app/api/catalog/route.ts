import { getCatalog } from "@/lib/catalog";
export const runtime = "nodejs";
// Summary only: the full catalog is far too large to send to the browser; use /api/search etc.
export async function GET() {
  try {
    const d = await getCatalog();
    return Response.json({ meta: d.meta, hubs: d.hubs, categories: d.categories.slice(0, 40) });
  } catch {
    return Response.json({ error: "دریافت داده‌ها انجام نشد؛ دوباره تلاش کنید." }, { status: 503 });
  }
}
