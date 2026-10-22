import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { currentUser } from "./auth";

// Whose interests a request contributes to: the account when signed in, otherwise an anonymous
// device id. Incognito requests (header x-incognito: 1) have no profile at all.
export async function profileFor(request: Request, create = false) {
  if (request.headers.get("x-incognito") === "1") return null;
  const user = await currentUser();
  if (user) return { key: user.id, user };
  const jar = await cookies();
  let device = jar.get("tj_device")?.value;
  if (!device && create) {
    device = "dev_" + randomBytes(12).toString("hex");
    jar.set("tj_device", device, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  }
  return device ? { key: device, user: null } : null;
}
