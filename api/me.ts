import { json, readSessionCookie, verifySession } from "../server/auth.js";

export async function GET(request: Request): Promise<Response> {
  const user = await verifySession(readSessionCookie(request));
  return user ? json({ user }) : json({ error: "Not logged in" }, 401);
}
