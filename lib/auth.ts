import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { collection, save, now, id } from "./store";

export type User = { id: string; name: string; key: string; salt: string; hash: string; createdAt: string };
export type Seller = { shopId: string; salt: string; hash: string; createdAt: string };
type Session = { token: string; kind: "user" | "seller"; subject: string; expires: number };

const users = () => collection<User[]>("users", () => []);
const sellers = () => collection<Seller[]>("sellers", () => []);
const sessions = () => collection<Session[]>("sessions", () => []);
const DAY = 86400000;
const USER_COOKIE = "tj_user",
  SELLER_COOKIE = "tj_seller";

const hash = (password: string, salt: string) => scryptSync(password, salt, 32).toString("hex");
const verify = (password: string, salt: string, expected: string) => {
  const a = Buffer.from(hash(password, salt), "hex"),
    b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
// Names are compared case- and spacing-insensitively so «علی» and « علی » are one account.
export const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").replace(/[يى]/g, "ی").replace(/ك/g, "ک").toLowerCase();

export class AuthError extends Error {}

function startSession(kind: Session["kind"], subject: string) {
  const token = randomBytes(32).toString("hex");
  const list = sessions().filter((s) => s.expires > Date.now());
  list.push({ token, kind, subject, expires: Date.now() + 30 * DAY });
  sessions().splice(0, sessions().length, ...list);
  save("sessions");
  return token;
}
async function setCookie(name: string, token: string) {
  (await cookies()).set(name, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}
async function sessionFor(cookie: string, kind: Session["kind"]) {
  const token = (await cookies()).get(cookie)?.value;
  if (!token) return null;
  return sessions().find((s) => s.token === token && s.kind === kind && s.expires > Date.now()) || null;
}

export async function signup(name: string, password: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 30) throw new AuthError("نام باید بین ۲ تا ۳۰ حرف باشد.");
  if (password.length < 4) throw new AuthError("رمز باید حداقل ۴ کاراکتر باشد.");
  if (users().some((u) => u.key === nameKey(clean))) throw new AuthError("این نام قبلاً ثبت شده؛ وارد شو یا نام دیگری انتخاب کن.");
  const salt = randomBytes(16).toString("hex");
  const user: User = { id: id("user"), name: clean, key: nameKey(clean), salt, hash: hash(password, salt), createdAt: now() };
  users().push(user);
  save("users");
  await setCookie(USER_COOKIE, startSession("user", user.id));
  return publicUser(user);
}
export async function login(name: string, password: string) {
  const user = users().find((u) => u.key === nameKey(name));
  if (!user || !verify(password, user.salt, user.hash)) throw new AuthError("نام یا رمز درست نیست.");
  await setCookie(USER_COOKIE, startSession("user", user.id));
  return publicUser(user);
}
export async function logout() {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  const list = sessions();
  const i = list.findIndex((s) => s.token === token);
  if (i >= 0) {
    list.splice(i, 1);
    save("sessions");
  }
  (await cookies()).delete(USER_COOKIE);
}
export const publicUser = (u: User) => ({ id: u.id, name: u.name, createdAt: u.createdAt });
export async function currentUser() {
  const s = await sessionFor(USER_COOKIE, "user");
  const u = s && users().find((x) => x.id === s.subject);
  return u ? publicUser(u) : null;
}

// Sellers sign in to the shop they manage. In this demo the first sign-in for a shop sets its
// password ("claiming" it); a real deployment would verify ownership (e.g. a code sent by SMS).
export async function sellerLogin(shopId: string, password: string, exists: (id: string) => boolean) {
  if (!exists(shopId)) throw new AuthError("فروشگاه پیدا نشد.");
  if (password.length < 4) throw new AuthError("رمز باید حداقل ۴ کاراکتر باشد.");
  let seller = sellers().find((s) => s.shopId === shopId);
  if (!seller) {
    const salt = randomBytes(16).toString("hex");
    seller = { shopId, salt, hash: hash(password, salt), createdAt: now() };
    sellers().push(seller);
    save("sellers");
  } else if (!verify(password, seller.salt, seller.hash)) throw new AuthError("رمز این فروشگاه درست نیست.");
  await setCookie(SELLER_COOKIE, startSession("seller", shopId));
  return { shopId, claimed: true };
}
export async function sellerLogout() {
  (await cookies()).delete(SELLER_COOKIE);
}
export async function currentSeller() {
  const s = await sessionFor(SELLER_COOKIE, "seller");
  return s ? s.subject : null;
}
export const isClaimed = (shopId: string) => sellers().some((s) => s.shopId === shopId);
