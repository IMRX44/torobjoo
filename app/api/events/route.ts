import { z } from "zod";
import { getCatalog } from "@/lib/catalog";
import { profileFor } from "@/lib/profile";
import { record } from "@/lib/recs";
export const runtime = "nodejs";

const signal = z.object({
  type: z.enum(["view", "dwell", "search", "chat", "save", "click", "compare"]),
  productId: z.string().max(80).optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(60).optional(),
  price: z.number().nonnegative().optional(),
  query: z.string().max(120).optional(),
  ms: z.number().nonnegative().max(3_600_000).optional(),
});
// Interest signals from the browser (views, active reading time, searches). Ignored in incognito.
export async function POST(request: Request) {
  const profile = await profileFor(request, true);
  if (!profile) return Response.json({ ok: true, recorded: 0 });
  try {
    const { signals } = z.object({ signals: z.array(signal).max(50) }).parse(await request.json());
    record(profile.key, signals as Parameters<typeof record>[1], await getCatalog());
    return Response.json({ ok: true, recorded: signals.length });
  } catch {
    return Response.json({ error: "INVALID" }, { status: 400 });
  }
}
