import { checkCredentials, createSession, json, sessionCookie } from "../server/auth.js";

export async function POST(request: Request): Promise<Response> {
  let body: { username?: unknown; password?: unknown };
  try { body = (await request.json()) as typeof body; } catch { return json({ error: "Invalid request" }, 400); }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return json({ error: "Enter username and password" }, 400);

  const user = await checkCredentials(username, password);
  if (!user) return json({ error: "Invalid username or password" }, 401);

  return json({ user }, 200, { "set-cookie": sessionCookie(request, await createSession(user)) });
}
