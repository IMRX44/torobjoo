import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { deleteChat, getChat, putChat } from "@/lib/chats";
export const runtime = "nodejs";

const idSchema = z.string().regex(/^[\w-]{8,64}$/);
const body = z.object({ title: z.string().max(80).default("گفت‌وگوی تازه"), state: z.record(z.any()) });

async function context(params: Promise<{ id: string }>) {
  const user = await currentUser();
  const { id } = await params;
  return { user, id: idSchema.safeParse(id).success ? id : null };
}
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, id } = await context(params);
  if (!user || !id) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const chat = getChat(user.id, id);
  return chat ? Response.json(chat) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, id } = await context(params);
  if (!user) return Response.json({ error: "SIGN_IN_REQUIRED" }, { status: 401 });
  if (!id) return Response.json({ error: "INVALID_ID" }, { status: 400 });
  try {
    const b = body.parse(await request.json());
    const chat = putChat(user.id, id, b.title, b.state);
    return Response.json({ id: chat.id, updatedAt: chat.updatedAt });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "INVALID" }, { status: 400 });
  }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, id } = await context(params);
  if (!user || !id) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: deleteChat(user.id, id) });
}
