"use client";
import type { Row } from "@/lib/shopping";

// Where a conversation lives: the account (server) when signed in, this device for guests,
// nowhere in incognito.
export type ChatMeta = { id: string; title: string; createdAt: string; updatedAt: string };
const INDEX = "tj-chats",
  ITEM = (id: string) => "tj-chat-" + id;
const local = {
  list(): ChatMeta[] {
    try {
      return JSON.parse(localStorage.getItem(INDEX) || "[]");
    } catch {
      return [];
    }
  },
  get(id: string): Row | null {
    try {
      return JSON.parse(localStorage.getItem(ITEM(id)) || "null");
    } catch {
      return null;
    }
  },
  put(meta: ChatMeta, state: Row) {
    try {
      localStorage.setItem(ITEM(meta.id), JSON.stringify(state));
      const list = local.list().filter((c) => c.id !== meta.id);
      list.unshift(meta);
      for (const old of list.splice(80)) localStorage.removeItem(ITEM(old.id));
      localStorage.setItem(INDEX, JSON.stringify(list));
    } catch {}
  },
  remove(id: string) {
    try {
      localStorage.removeItem(ITEM(id));
      localStorage.setItem(INDEX, JSON.stringify(local.list().filter((c) => c.id !== id)));
    } catch {}
  },
};

export async function listChats(signedIn: boolean): Promise<ChatMeta[]> {
  if (!signedIn) return local.list();
  try {
    const r = await fetch("/api/chats");
    return (await r.json()).chats || [];
  } catch {
    return [];
  }
}
export async function loadChat(signedIn: boolean, id: string): Promise<Row | null> {
  if (!signedIn) return local.get(id);
  const r = await fetch(`/api/chats/${id}`);
  return r.ok ? (await r.json()).state : null;
}
export async function storeChat(signedIn: boolean, meta: ChatMeta, state: Row) {
  if (!signedIn) return local.put(meta, state);
  await fetch(`/api/chats/${meta.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: meta.title, state }),
  });
}
export async function removeChat(signedIn: boolean, id: string) {
  if (!signedIn) return local.remove(id);
  await fetch(`/api/chats/${id}`, { method: "DELETE" });
}

/** «امروز»، «دیروز»، «۷ روز گذشته»، «۳۰ روز گذشته»، or the month name. */
export function groupLabel(iso: string) {
  const d = new Date(iso),
    now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86400000);
  if (days <= 0) return "امروز";
  if (days === 1) return "دیروز";
  if (days < 7) return "۷ روز گذشته";
  if (days < 30) return "۳۰ روز گذشته";
  return new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric" }).format(d);
}
