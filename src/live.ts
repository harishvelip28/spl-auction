/* ═══════════════════════════════════════════════════════════════════
   LIVE OWNER VIEW SYNC (Firebase Realtime Database)

   The console publishes a public snapshot of the auction to
   live/<id>; team owners open /#live/<id> on their phones and follow it.
   The snapshot never includes mobile numbers.

   Setup: create a Firebase project, add a Realtime Database, enable
   Anonymous sign-in, paste the rules from FIREBASE_RULES below, then set
   the VITE_FIREBASE_* variables (see .env.example) and redeploy.
═══════════════════════════════════════════════════════════════════ */
import type { ActivityEntry, AuctionConfig, Bid, Player, RulesConfig, Status, Team } from "./types";

const env = import.meta.env;
const FB = {
  apiKey:      String(env.VITE_FIREBASE_API_KEY ?? ""),
  databaseURL: String(env.VITE_FIREBASE_DATABASE_URL ?? ""),
  projectId:   String(env.VITE_FIREBASE_PROJECT_ID ?? ""),
  appId:       String(env.VITE_FIREBASE_APP_ID ?? ""),
};
export const liveConfigured = () => !!(FB.apiKey && FB.databaseURL && FB.projectId);

/** Realtime Database rules: anyone with the link can read; only the console that created it can write. */
export const FIREBASE_RULES = `{
  "rules": {
    "live": {
      "$id": {
        ".read": true,
        ".write": "auth != null && (!data.exists() || data.child('owner').val() === auth.uid)",
        ".validate": "!newData.exists() || newData.child('owner').val() === auth.uid"
      }
    }
  }
}`;

// ── Snapshot shape ────────────────────────────────────────────────────
export interface LivePlayer {
  serialNo: number; name: string; role: string; batting: string; bowling: string; photo: string;
  city: string; state: string; basePrice: number; currentBid: number; status: Status;
  soldTo?: string; soldPrice?: number; availabilityUncertain?: boolean;
}
export interface LiveTeam { name: string; color: string; purse: number; players: { serialNo: number; name: string; role: string; soldPrice: number }[]; }
export interface LiveSnapshot {
  owner: string;
  updatedAt: number;
  league: AuctionConfig["league"];
  rules: Pick<RulesConfig, "totalPurse" | "minPlayers" | "maxPlayers" | "defaultBasePrice" | "bidStep" | "bidTiers">;
  teams: LiveTeam[];
  player: LivePlayer | null;
  bids: Bid[];
  going: 0 | 1 | 2;
  counts: { sold: number; unsold: number; remaining: number };
  recent: ActivityEntry[];
}

export function buildSnapshot(config: AuctionConfig, s: {
  players: Player[]; teams: Team[]; cur: number; bids: Bid[]; going: 0 | 1 | 2; activity: ActivityEntry[];
}): Omit<LiveSnapshot, "owner" | "updatedAt"> {
  const p = s.players[s.cur];
  const r = config.rules;
  return {
    league: config.league,
    rules: { totalPurse: r.totalPurse, minPlayers: r.minPlayers, maxPlayers: r.maxPlayers ?? 0, defaultBasePrice: r.defaultBasePrice, bidStep: r.bidStep, bidTiers: r.bidTiers ?? [] },
    teams: s.teams.map(t => ({
      name: t.name, color: t.color, purse: t.purse,
      players: t.players.map(x => ({ serialNo: x.serialNo, name: x.name, role: x.role, soldPrice: x.soldPrice ?? x.currentBid })),
    })),
    player: p ? {
      serialNo: p.serialNo, name: p.name, role: p.role, batting: p.batting, bowling: p.bowling, photo: p.photo,
      city: p.city, state: p.state, basePrice: p.basePrice, currentBid: p.currentBid, status: p.status,
      soldTo: p.soldTo, soldPrice: p.soldPrice, availabilityUncertain: p.availabilityUncertain,
    } : null,
    bids: s.bids.slice(-12),
    going: s.going,
    counts: {
      sold: s.players.filter(x => x.status === "sold").length,
      unsold: s.players.filter(x => x.status === "unsold").length,
      remaining: s.players.filter(x => x.status === "available").length,
    },
    recent: s.activity.slice(0, 5),
  };
}

/** Firebase drops empty arrays and rejects `undefined`: put the defaults back after reading. */
function normalise(v: Partial<LiveSnapshot> | null): LiveSnapshot | null {
  if (!v || !v.league || !v.rules) return null;
  return {
    owner: v.owner ?? "", updatedAt: v.updatedAt ?? 0, league: v.league,
    rules: { ...v.rules, bidTiers: v.rules.bidTiers ?? [] },
    teams: (v.teams ?? []).map(t => ({ ...t, players: t.players ?? [] })),
    player: v.player ?? null,
    bids: v.bids ?? [],
    going: v.going ?? 0,
    counts: v.counts ?? { sold: 0, unsold: 0, remaining: 0 },
    recent: v.recent ?? [],
  };
}

// ── Firebase (loaded on demand so the console stays light when sharing is off) ──
let fbPromise: Promise<{
  db: import("firebase/database").Database;
  dbm: typeof import("firebase/database");
  auth: import("firebase/auth").Auth;
  authm: typeof import("firebase/auth");
}> | null = null;

function firebase() {
  if (!liveConfigured()) return Promise.reject(new Error("Firebase is not configured (VITE_FIREBASE_* variables)."));
  fbPromise ??= (async () => {
    const [{ initializeApp }, dbm, authm] = await Promise.all([import("firebase/app"), import("firebase/database"), import("firebase/auth")]);
    const app = initializeApp({ ...FB, authDomain: `${FB.projectId}.firebaseapp.com`, appId: FB.appId || undefined });
    return { db: dbm.getDatabase(app), dbm, auth: authm.getAuth(app), authm };
  })();
  return fbPromise;
}

/** Console: replace the published snapshot. Signs in anonymously the first time. */
export async function publish(id: string, snap: Omit<LiveSnapshot, "owner" | "updatedAt">) {
  const { db, dbm, auth, authm } = await firebase();
  if (!auth.currentUser) await authm.signInAnonymously(auth);
  const clean = JSON.parse(JSON.stringify(snap)) as typeof snap;   // strips undefined fields
  await dbm.set(dbm.ref(db, `live/${id}`), { ...clean, owner: auth.currentUser!.uid, updatedAt: dbm.serverTimestamp() });
}

/** Console: take the link down (owners see "not live"). */
export async function unpublish(id: string) {
  const { db, dbm, auth, authm } = await firebase();
  if (!auth.currentUser) await authm.signInAnonymously(auth);
  await dbm.remove(dbm.ref(db, `live/${id}`));
}

/** Phone: follow a live auction. `null` means the link isn't live (never started or stopped). */
export function subscribe(id: string, on: {
  data: (s: LiveSnapshot | null) => void;
  connected: (c: boolean) => void;
  error: (msg: string) => void;
}): () => void {
  let stop = () => {};
  let cancelled = false;
  firebase().then(({ db, dbm }) => {
    if (cancelled) return;
    const offData = dbm.onValue(dbm.ref(db, `live/${id}`), snap => on.data(normalise(snap.val())), e => on.error(e.message));
    const offConn = dbm.onValue(dbm.ref(db, ".info/connected"), snap => on.connected(snap.val() === true));
    stop = () => { offData(); offConn(); };
  }).catch(e => on.error((e as Error).message));
  return () => { cancelled = true; stop(); };
}

// ── Console's sharing state (which link, on/off) ─────────────────────
const SHARE_KEY = "auction-live-share-v1";
export interface ShareState { id: string; on: boolean; }
export const newLiveId = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, x => (x % 36).toString(36)).join("");
};
export const rdShare = (): ShareState | null => {
  try { const s = localStorage.getItem(SHARE_KEY); return s ? JSON.parse(s) as ShareState : null; } catch { return null; }
};
export const wrShare = (s: ShareState) => { try { localStorage.setItem(SHARE_KEY, JSON.stringify(s)); } catch { /* sharing still works this session */ } };
export const liveUrl = (id: string) => `${window.location.origin}${window.location.pathname}#live/${id}`;
