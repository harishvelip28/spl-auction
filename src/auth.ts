/* ═══════════════════════════════════════════════════════════════════
   CLIENT-SIDE LOGIN

   Members come from the VITE_AUCTION_USERS env var at build time:
     VITE_AUCTION_USERS="harish:pass1,rahul:pass2"
   Note: the list is bundled into the JS, so this keeps casual visitors
   out but is not strong security.
═══════════════════════════════════════════════════════════════════ */

const SESSION_KEY = "auction-session-v1";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function users(): { name: string; pass: string }[] {
  return String(import.meta.env.VITE_AUCTION_USERS ?? "")
    .split(",")
    .map(pair => {
      const i = pair.indexOf(":");
      return i > 0 ? { name: pair.slice(0, i).trim(), pass: pair.slice(i + 1).trim() } : null;
    })
    .filter((u): u is { name: string; pass: string } => !!u && !!u.name && !!u.pass);
}

export const hasUsers = () => users().length > 0;

/** Returns the canonical username when credentials match, else null. */
export function login(username: string, password: string): string | null {
  const u = users().find(x => x.name.toLowerCase() === username.trim().toLowerCase());
  if (!u || u.pass !== password) return null;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ u: u.name, exp: Date.now() + SESSION_TTL_MS })); } catch { /* session just won't persist */ }
  return u.name;
}

export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* nothing to clear */ }
}

/** Returns the logged-in username if the saved session is valid, else null. */
export function currentUser(): string | null {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    if (!s) return null;
    const { u, exp } = JSON.parse(s) as { u: string; exp: number };
    // Drop expired sessions and users removed from the member list.
    if (exp < Date.now() || !users().some(x => x.name === u)) { logout(); return null; }
    return u;
  } catch {
    return null;
  }
}
