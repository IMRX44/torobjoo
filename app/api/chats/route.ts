import { currentUser } from "@/lib/auth";
import { listChats } from "@/lib/chats";
export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ chats: [], signedIn: false });
  return Response.json({ chats: listChats(user.id), signedIn: true });
}
