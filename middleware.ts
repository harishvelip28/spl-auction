import { next } from "@vercel/functions";
import { readSessionCookie, verifySession } from "./server/auth.js";

// Paths reachable without logging in.
const PUBLIC_PATHS = new Set(["/login.html", "/api/login", "/favicon.svg"]);

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const user = await verifySession(readSessionCookie(request));

  if (url.pathname === "/login.html" && user) return Response.redirect(new URL("/", url), 302);
  if (PUBLIC_PATHS.has(url.pathname) || user) return next();

  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const login = new URL("/login.html", url);
  if (url.pathname !== "/") login.searchParams.set("next", url.pathname + url.search);
  return Response.redirect(login, 302);
}
