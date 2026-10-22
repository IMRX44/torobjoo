import { z } from "zod";
import { cookies } from "next/headers";
import { AuthError, currentUser, login, logout, signup } from "@/lib/auth";
import { merge } from "@/lib/recs";
export const runtime = "nodejs";

const credentials = z.object({ name: z.string().min(1).max(40), password: z.string().min(1).max(100) });
// Brute-force brake: a few failed attempts per name per minute.
const failures = new Map<string, { at: number; count: number }>();

export async function GET(_: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "me") return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ user: await currentUser() });
}

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action === "logout") {
    await logout();
    return Response.json({ ok: true });
  }
  if (action !== "login" && action !== "signup") return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  let body: z.infer<typeof credentials>;
  try {
    body = credentials.parse(await request.json());
  } catch {
    return Response.json({ error: "نام و رمز را وارد کن." }, { status: 400 });
  }
  const key = body.name.trim().toLowerCase(),
    f = failures.get(key);
  if (f && Date.now() - f.at < 60000 && f.count >= 5)
    return Response.json({ error: "تلاش زیاد بود؛ یک دقیقه دیگر دوباره امتحان کن." }, { status: 429 });
  try {
    const user = action === "signup" ? await signup(body.name, body.password) : await login(body.name, body.password);
    failures.delete(key);
    // Keep what this device learned before signing in.
    const device = (await cookies()).get("tj_device")?.value;
    if (device) merge(device, user.id);
    return Response.json({ user });
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    failures.set(key, f && Date.now() - f.at < 60000 ? { ...f, count: f.count + 1 } : { at: Date.now(), count: 1 });
    return Response.json({ error: e.message }, { status: 400 });
  }
}
