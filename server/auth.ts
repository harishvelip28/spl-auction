/* ═══════════════════════════════════════════════════════════════════
   AUTH HELPERS — shared by middleware.ts and api/*.ts

   Env vars:
     AUCTION_USERS  comma-separated "username:password" pairs
                    e.g. "harish:s3cret,rahul:another-pass"
     AUTH_SECRET    long random string used to sign session cookies
═══════════════════════════════════════════════════════════════════ */

export const SESSION_COOKIE = "spl_session";
const SESSION_TTL = 60 * 60 * 12; // 12 hours

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET env var is missing or shorter than 16 characters");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

// Compare via HMAC digests so timing doesn't leak length or content.
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmac(a), hmac(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function users(): { name: string; pass: string }[] {
  return (process.env.AUCTION_USERS ?? "")
    .split(",")
    .map(pair => {
      const i = pair.indexOf(":");
      return i > 0 ? { name: pair.slice(0, i).trim(), pass: pair.slice(i + 1).trim() } : null;
    })
    .filter((u): u is { name: string; pass: string } => !!u && !!u.name && !!u.pass);
}

/** Returns the canonical username when credentials match, else null. */
export async function checkCredentials(username: string, password: string): Promise<string | null> {
  const u = users().find(x => x.name.toLowerCase() === username.trim().toLowerCase());
  if (!u) { await safeEqual(password, "dummy-password"); return null; }
  return (await safeEqual(password, u.pass)) ? u.name : null;
}

export async function createSession(user: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })));
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the username for a valid, unexpired session token, else null. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !(await safeEqual(sig, await hmac(payload)))) return null;
  try {
    const { u, exp } = JSON.parse(fromB64url(payload)) as { u: string; exp: number };
    if (typeof u !== "string" || typeof exp !== "number" || exp < Date.now() / 1000) return null;
    // Reject sessions for users that have since been removed from AUCTION_USERS.
    return users().some(x => x.name === u) ? u : null;
  } catch {
    return null;
  }
}

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=");
  }
  return undefined;
}

export function sessionCookie(request: Request, token: string | null): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const value = token ?? "";
  const maxAge = token ? SESSION_TTL : 0;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}
