import "server-only";
import { collection, save, now } from "./store";
import type { Row } from "./shopping";

// Chat transcripts of signed-in users. The browser sends the whole conversation state after
// each answer; the server keeps it so history follows the account across devices.
export type Chat = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  state: Row; // { turns, intent, selected, resultIds, inquiries }
};
const chats = () => collection<Chat[]>("chats", () => []);
const MAX_BYTES = 600_000,
  MAX_CHATS = 300;

export const listChats = (userId: string) =>
  chats()
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }));
export const getChat = (userId: string, id: string) => chats().find((c) => c.userId === userId && c.id === id) || null;

export function putChat(userId: string, id: string, title: string, state: Row) {
  if (JSON.stringify(state).length > MAX_BYTES) throw Error("CHAT_TOO_LARGE");
  let chat = getChat(userId, id);
  if (!chat) {
    // Ids come from the browser; refuse one that already belongs to someone else.
    if (chats().some((c) => c.id === id)) throw Error("CHAT_ID_TAKEN");
    chat = { id, userId, title, createdAt: now(), updatedAt: now(), state };
    chats().push(chat);
    const mine = chats().filter((c) => c.userId === userId);
    if (mine.length > MAX_CHATS) {
      const oldest = mine.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
      chats().splice(chats().indexOf(oldest), 1);
    }
  } else {
    chat.title = title || chat.title;
    chat.state = state;
    chat.updatedAt = now();
  }
  save("chats");
  return chat;
}
export function deleteChat(userId: string, id: string) {
  const i = chats().findIndex((c) => c.userId === userId && c.id === id);
  if (i < 0) return false;
  chats().splice(i, 1);
  save("chats");
  return true;
}
