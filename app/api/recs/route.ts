import { getCatalog } from "@/lib/catalog";
import { profileFor } from "@/lib/profile";
import { recommend } from "@/lib/recs";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const lat = Number(u.get("lat")) || undefined,
    lon = Number(u.get("lon")) || undefined;
  const profile = await profileFor(request);
  const result = recommend(await getCatalog(), profile?.key ?? null, { lat, lon }, Math.min(48, Number(u.get("limit")) || 24));
  return Response.json(result);
}
