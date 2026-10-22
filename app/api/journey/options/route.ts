import { z } from "zod";
import { getCatalog } from "@/lib/catalog";
import { intentSchema } from "@/lib/agent/contracts";
import { journeyOptions } from "@/lib/journey";
export const runtime = "nodejs";
const schema = z.object({
  productId: z.string().max(80),
  intent: intentSchema,
  inquiries: z.array(z.record(z.any())).max(60).default([]),
  excluded: z.array(z.string().max(80)).max(100).default([]),
  anchorId: z.string().max(80).optional(),
});
// Primary destination + nearby backups for one product, computed on the server.
export async function POST(request: Request) {
  try {
    const b = schema.parse(await request.json());
    const journey = journeyOptions(await getCatalog(), b.productId, b.intent, b.inquiries, b.excluded, b.anchorId);
    return journey
      ? Response.json(journey)
      : Response.json({ error: "محصول پیدا نشد" }, { status: 404 });
  } catch (e) {
    return Response.json(
      { error: "مسیر آماده نشد؛ دوباره تلاش کنید." },
      { status: e instanceof z.ZodError ? 400 : 503 },
    );
  }
}
