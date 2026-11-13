import type { Player, Team, ColumnMap, RulesConfig, Bid } from "./types";

export const fmt = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
export const getInitials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

function driveId(url: string) {
  for (const p of [/\/file\/d\/([a-zA-Z0-9_-]{10,})/, /[?&]id=([a-zA-Z0-9_-]{10,})/, /\/open\?id=([a-zA-Z0-9_-]{10,})/]) {
    const m = url.match(p); if (m) return m[1];
  }
  return "";
}
export function driveUrls(raw: string): string[] {
  if (!raw?.trim()) return [];
  const id = driveId(raw);
  if (id) return [
    `https://drive.google.com/thumbnail?id=${id}&sz=w400`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    `https://lh3.googleusercontent.com/d/${id}=w400`,
  ];
  return [raw];
}
function parseRow(row: string): string[] {
  const r: string[] = []; let cur = "", q = false;
  for (const ch of row) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { r.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  r.push(cur.trim()); return r;
}
function isUncertain(raw: string) {
  const v = raw.trim().toLowerCase();
  if (!v) return false;
  // Short tokens must match exactly (or lead the answer) — a substring check on "y" would flag "No, I'll play".
  if (["yes","y","true","1"].includes(v) || /^yes\b/.test(v)) return true;
  return ["maybe","uncertain","tentative","may or may not","may/may not","not sure"].some(f => v.includes(f));
}
export function normPlayer(p: Partial<Player>, serial: number, minBase = 300): Player {
  const bp = Math.max(minBase, Number(p.basePrice) || minBase);
  return {
    serialNo: Number(p.serialNo) || serial, name: p.name?.trim() || "Unknown",
    role: p.role || "Batsman", batting: p.batting || "Right Hand", bowling: p.bowling || "N/A",
    city: p.city?.trim() || "—", state: p.state?.trim() || "—", mobile: p.mobile?.trim() || "",
    basePrice: bp, currentBid: Math.max(bp, Number(p.currentBid) || bp),
    photo: p.photo?.trim() || "", availabilityUncertain: Boolean(p.availabilityUncertain),
    manuallyAdded: Boolean(p.manuallyAdded),
    status: (p.status === "sold" || p.status === "unsold") ? p.status : "available",
    soldTo: p.soldTo, soldPrice: p.soldPrice,
  };
}
export function playerKey(p: Pick<Player,"name"|"mobile"|"role"|"city"|"state"|"photo"|"basePrice">) {
  return [p.name,p.mobile,p.role,p.city,p.state,p.photo,String(p.basePrice)].map(v=>v.trim().toLowerCase()).join("|");
}
export function mergePlayers(a: Player[], b: Player[]) {
  const seen = new Set<string>();
  return [...a,...b].filter(p => { const id=playerKey(p); if(seen.has(id)) return false; seen.add(id); return true; });
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  return `${m} min ago`;
}
export function canAfford(t: Team, bid: number, min: number, base: number) {
  return t.purse - bid >= Math.max(0, min - t.players.length - 1) * base;
}
/** Raise size when the current bid is `amount`: the base bid step, or the highest tier reached. */
export function bidStepAt(amount: number, rules: RulesConfig) {
  let step = rules.bidStep;
  for (const t of [...(rules.bidTiers ?? [])].sort((a, b) => a.from - b.from)) if (amount >= t.from && t.step > 0) step = t.step;
  return step;
}
export const squadFull = (t: Team, rules: RulesConfig) => !!rules.maxPlayers && t.players.length >= rules.maxPlayers;
/** Seconds per going-once/twice stage; 0 = manual (the auctioneer advances each stage). */
export const callSecs = (rules: RulesConfig) => Math.max(0, rules.callSeconds ?? 5);
export function calcMax(t: Team, min: number, base: number) {
  return t.purse - Math.max(0, min - t.players.length - 1) * base;
}
export function autoMap(headers: string[]): Partial<ColumnMap> {
  const h = headers.map(x => x.toLowerCase().trim());
  const f = (...kws: string[]) => { for (const kw of kws) { const i=h.findIndex(x=>x.includes(kw)); if(i>=0) return headers[i]; } return ""; };
  return {
    name:         f("player name","name"),
    photo:        f("player photo","photo","image","picture","img"),
    skills:       f("skills","skill","role"),
    address:      f("address","city","location","place"),
    mobile:       f("mobile number","mobile no","mobile","phone number","phone no","phone","contact number","contact no","contact","whatsapp"),
    availability: f("availability","participation","playing status","may or may not","available"),
    basePrice:    f("base price","base amount","price","amount"),
  };
}
export async function fetchHeaders(url: string): Promise<string[]> {
  const r = await fetch(url); const t = await r.text();
  return parseRow(t.trim().split("\n")[0]);
}
export function headersFromText(text: string): string[] {
  return parseRow(text.trim().split("\n")[0]);
}
export function parseCSVText(text: string, map: Partial<ColumnMap>, minBase: number): Player[] {
  const rows = text.trim().split("\n").map(parseRow);
  const hdrs = rows[0].map(h => h.toLowerCase().trim());
  const ci = (col?: string) => {
    if (!col) return -1;
    const cl = col.toLowerCase().trim();
    const e = hdrs.indexOf(cl); if (e >= 0) return e;
    return hdrs.findIndex(h => h.includes(cl));
  };
  const get = (row: string[], key: keyof ColumnMap) => { const i=ci(map[key]); return i>=0?(row[i]||"").trim():""; };
  return rows.slice(1).filter(r => r.length > 1 && r[0]).map((row, i) => {
    const sk = get(row,"skills").toLowerCase().replace(/[\s\-_]+/g,"");
    const addr = get(row,"address").split(",").map((a:string)=>a.trim());
    let role = "Batsman";
    if      (sk.includes("allrounder"))                      role = "All-Rounder";
    else if (sk.includes("wicket")||sk.includes("keeper"))   role = "Wicket Keeper";
    else if (sk.includes("bowler"))                          role = "Bowler";
    let batting = "Right Hand";
    if (sk.includes("lefthand")||sk.includes("left hand")||sk.includes("lhb")) batting = "Left Hand";
    let bowling = "N/A";
    if      (sk.includes("leftarmfast"))  bowling = "Left Arm Fast";
    else if (sk.includes("rightarmfast")) bowling = "Right Arm Fast";
    else if (sk.includes("leftarmspin"))  bowling = "Left Arm Spin";
    else if (sk.includes("rightarmspin")) bowling = "Right Arm Spin";
    else if (sk.includes("leftarm"))      bowling = "Left Arm Fast";
    else if (sk.includes("rightarm"))     bowling = "Right Arm Fast";
    const bpRaw = get(row,"basePrice");
    const bp = bpRaw ? Math.max(minBase, parseInt(bpRaw,10)||minBase) : minBase;
    return normPlayer({
      serialNo: i+1, name: get(row,"name")||"Unknown", photo: get(row,"photo"),
      role, batting, bowling, city: addr[0]||"—", state: addr[1]||"—",
      mobile: get(row,"mobile"), basePrice: bp, currentBid: bp,
      availabilityUncertain: isUncertain(get(row,"availability")),
      manuallyAdded: false, status: "available",
    }, i+1, minBase);
  });
}
export async function fetchPlayers(url: string, map: Partial<ColumnMap>, minBase: number): Promise<Player[]> {
  const r = await fetch(url); const t = await r.text();
  return parseCSVText(t, map, minBase);
}

/** Bids that must go back and forth between the same two teams before it counts as a bid war. */
export const BID_WAR_MIN = 4;

/** A bid war: the latest bids alternate between exactly two teams (A, B, A, B, …).
    `a` started the run, `b` holds the bid now; `from` is the first amount in the run. */
export function bidWar(bids: Bid[]): { a: number; b: number; count: number; from: number } | null {
  const n = bids.length;
  if (n < BID_WAR_MIN) return null;
  const last = bids[n - 1].team, prev = bids[n - 2].team;
  if (last === prev) return null;
  let k = 0;
  while (k < n && bids[n - 1 - k].team === (k % 2 === 0 ? last : prev)) k++;
  return k >= BID_WAR_MIN ? { a: prev, b: last, count: k, from: bids[n - k].amount } : null;
}
