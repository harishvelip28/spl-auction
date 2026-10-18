import { json, sessionCookie } from "../server/auth.js";

export function POST(request: Request): Response {
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(request, null) });
}
